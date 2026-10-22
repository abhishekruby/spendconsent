"""Mock actual urllib requests only. Zero OAuth/PayPal/network calls in this suite."""
import base64
from copy import deepcopy
from email.message import Message
import io
import http.client
import json
import ssl
import urllib.error
import urllib.request
import uuid
from unittest.mock import patch
from django.test import TransactionTestCase
from . import checkout, paypal, services
from .models import PaymentAttempt, Refund
from .tests import make_approval, make_review, ready_request, seed

# Explicitly fictional transport fixtures, not credentials or provider evidence.
MERCHANT = "ABCDEFGHJKLMN"
ORDER = "5O190127TN364715T"
CAPTURE = "3C679366HH908993F"
REFUND = "1JU08902781691411"


class FakeResponse:
    def __init__(self, url, body, status=200, content_type="application/json"):
        self.url, self.status = url, status
        self.body = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.headers = Message()
        self.headers["Content-Type"] = content_type
        self.closed = False
    def geturl(self):
        return self.url
    def read(self, limit):
        return self.body[:limit]
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.closed = True


class FakeHTTP:
    """Only used through a patched urllib opener; no runtime injection setting."""
    def __init__(self, order_id=ORDER):
        self.calls = []
        self.order_id = order_id
        self.order = None
        self.failure = None
        self.read_override = None
        self.refund_override = None

    def __call__(self, request, timeout):
        assert request.full_url.startswith(paypal.BASE_URL + "/")
        assert timeout == paypal.TIMEOUT
        self.calls.append(request)
        if self.failure:
            raise self.failure
        if request.full_url.endswith("/v1/oauth2/token"):
            assert request.get_method() == "POST"
            assert request.data == b"grant_type=client_credentials"
            return FakeResponse(request.full_url, {"token_type": "Bearer", "access_token": "test-only-memory-token", "expires_in": 3600})
        assert request.get_header("Authorization") == "Bearer test-only-memory-token"
        if request.get_method() == "POST" and request.full_url.endswith("/v2/checkout/orders"):
            self.order = {"id": self.order_id, "status": "CREATED", **json.loads(request.data)}
            return FakeResponse(request.full_url, {"id": self.order_id, "status": "CREATED"}, 201)
        if "/v2/payments/" in request.full_url:
            refund = {"id": REFUND, "status": "COMPLETED", "amount": {"currency_code": "USD", "value": self.order["purchase_units"][0]["amount"]["value"]},
                      "links": [{"rel": "up", "href": f"https://api.sandbox.paypal.com/v2/payments/captures/{CAPTURE}"}]}
            if request.get_method() == "POST":
                assert request.full_url == paypal.BASE_URL + f"/v2/payments/captures/{CAPTURE}/refund"
                return FakeResponse(request.full_url, self.refund_override or refund, 201)
            assert request.full_url == paypal.BASE_URL + f"/v2/payments/refunds/{REFUND}"
            return FakeResponse(request.full_url, self.refund_override or refund)
        assert request.full_url in (paypal.BASE_URL + f"/v2/checkout/orders/{self.order_id}", paypal.BASE_URL + f"/v2/checkout/orders/{self.order_id}/capture")
        if request.get_method() == "POST":
            assert json.loads(request.data) == {}
            self.complete()
            return FakeResponse(request.full_url, self.order, 201)
        return self.read_override(request) if self.read_override else FakeResponse(request.full_url, self.order)

    def complete(self, status="COMPLETED"):
        unit = self.order["purchase_units"][0]
        self.order["status"] = "COMPLETED" if status == "COMPLETED" else "APPROVED"
        unit["payments"] = {"captures": [{"id": CAPTURE, "status": status, "final_capture": True,
                                         "amount": {"currency_code": "USD", "value": unit["amount"]["value"]}}]}


class PayPalSandboxClientTests(TransactionTestCase):
    def setUp(self):
        seed()
        self.binding = patch.object(services, "PAYEE_REF", MERCHANT)
        self.binding.start()
        self.addCleanup(self.binding.stop)
        # Defense in depth: even an accidentally unpatched client cannot contact HTTPS.
        guard = patch("http.client.HTTPSConnection.connect", side_effect=AssertionError("Actual network forbidden in tests"))
        guard.start()
        self.addCleanup(guard.stop)
        self.http = FakeHTTP()
        self.paypal = self.new_client()

    def new_client(self):
        client = paypal.SandboxClient("test-sandbox-client", "test-sandbox-secret", MERCHANT)
        transport = patch.object(client._opener, "open", side_effect=self.http)
        transport.start()
        self.addCleanup(transport.stop)
        return client

    def begin(self):
        request = ready_request()
        review = make_review(request)
        approval = make_approval(review)
        attempt, status = checkout.start(request.owner_uuid, approval.id, self.paypal)
        self.assertEqual((attempt.state, status), ("AWAITING_BUYER", 200))
        return request, review, approval, attempt

    def test_actual_wire_body_headers_exact_packs_amounts_and_reviewed_destination(self):
        request, review, approval, attempt = self.begin()
        oauth, create = self.http.calls
        expected_basic = base64.b64encode(b"test-sandbox-client:test-sandbox-secret").decode()
        self.assertEqual(oauth.get_header("Authorization"), "Basic " + expected_basic)
        self.assertEqual(create.get_header("Paypal-request-id"), str(attempt.create_key))
        self.assertEqual(create.get_header("Prefer"), "return=representation")
        body = json.loads(create.data)
        self.assertEqual(body["intent"], "CAPTURE")
        self.assertEqual(len(body["purchase_units"]), 1)
        unit = body["purchase_units"][0]
        self.assertEqual(unit["reference_id"], str(attempt.id))
        self.assertEqual(unit["custom_id"], review.digest)
        self.assertEqual(unit["payee"], {"merchant_id": MERCHANT})
        self.assertEqual(unit["amount"], {"currency_code": "USD", "value": "41.80", "breakdown": {
            "item_total": {"currency_code": "USD", "value": "38.00"}, "tax_total": {"currency_code": "USD", "value": "3.80"},
            "shipping": {"currency_code": "USD", "value": "0.00"}, "discount": {"currency_code": "USD", "value": "0.00"}}})
        self.assertEqual(unit["items"][0]["quantity"], "2")
        self.assertEqual(unit["items"][0]["unit_amount"], {"currency_code": "USD", "value": "19.00"})
        self.assertEqual(unit["items"][0]["sku"], "CLOTH-B")
        self.assertIn("20 individual units per pack", unit["items"][0]["description"])
        self.assertEqual(unit["shipping"]["address"], paypal.DESTINATION_V1["address"])
        self.assertEqual(review.snapshot["shipping"]["destination_label"], paypal.DESTINATION_LABEL_V1)
        self.assertEqual(body["payment_source"]["paypal"]["experience_context"]["shipping_preference"], "SET_PROVIDED_ADDRESS")
        self.assertNotIn("test-sandbox-secret", create.data.decode())
        # SET_PROVIDED_ADDRESS forbids shipping.options (PayPal SHIPPING_OPTIONS_NOT_SUPPORTED).
        self.assertNotIn("options", unit["shipping"])

    def test_independent_read_after_capture_and_restart_binding(self):
        request, review, approval, attempt = self.begin()
        self.http.order["status"] = "APPROVED"
        restarted_client = self.new_client()
        observed = restarted_client.get_order(ORDER)
        self.assertEqual(observed["purchase"], attempt.create_payload)
        self.assertEqual(observed["verification"]["issues"], [])
        paid, status = checkout.capture(request.owner_uuid, attempt.id, restarted_client)
        self.assertEqual((paid.state, status, paid.capture_id), ("PAID", 200, CAPTURE))
        paths = [(call.get_method(), call.full_url.removeprefix(paypal.BASE_URL)) for call in self.http.calls]
        self.assertEqual(paths[-2:], [("POST", f"/v2/checkout/orders/{ORDER}/capture"), ("GET", f"/v2/checkout/orders/{ORDER}")])
        self.assertEqual(sum(path.endswith("/capture") for _, path in paths), 1)

    def test_oauth_memory_cache_and_expiry_without_secret_echo(self):
        request, review, approval, attempt = self.begin()
        self.paypal.get_order(ORDER)
        self.paypal.get_order(ORDER)
        self.assertEqual(sum(call.full_url.endswith("/v1/oauth2/token") for call in self.http.calls), 1)
        self.paypal._token_expires = 0
        self.paypal.get_order(ORDER)
        self.assertEqual(sum(call.full_url.endswith("/v1/oauth2/token") for call in self.http.calls), 2)
        self.assertNotIn("test-sandbox-secret", repr(self.paypal))
        self.assertNotIn("test-only-memory-token", str(paypal.PayPalUnavailable()))

    def test_unconfigured_payee_or_unreviewed_destination_stops_before_network(self):
        request = ready_request()
        with patch.object(services, "PAYEE_REF", "unconfigured-sandbox-sample-merchant"):
            review = make_review(request)
        payload = checkout._purchase_payload(request.id, review)
        for mutation in (lambda value: value.update(payee_ref="unconfigured-sandbox-sample-merchant"),
                         lambda value: value["shipping"].update(destination_label="Fictional business destination"),
                         lambda value: value["shipping"].update(destination_ref="arbitrary-address")):
            candidate = deepcopy(payload)
            candidate["payee_ref"] = MERCHANT
            mutation(candidate)
            with self.assertRaises(paypal.PayPalUnavailable):
                paypal.wire_order(candidate, MERCHANT)
        self.assertEqual(self.http.calls, [])

    def test_strict_url_ids_and_fixed_origin_proxy_redirect_tls_policy(self):
        for order_id in ("../capture", "https://evil.example", "A?x=1", "A/B", "abc", "A" * 37, "A\r\nX"):
            for operation in (lambda: self.paypal.get_order(order_id), lambda: self.paypal.capture_order(order_id, {}, "key")):
                with self.subTest(order_id=order_id), self.assertRaises(paypal.PayPalUnavailable):
                    operation()
        self.assertEqual(self.http.calls, [])
        handlers = self.paypal._opener.handlers
        self.assertTrue(any(isinstance(handler, paypal.NoRedirect) for handler in handlers))
        self.assertIsNone(paypal.NoRedirect().redirect_request(None, None, None, None, None))
        https = next(handler for handler in handlers if isinstance(handler, urllib.request.HTTPSHandler))
        self.assertTrue(https._context.check_hostname)
        self.assertEqual(https._context.verify_mode, ssl.CERT_REQUIRED)
        self.assertFalse(any(isinstance(handler, urllib.request.ProxyHandler) and handler.proxies for handler in handlers))

    def test_create_validation_rejection_is_a_definitive_decline_with_issue_code_only(self):
        for code, body, expected_state in ((422, b'{"name":"UNPROCESSABLE_ENTITY","details":[{"issue":"SHIPPING_OPTIONS_NOT_SUPPORTED","description":"PRIVATE_TEXT"}]}', "STOPPED"),
                                           (400, b'not json PRIVATE_TEXT', "UNKNOWN"),
                                           (422, b'{"details":[{"issue":"DUPLICATE_REQUEST_ID"}]}', "UNKNOWN"),
                                           (500, b'{"name":"INTERNAL_SERVER_ERROR"}', "UNKNOWN")):
            with self.subTest(code=code):
                self.http = FakeHTTP()
                self.paypal = self.new_client()
                request = ready_request()
                approval = make_approval(make_review(request))
                original = self.http.__call__
                def reject_create(call, timeout):
                    if call.full_url.endswith("/v2/checkout/orders"):
                        self.http.calls.append(call)
                        raise urllib.error.HTTPError(call.full_url, code, "PRIVATE_REASON", Message(), io.BytesIO(body))
                    return original(call, timeout)
                self.paypal._opener.open.side_effect = reject_create
                attempt, _ = checkout.start(request.owner_uuid, approval.id, self.paypal)
                self.assertEqual(attempt.state, expected_state)
                self.assertIsNone(attempt.provider_order_id)
                self.assertEqual(sum(call.full_url.endswith("/v2/checkout/orders") for call in self.http.calls), 1)
                if expected_state == "STOPPED":
                    self.assertEqual((attempt.reason_code, attempt.stock_hold_packs), ("PROVIDER_DECLINED", 0))
                self.assertEqual(request.events.filter(message__contains="SHIPPING_OPTIONS_NOT_SUPPORTED").exists(),
                                 b"SHIPPING_OPTIONS_NOT_SUPPORTED" in body)
                self.assertFalse(request.events.filter(message__contains="PRIVATE").exists())

    def test_http_errors_never_retry_or_release_uncertain_capture(self):
        for code in (401, 422, 500):
            with self.subTest(code=code):
                self.http = FakeHTTP(order_id=f"TESTORDER{code}")
                self.paypal = self.new_client()
                request, review, approval, attempt = self.begin()
                self.http.order["status"] = "APPROVED"
                original = self.http.__call__
                def fail_capture(request, timeout):
                    if request.full_url.endswith("/capture"):
                        self.http.calls.append(request)
                        raise urllib.error.HTTPError(request.full_url, code, "PRIVATE_PROVIDER_DETAIL", Message(), io.BytesIO(b'{"issue":"ORDER_ALREADY_CAPTURED","private":"PRIVATE_BODY"}'))
                    return original(request, timeout)
                self.paypal._opener.open.side_effect = fail_capture
                unknown, _ = checkout.capture(request.owner_uuid, attempt.id, self.paypal)
                self.assertEqual(unknown.state, "UNKNOWN")
                self.assertEqual(unknown.stock_hold_packs, 2)
                self.assertEqual(sum(call.full_url.endswith("/capture") for call in self.http.calls), 1)
                self.assertFalse(request.events.filter(message__contains="PRIVATE").exists())

    def test_malformed_json_oversized_nonjson_and_redirect_like_reads_fail_closed(self):
        request, review, approval, attempt = self.begin()
        for body, content_type, url, status in ((b'{"id":', "application/json", None, 200),
                (b'{"id":"A","id":"B"}', "application/json", None, 200),
                (b'{"value":NaN}', "application/json", None, 200),
                (b"x" * (paypal.MAX_RESPONSE + 1), "application/json", None, 200),
                (b"{}", "text/html", None, 200), (b"{}", "application/json", "https://evil.example", 200),
                (b"{}", "application/json", None, 302)):
            with self.subTest(status=status, content_type=content_type, url=url):
                self.http.read_override = lambda req: FakeResponse(url or req.full_url, body, status, content_type)
                with self.assertRaises(paypal.PayPalUnavailable) as error:
                    self.paypal.get_order(ORDER)
                self.assertNotIn("PRIVATE", str(error.exception))
        self.paypal._opener.open.side_effect = http.client.BadStatusLine("PRIVATE_PROVIDER_PROTOCOL_DETAIL")
        with self.assertRaises(paypal.PayPalUnavailable) as error:
            self.paypal.get_order(ORDER)
        self.assertNotIn("PRIVATE", str(error.exception))

    def test_omitted_echoable_facts_and_completed_without_capture_hold_unknown(self):
        request, review, approval, attempt = self.begin()
        self.http.order["status"] = "COMPLETED"
        self.http.order["purchase_units"][0].pop("items")
        observed = self.paypal.get_order(ORDER)
        self.assertIsNone(observed["purchase"])
        self.assertIn("ITEMS_UNVERIFIED", observed["verification"]["issues"])
        self.assertIn("COMPLETION_EVIDENCE_MISSING", observed["verification"]["issues"])
        result, _ = checkout.capture(request.owner_uuid, attempt.id, self.paypal)
        self.assertEqual(result.state, "UNKNOWN")
        self.assertEqual(checkout.stop(request.owner_uuid, attempt.id)[0].stock_hold_packs, 2)

    def test_completed_falsifications_reach_manual_review_without_payer_pii(self):
        request, review, approval, attempt = self.begin()
        self.http.complete()
        base = deepcopy(self.http.order)
        mutations = [lambda raw: raw.update(id="OTHERORDER"),
                     lambda raw: raw["purchase_units"][0]["amount"].update(value="40.00"),
                     lambda raw: raw["purchase_units"][0]["payee"].update(merchant_id="ZZZZZZZZZZZZZ"),
                     lambda raw: raw["purchase_units"][0]["items"][0].update(sku="OTHER-SKU"),
                     lambda raw: raw["purchase_units"][0]["items"][0].update(quantity="3"),
                     lambda raw: raw["purchase_units"][0]["shipping"]["address"].update(postal_code="00000"),
                     lambda raw: raw["purchase_units"][0]["payments"]["captures"][0]["amount"].update(currency_code="EUR"),
                     lambda raw: raw["purchase_units"][0]["payments"]["captures"][0].update(final_capture=False)]
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                raw = deepcopy(base)
                mutate(raw)
                raw["payer"] = {"email_address": "PRIVATE_PAYER_EMAIL", "name": {"full_name": "PRIVATE_PAYER_NAME"}}
                observed = paypal.normalize_order(raw, ORDER, attempt.create_payload, MERCHANT)
                self.assertIsNone(observed["purchase"])
                self.assertEqual(observed["capture"]["status"], "COMPLETED")
                self.assertTrue(observed["verification"]["issues"])
                self.assertNotIn("PRIVATE_PAYER", json.dumps(observed))
        self.http.order = deepcopy(base)
        mutations[1](self.http.order)
        result, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.paypal)
        self.assertEqual(result.state, "PAYMENT_REVIEW")
        self.assertEqual(result.stock_hold_packs, 2)
        self.assertEqual(result.capture_id, CAPTURE)

    def test_multiple_captures_pending_and_decline_require_trusted_matching_facts(self):
        request, review, approval, attempt = self.begin()
        for status in ("PENDING", "DECLINED"):
            self.http.complete(status)
            observed = self.paypal.get_order(ORDER)
            self.assertEqual(observed["capture"]["status"], status)
            self.assertEqual(observed["purchase"], attempt.create_payload)
        self.http.complete()
        captures = self.http.order["purchase_units"][0]["payments"]["captures"]
        captures.append({**deepcopy(captures[0]), "id": "OTHERCAPTURE"})
        observed = self.paypal.get_order(ORDER)
        self.assertEqual(observed["verification"]["capture_count"], 2)
        self.assertIsNone(observed["purchase"])
        result, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.paypal)
        self.assertEqual(result.state, "PAYMENT_REVIEW")
        self.assertEqual(result.stock_hold_packs, 2)


class PayPalRefundTests(TransactionTestCase):
    """Refund wire format and evidence binding, with the same network guard."""
    setUp, new_client, begin = PayPalSandboxClientTests.setUp, PayPalSandboxClientTests.new_client, PayPalSandboxClientTests.begin

    def paid(self):
        request, review, approval, attempt = self.begin()
        self.http.order["status"] = "APPROVED"
        paid, _ = checkout.capture(request.owner_uuid, attempt.id, self.paypal)
        self.assertEqual(paid.state, "PAID")
        return request, paid

    def test_refund_wire_body_key_and_capture_binding(self):
        request, paid = self.paid()
        operations = []
        self.paypal._before_financial = lambda operation, key: operations.append((operation, key))
        row = checkout.refund(request.owner_uuid, paid.id, self.paypal)
        self.assertEqual((row.state, row.provider_refund_id), ("REFUNDED", REFUND))
        call = self.http.calls[-1]
        self.assertEqual(call.get_header("Paypal-request-id"), str(row.refund_key))
        self.assertEqual(json.loads(call.data)["amount"], {"currency_code": "USD", "value": "41.80"})
        self.assertEqual(operations, [("refund", str(row.refund_key))])

    def test_refund_for_another_capture_or_amount_is_never_verified(self):
        for change in ({"links": [{"rel": "up", "href": "https://api.sandbox.paypal.com/v2/payments/captures/OTHERCAPTURE1"}]},
                       {"amount": {"currency_code": "USD", "value": "1.00"}},
                       {"links": [{"rel": "up", "href": f"https://evil.example/v2/payments/captures/{CAPTURE}"}]}):
            raw = {"id": REFUND, "status": "COMPLETED", "amount": {"currency_code": "USD", "value": "41.80"},
                   "links": [{"rel": "up", "href": f"https://api.sandbox.paypal.com/v2/payments/captures/{CAPTURE}"}], **change}
            self.assertEqual(paypal.normalize_refund(raw, CAPTURE, 4180)["status"], "UNKNOWN")

    def test_refund_paths_need_a_matching_persisted_row(self):
        with self.assertRaises(paypal.PayPalUnavailable):
            self.paypal.refund_capture(CAPTURE, str(uuid.uuid4()))
        with self.assertRaises(paypal.PayPalUnavailable):
            self.paypal.get_refund(REFUND)
        with self.assertRaises(paypal.PayPalUnavailable):
            self.paypal._request("POST", "/v2/payments/captures/X/refund/../../payouts", b"{}", {}, (200,))

    def test_find_refund_reads_only_a_matching_refund_on_the_order(self):
        request, paid = self.paid()
        Refund.objects.create(attempt=paid, state="UNKNOWN", total_cents=paid.snapshot["total_cents"])
        unit = self.http.order["purchase_units"][0]
        good = {"id": REFUND, "status": "COMPLETED", "amount": {"currency_code": "USD", "value": "41.80"},
                "links": [{"rel": "up", "href": f"https://api.sandbox.paypal.com/v2/payments/captures/{CAPTURE}"}]}
        unit["payments"]["refunds"] = [{**good, "id": "OTHERREFUND1", "amount": {"currency_code": "USD", "value": "1.00"}}, good]
        before = len(self.http.calls)
        self.assertEqual(self.paypal.find_refund(ORDER), {"id": REFUND, "status": "COMPLETED", "verified": True})
        self.assertEqual([call.get_method() for call in self.http.calls[before:]], ["GET"])
        unit["payments"]["refunds"] = [good, {**good, "id": "SECONDREFUND1"}]
        self.assertFalse(self.paypal.find_refund(ORDER)["verified"], "two matching refunds are not one answer")
