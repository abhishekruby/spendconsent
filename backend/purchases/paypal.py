"""Sandbox-only REST adapter. Runtime injects the action-time dispatch guard.

Tokens and credentials stay in memory. Only the persisted immutable attempt maps
an order to a purchase; a new client can verify it after a process restart.
"""
import base64
from copy import deepcopy
import http.client
import json
import re
import ssl
import threading
import time
import urllib.error
import urllib.request
import uuid
from django.db import connection
from . import catalog
from .checkout import ProviderDeclined
from .models import PaymentAttempt

BASE_URL = "https://api-m.sandbox.paypal.com"
ORDER_ID = re.compile(r"\A[A-Z0-9]{1,36}\Z")
MERCHANT_ID = re.compile(r"\A[2-9A-HJ-NP-Z]{13}\Z")
MAX_RESPONSE = 262144
TIMEOUT = 15
DESTINATION_LABEL_V1 = "Fictional sample only — SpendConsent Demo Business, 100 Fictional Supply Lane, San Jose, CA 95131, US"
# Immutable v1 meaning of the existing sample-business reference. Future changes
# require a new reference and fresh human review, never editing this mapping.
DESTINATION_V1 = {"name": {"full_name": "SpendConsent Demo Business"},
                  "address": {"address_line_1": "100 Fictional Supply Lane", "admin_area_2": "San Jose",
                              "admin_area_1": "CA", "postal_code": "95131", "country_code": "US"}}


class PayPalUnavailable(Exception):
    def __init__(self, code="PROVIDER_UNAVAILABLE"):
        self.code = code if code in ("PROVIDER_UNAVAILABLE", "PROVIDER_RESPONSE_INVALID", "AUTH_UNAVAILABLE", "BINDING_UNVERIFIED", "SANDBOX_CONFIG_INVALID") else "PROVIDER_UNAVAILABLE"
        super().__init__(self.code)


def _issue(error):
    """PayPal's machine-readable issue name only (e.g. SHIPPING_OPTIONS_NOT_SUPPORTED), never raw text."""
    try:
        body = json.loads(error.read(8192).decode("utf-8"))
        details = body.get("details") if isinstance(body, dict) else None
        issue = details[0].get("issue") if isinstance(details, list) and details and isinstance(details[0], dict) else body.get("name")
        return issue if isinstance(issue, str) and re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", issue) else None
    except (OSError, ValueError, AttributeError, UnicodeError):
        return None
    finally:
        error.close()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def _identifier(value):
    if not isinstance(value, str) or not ORDER_ID.fullmatch(value):
        raise PayPalUnavailable("BINDING_UNVERIFIED")
    return value


def _money(cents):
    if type(cents) is not int or not 0 <= cents <= 100000000:
        raise PayPalUnavailable("BINDING_UNVERIFIED")
    return {"currency_code": "USD", "value": f"{cents // 100}.{cents % 100:02d}"}


def _cents(money):
    if not isinstance(money, dict) or money.get("currency_code") != "USD":
        return None
    value = money.get("value")
    if not isinstance(value, str) or not re.fullmatch(r"(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?", value):
        return None
    whole, _, fraction = value.partition(".")
    return int(whole) * 100 + int(fraction.ljust(2, "0") or "0")


def wire_order(payload, merchant_id):
    """Build one exact CAPTURE purchase unit from server-owned persisted facts."""
    try:
        if not MERCHANT_ID.fullmatch(merchant_id) or payload["payee_ref"] != merchant_id or payload["currency"] != "USD" or payload["intent"] != "CAPTURE":
            raise ValueError
        uuid.UUID(payload["reference_id"])
        uuid.UUID(payload["request_id"])
        uuid.UUID(payload["review_id"])
        if not re.fullmatch(r"[0-9a-f]{64}", payload["review_digest"]):
            raise ValueError
        item = payload["item"]
        packs = item["packs"]
        if type(packs) is not int or not 1 <= packs <= 10000 or type(item["pack_units"]) is not int or item["pack_units"] < 1 or item["individual_units"] != packs * item["pack_units"]:
            raise ValueError
        subtotal, tax, shipping, discount, total = (payload[key] for key in ("subtotal_cents", "tax_cents", "shipping_cents", "discount_cents", "total_cents"))
        for value in (subtotal, tax, shipping, discount, total):
            _money(value)
        if subtotal % packs or total <= 0 or subtotal + tax + shipping - discount != total:
            raise ValueError
        destination = payload["shipping"]
        if destination != {"option_id": "fixture-standard", "label": "Synthetic standard delivery", "destination_ref": "sample-business", "destination_label": DESTINATION_LABEL_V1} or payload["terms"]["one_time"] is not True:
            raise ValueError
        for key in ("name", "sku", "variant_id", "specification"):
            if not isinstance(item[key], str) or not item[key] or len(item[key]) > 120:
                raise ValueError
        description = f"{item['specification']}; variant {item['variant_id']}; {item['pack_units']} individual units per pack."
        # PayPal rejects shipping.options with SET_PROVIDED_ADDRESS (SHIPPING_OPTIONS_NOT_SUPPORTED);
        # the fixed delivery charge is carried by amount.breakdown.shipping instead.
        shipping_detail = deepcopy(DESTINATION_V1)
        unit = {"reference_id": payload["reference_id"], "custom_id": payload["review_digest"],
                "payee": {"merchant_id": merchant_id}, "amount": {**_money(total), "breakdown": {
                    "item_total": _money(subtotal), "tax_total": _money(tax), "shipping": _money(shipping), "discount": _money(discount)}},
                "items": [{"name": item["name"], "sku": item["sku"], "description": description,
                           "category": "PHYSICAL_GOODS", "quantity": str(packs), "unit_amount": _money(subtotal // packs)}],
                "shipping": shipping_detail}
        return {"intent": "CAPTURE", "purchase_units": [unit],
                "payment_source": {"paypal": {"experience_context": {"shipping_preference": "SET_PROVIDED_ADDRESS"}}}}
    except (KeyError, TypeError, ValueError, AttributeError):
        raise PayPalUnavailable("BINDING_UNVERIFIED") from None


def normalize_order(raw, order_id, payload, merchant_id):
    """Return safe domain evidence, never payer data or a raw provider response."""
    expected = wire_order(payload, merchant_id)["purchase_units"][0]
    issues = []
    def check(condition, issue):
        if not condition:
            issues.append(issue)
    if not isinstance(raw, dict):
        raise PayPalUnavailable("PROVIDER_RESPONSE_INVALID")
    observed_id = raw.get("id") if isinstance(raw.get("id"), str) and ORDER_ID.fullmatch(raw["id"]) else None
    check(observed_id == order_id, "ORDER_ID_MISMATCH")
    check(raw.get("intent") == "CAPTURE", "INTENT_UNVERIFIED")
    units = raw.get("purchase_units")
    check(isinstance(units, list) and len(units) == 1, "PURCHASE_UNITS_UNVERIFIED")
    unit = units[0] if isinstance(units, list) and len(units) == 1 and isinstance(units[0], dict) else {}
    check(unit.get("reference_id") == expected["reference_id"], "REFERENCE_UNVERIFIED")
    check(unit.get("custom_id") == expected["custom_id"], "REVIEW_DIGEST_UNVERIFIED")
    payee = unit.get("payee") if isinstance(unit.get("payee"), dict) else {}
    check(payee.get("merchant_id") == merchant_id, "PAYEE_UNVERIFIED")
    amount = unit.get("amount") if isinstance(unit.get("amount"), dict) else {}
    check(_cents(amount) == payload["total_cents"], "ORDER_AMOUNT_UNVERIFIED")
    breakdown = amount.get("breakdown") if isinstance(amount.get("breakdown"), dict) else {}
    for key, value in expected["amount"]["breakdown"].items():
        check(_cents(breakdown.get(key)) == _cents(value), "BREAKDOWN_UNVERIFIED")
    for key in set(breakdown) - set(expected["amount"]["breakdown"]):
        check(key in ("handling", "insurance", "shipping_discount") and _cents(breakdown[key]) == 0, "UNEXPECTED_CHARGE")
    items = unit.get("items")
    check(isinstance(items, list) and len(items) == 1, "ITEMS_UNVERIFIED")
    item = items[0] if isinstance(items, list) and len(items) == 1 and isinstance(items[0], dict) else {}
    for key, value in expected["items"][0].items():
        check(_cents(item.get(key)) == _cents(value) if key == "unit_amount" else type(item.get(key)) is type(value) and item[key] == value, "ITEM_FACTS_UNVERIFIED")
    check("billing_plan" not in item and ("tax" not in item or _cents(item["tax"]) == 0), "ITEM_TERMS_UNVERIFIED")
    shipping = unit.get("shipping") if isinstance(unit.get("shipping"), dict) else {}
    check(shipping.get("name") == expected["shipping"]["name"], "SHIPPING_RECIPIENT_UNVERIFIED")
    check(shipping.get("address") == expected["shipping"]["address"], "SHIPPING_ADDRESS_UNVERIFIED")
    # No shipping options are sent; any echoed option must not add a charge.
    options = shipping.get("options", [])
    check(isinstance(options, list) and all(isinstance(option, dict) and _cents(option.get("amount")) in (None, 0, payload["shipping_cents"])
                                            for option in options), "SHIPPING_OPTION_UNVERIFIED")
    payments = unit.get("payments", {})
    check(isinstance(payments, dict), "PAYMENTS_UNVERIFIED")
    payments = payments if isinstance(payments, dict) else {}
    check(not payments.get("authorizations") and not payments.get("refunds"), "UNEXPECTED_PAYMENT_TYPE")
    captures = payments.get("captures", [])
    check(isinstance(captures, list) and len(captures) <= 1, "CAPTURES_UNVERIFIED")
    safe_captures = []
    # Scan every unit for completed money even when the one-unit contract was violated.
    for purchase_unit in units if isinstance(units, list) else []:
        payment_data = purchase_unit.get("payments", {}) if isinstance(purchase_unit, dict) else {}
        unit_payee = purchase_unit.get("payee", {}) if isinstance(purchase_unit, dict) else {}
        observed_payee = unit_payee.get("merchant_id") if isinstance(unit_payee, dict) else None
        rows = payment_data.get("captures", []) if isinstance(payment_data, dict) else []
        for capture in rows if isinstance(rows, list) else []:
            if not isinstance(capture, dict):
                continue
            status = capture.get("status")
            status = status if status in ("COMPLETED", "PENDING", "DECLINED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED") else "UNKNOWN"
            capture_id = capture.get("id")
            capture_id = capture_id if isinstance(capture_id, str) and ORDER_ID.fullmatch(capture_id) else None
            safe_captures.append({"id": capture_id, "order_id": observed_id, "status": status,
                                  "payee_ref": observed_payee if isinstance(observed_payee, str) and MERCHANT_ID.fullmatch(observed_payee) else None,
                                  "currency": capture["amount"]["currency_code"] if isinstance(capture.get("amount"), dict) and isinstance(capture["amount"].get("currency_code"), str) and re.fullmatch(r"[A-Z]{3}", capture["amount"]["currency_code"]) else None,
                                  "total_cents": _cents(capture.get("amount"))})
    check(len(safe_captures) == (len(captures) if isinstance(captures, list) else 0), "CAPTURES_UNVERIFIED")
    if safe_captures:
        proof = captures[0] if isinstance(captures, list) and len(captures) == 1 and isinstance(captures[0], dict) else {}
        safe = safe_captures[0]
        check(len(safe_captures) == 1 and safe["id"] is not None and safe["total_cents"] == payload["total_cents"]
              and safe["currency"] == "USD" and proof.get("final_capture") is True, "CAPTURE_FACTS_UNVERIFIED")
    order_status = raw.get("status")
    order_status = order_status if order_status in ("CREATED", "APPROVED", "COMPLETED", "VOIDED", "PAYER_ACTION_REQUIRED") else "UNKNOWN"
    check(order_status != "COMPLETED" or bool(safe_captures), "COMPLETION_EVIDENCE_MISSING")
    capture = next((row for row in safe_captures if row["status"] == "COMPLETED"), safe_captures[0] if safe_captures else None)
    verified = not issues
    return {"id": observed_id, "status": order_status if verified else "UNKNOWN",
            "purchase": deepcopy(payload) if verified else None, "capture": capture,
            "verification": {"issues": sorted(set(issues)), "capture_count": len(safe_captures), "captures": safe_captures}}


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError
        result[key] = value
    return result


class SandboxClient:
    def __init__(self, client_id, client_secret, merchant_id, before_financial=None):
        if (not isinstance(client_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", client_id)
                or not isinstance(client_secret, str) or not 1 <= len(client_secret) <= 512 or any(char in client_secret for char in "\r\n")
                or not isinstance(merchant_id, str) or not MERCHANT_ID.fullmatch(merchant_id)):
            raise PayPalUnavailable("SANDBOX_CONFIG_INVALID")
        self._client_id, self._client_secret, self._merchant_id = client_id, client_secret, merchant_id
        self._before_financial = before_financial
        self._token, self._token_expires = None, 0
        self._token_lock = threading.Lock()
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
                                                   urllib.request.HTTPSHandler(context=ssl.create_default_context()))

    def _request(self, method, path, body, headers, statuses):
        if connection.in_atomic_block or not connection.get_autocommit():
            raise PayPalUnavailable("BINDING_UNVERIFIED")
        allowed = ((method == "POST" and path in ("/v1/oauth2/token", "/v2/checkout/orders"))
                   or re.fullmatch(r"/v2/checkout/orders/[A-Z0-9]{1,36}" + (r"/capture" if method == "POST" else ""), path) and method in ("GET", "POST"))
        if not allowed:
            raise PayPalUnavailable("BINDING_UNVERIFIED")
        if self._before_financial and method == "POST" and path != "/v1/oauth2/token":
            self._before_financial("create" if path == "/v2/checkout/orders" else "capture", headers.get("PayPal-Request-Id"))
        request = urllib.request.Request(BASE_URL + path, body, {"Accept": "application/json", **headers}, method=method)
        try:
            with self._opener.open(request, timeout=TIMEOUT) as response:
                if response.status not in statuses or response.geturl() != request.full_url or response.headers.get_content_type() != "application/json":
                    raise ValueError
                raw = response.read(MAX_RESPONSE + 1)
                if len(raw) > MAX_RESPONSE:
                    raise ValueError
                result = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object,
                                    parse_constant=lambda value: (_ for _ in ()).throw(ValueError()))
                if not isinstance(result, dict):
                    raise ValueError
                return result
        except urllib.error.HTTPError as error:
            if error.code == 401:
                self._token, self._token_expires = None, 0
            # A create-order validation rejection (400/422) creates no order: report a
            # definitive decline with PayPal's issue code only. Capture errors stay
            # uncertain (a capture 422 can mean ORDER_ALREADY_CAPTURED).
            if method == "POST" and path == "/v2/checkout/orders" and error.code in (400, 422):
                raise ProviderDeclined(_issue(error)) from None
            error.close()
            raise PayPalUnavailable() from None
        except (OSError, http.client.HTTPException, ValueError, TypeError, UnicodeError, RecursionError):
            raise PayPalUnavailable("PROVIDER_RESPONSE_INVALID") from None

    def _access_token(self):
        with self._token_lock:
            if self._token and time.monotonic() < self._token_expires:
                return self._token
            basic = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
            data = self._request("POST", "/v1/oauth2/token", b"grant_type=client_credentials",
                                 {"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {basic}"}, (200,))
            token, expires = data.get("access_token"), data.get("expires_in")
            if (not isinstance(data.get("token_type"), str) or data["token_type"].lower() != "bearer" or not isinstance(token, str) or not 1 <= len(token) <= 4096
                    or not token.isascii() or any(char.isspace() or ord(char) < 33 for char in token)
                    or type(expires) is not int or not 30 < expires <= 86400):
                raise PayPalUnavailable("AUTH_UNAVAILABLE")
            self._token, self._token_expires = token, time.monotonic() + expires - 30
            return token

    def _json(self, method, path, payload=None, key=None, statuses=(200,)):
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self._access_token()}"}
        if key:
            headers.update({"PayPal-Request-Id": key, "Prefer": "return=representation"})
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode() if payload is not None else None
        return self._request(method, path, body, headers, statuses)

    def create_order(self, payload, key):
        try:
            attempt = PaymentAttempt.objects.get(id=uuid.UUID(payload["reference_id"]))
            if (attempt.state != "CREATING" or attempt.pending_operation != "create" or str(attempt.create_key) != key
                    or catalog.digest(attempt.create_payload) != catalog.digest(payload)):
                raise ValueError
        except (KeyError, TypeError, ValueError, PaymentAttempt.DoesNotExist):
            raise PayPalUnavailable("BINDING_UNVERIFIED") from None
        response = self._json("POST", "/v2/checkout/orders", wire_order(payload, self._merchant_id), key, (200, 201))
        return {"id": _identifier(response.get("id"))}

    def get_order(self, order_id):
        _identifier(order_id)
        try:
            attempt = PaymentAttempt.objects.get(provider_order_id=order_id)
        except PaymentAttempt.DoesNotExist:
            raise PayPalUnavailable("BINDING_UNVERIFIED") from None
        wire_order(attempt.create_payload, self._merchant_id)
        raw = self._json("GET", f"/v2/checkout/orders/{order_id}")
        return normalize_order(raw, order_id, attempt.create_payload, self._merchant_id)

    def capture_order(self, order_id, payload, key):
        _identifier(order_id)
        try:
            attempt = PaymentAttempt.objects.get(provider_order_id=order_id)
            if (attempt.state != "CAPTURING" or attempt.pending_operation != "capture" or not attempt.capture_dispatched_at
                    or str(attempt.capture_key) != key or catalog.digest(attempt.capture_payload) != catalog.digest(payload)):
                raise ValueError
        except (TypeError, ValueError, PaymentAttempt.DoesNotExist):
            raise PayPalUnavailable("BINDING_UNVERIFIED") from None
        wire_order(attempt.create_payload, self._merchant_id)
        self._json("POST", f"/v2/checkout/orders/{order_id}/capture", {}, key, (200, 201))
        # Only the checkout service's subsequent trusted GET may establish PAID.
        return {"accepted": True}
