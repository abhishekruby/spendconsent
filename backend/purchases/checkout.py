"""Durable checkout authority; runtime adapters are injected by the API.

There is deliberately no runtime provider, HTTP client, automatic retry or API
enable switch here. Callers must inject create_order(payload, key),
capture_order(order_id, payload, key), and get_order(order_id). The reviewed
adapter maps trusted provider data into the normalized observation below:
{id, status, purchase: <persisted create payload>, capture: null|{
 id, order_id, status, payee_ref, currency, total_cents}}.
The adapter must verify echoed facts and preserve the stored mapping for fields
the provider does not echo; it must not fabricate missing verification evidence.
"""
from contextlib import contextmanager
from copy import deepcopy
import re
import uuid
from django.db import IntegrityError, connection, transaction
from django.http import Http404
from django.utils import timezone
from . import catalog, services
from .models import Approval, DecisionEvent, Offer, PaymentAttempt

PENDING = ("CREATING", "CAPTURING", "VERIFYING", "UNKNOWN")
TERMINAL = ("PAID", "STOPPED", "PAYMENT_REVIEW")
IDENTIFIER = re.compile(r"\A[A-Za-z0-9_-]{1,80}\Z")
MESSAGES = {
    "PAYMENT_STATUS_UNKNOWN": "Payment status is uncertain. Check this existing attempt; do not start another purchase.",
    "MANUAL_RESOLUTION_REQUIRED": "Order creation is uncertain without a stored provider order. Manual resolution is required.",
    "PAYMENT_PENDING": "The provider reports a pending capture. The stock hold remains reserved.",
    "PAYMENT_MISMATCH": "A completed payment does not match the exact approved purchase. Manual review is required.",
    "PROVIDER_DECLINED": "The provider definitively declined this operation without a completed capture.",
    "BUYER_APPROVAL_REQUIRED": "Complete the provider's normal buyer approval before capture.",
    "STOP_REQUESTED": "Stopping was requested. Any already dispatched operation still requires reconciliation.",
    "STOPPED": "This attempt stopped before any unresolved capture. No replacement was started.",
    "REVIEW_CHANGED": "The purchase changed before capture. Inspect and approve a fresh review.",
    "REVIEW_EXPIRED": "Approval or quote expired before capture. Inspect and approve a fresh review.",
    "FINANCIAL_ACTIONS_DISABLED": "The exact action-time permission was unavailable before dispatch. No financial request was sent.",
}


class ProviderDeclined(Exception):
    """Adapter evidence establishes terminal no-create/no-capture, never a timeout."""


class DispatchDenied(Exception):
    """The runtime guard refused before any financial HTTP request was sent."""


def _outside_transaction():
    if connection.in_atomic_block or not connection.get_autocommit():
        raise RuntimeError("Checkout I/O entry points require autocommit, outside all database transactions")


def _result(attempt):
    return attempt, 202 if attempt.state in PENDING else 200


def owned_attempt(owner, pk):
    try:
        return PaymentAttempt.objects.get(id=pk, request__owner_uuid=owner)
    except PaymentAttempt.DoesNotExist:
        raise Http404


@contextmanager
def _locked(owner, pk):
    reference = owned_attempt(owner, pk)
    with transaction.atomic():
        request = services.owned_request(owner, reference.request_id, lock=True)
        approval = Approval.objects.select_for_update().select_related("review").get(id=reference.approval_id)
        offer = Offer.objects.select_for_update().get(id=approval.review.offer_id)
        attempt = PaymentAttempt.objects.select_for_update().get(id=pk)
        yield request, approval, offer, attempt


def _event(request, attempt, kind, reason=None, detail=None):
    message = MESSAGES[reason] if reason else "The exact stored payment state was verified."
    if detail and re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", detail):
        message += f" PayPal sandbox issue: {detail}."
    DecisionEvent.objects.create(request=request, attempt=attempt, type=kind, reason_code=reason, message=message)


def _save(attempt):
    attempt.save(update_fields=["state", "pending_operation", "reason_code", "provider_order_id", "capture_id",
                               "stock_hold_packs", "stop_requested", "capture_dispatched_at", "capture_payload", "updated_at"])


def _release(offer, attempt, paid=False):
    hold = attempt.stock_hold_packs
    if hold:
        offer.reserved_packs -= hold
        if paid:
            offer.stock_packs -= hold
        offer.save(update_fields=["reserved_packs", "stock_packs"])
        attempt.stock_hold_packs = 0


def _transition(request, offer, attempt, state, reason=None, operation=None, detail=None):
    if state == "STOPPED":
        _release(offer, attempt)
    attempt.state = state
    attempt.reason_code = reason
    attempt.pending_operation = operation
    _save(attempt)
    request.status = "PAID" if state == "PAID" else "READY" if state == "STOPPED" else "CHECKOUT"
    request.save(update_fields=["status"])
    _event(request, attempt, state, reason, detail)


def _authority(request, approval, offer, hold=0):
    now = timezone.now()
    if approval.revoked_at:
        raise services.DomainError("REVIEW_CHANGED", MESSAGES["REVIEW_CHANGED"], request_id=request.id)
    if now >= approval.expires_at:
        raise services.DomainError("REVIEW_EXPIRED", MESSAGES["REVIEW_EXPIRED"], 410, request.id)
    services.validate_review(request, approval.review, offer, now, own_hold=hold)


def _purchase_payload(attempt_id, review):
    snapshot = review.snapshot
    return {"intent": "CAPTURE", "reference_id": str(attempt_id), "request_id": str(review.request_id),
            "review_id": str(review.id), "review_digest": review.digest,
            **{key: deepcopy(snapshot[key]) for key in ("payee_ref", "merchant", "item", "shipping", "terms", "currency",
                                                       "subtotal_cents", "shipping_cents", "tax_cents", "discount_cents", "total_cents")}}


def _valid_id(value):
    return isinstance(value, str) and bool(IDENTIFIER.fullmatch(value))


def start(owner, approval_id, provider):
    """Claim one attempt/hold, commit, then dispatch create exactly once."""
    _outside_transaction()
    try:
        reference = Approval.objects.select_related("review").get(id=approval_id, review__request__owner_uuid=owner)
    except Approval.DoesNotExist:
        raise Http404
    with transaction.atomic():
        request = services.owned_request(owner, reference.review.request_id, lock=True)
        approval = Approval.objects.select_for_update().select_related("review").get(id=approval_id)
        existing = PaymentAttempt.objects.filter(approval=approval).first()
        if existing:
            return _result(existing)
        services.editable(request)
        offer = Offer.objects.select_for_update().get(id=approval.review.offer_id)
        _authority(request, approval, offer)
        attempt_id = uuid.uuid4()
        packs = approval.review.snapshot["item"]["packs"]
        offer.reserved_packs += packs
        offer.save(update_fields=["reserved_packs"])
        attempt = PaymentAttempt.objects.create(
            id=attempt_id, request=request, approval=approval, state="CREATING", pending_operation="create",
            snapshot=deepcopy(approval.review.snapshot), stock_hold_packs=packs, create_dispatched_at=timezone.now(),
            create_payload=_purchase_payload(attempt_id, approval.review))
        request.status = "CHECKOUT"
        request.save(update_fields=["status"])
        _event(request, attempt, "CREATING")
    try:
        response = provider.create_order(deepcopy(attempt.create_payload), str(attempt.create_key))
    except DispatchDenied:
        return _dispatch_denied(owner, attempt.id)
    except ProviderDeclined as error:
        return _definitive_decline(owner, attempt.id, "create", error.args[0] if error.args else None)
    except Exception:
        return _unknown(owner, attempt.id, "create")
    order_id = response.get("id") if isinstance(response, dict) else None
    try:
        return _created(owner, attempt.id, order_id)
    except IntegrityError:
        # The unique provider-order constraint also covers different requests racing
        # a broken provider response. Preserve the original hold, never adopt it.
        return _unknown(owner, attempt.id, "create")


def _created(owner, pk, order_id):
    with _locked(owner, pk) as (request, approval, offer, current):
        if current.state not in ("CREATING", "UNKNOWN") or current.capture_dispatched_at:
            return _result(current)
        if not _valid_id(order_id) or PaymentAttempt.objects.exclude(id=current.id).filter(provider_order_id=order_id).exists():
            _transition(request, offer, current, "UNKNOWN", "PAYMENT_STATUS_UNKNOWN", "create")
        else:
            current.provider_order_id = order_id
            _transition(request, offer, current, "STOPPED" if current.stop_requested else "AWAITING_BUYER",
                        "STOPPED" if current.stop_requested else None)
        return _result(current)


def _unknown(owner, pk, operation):
    with _locked(owner, pk) as (request, approval, offer, attempt):
        if attempt.state not in TERMINAL:
            # A later read may already have resolved create. Never erase that order
            # or change a capture's uncertainty back into create uncertainty.
            if operation == "create" and attempt.provider_order_id:
                return _result(attempt)
            _transition(request, offer, attempt, "UNKNOWN", "PAYMENT_STATUS_UNKNOWN", operation)
        return _result(attempt)


def _definitive_decline(owner, pk, operation, detail=None):
    with _locked(owner, pk) as (request, approval, offer, attempt):
        if attempt.state not in TERMINAL and (operation != "create" or not attempt.capture_dispatched_at):
            _transition(request, offer, attempt, "STOPPED", "PROVIDER_DECLINED", detail=detail)
        return _result(attempt)


def _dispatch_denied(owner, pk):
    with _locked(owner, pk) as (request, approval, offer, attempt):
        if attempt.state not in TERMINAL:
            _transition(request, offer, attempt, "STOPPED", "FINANCIAL_ACTIONS_DISABLED")
        return _result(attempt)


def _matching_order(attempt, observation):
    if not isinstance(observation, dict) or observation.get("id") != attempt.provider_order_id:
        return False
    try:
        return catalog.digest(observation.get("purchase")) == catalog.digest(attempt.create_payload)
    except (TypeError, ValueError):
        return False


def _matching_capture(attempt, capture):
    return (isinstance(capture, dict) and _valid_id(capture.get("id"))
            and capture.get("order_id") == attempt.provider_order_id
            and capture.get("payee_ref") == attempt.snapshot["payee_ref"]
            and capture.get("currency") == attempt.snapshot["currency"] == "USD"
            and type(capture.get("total_cents")) is int
            and capture["total_cents"] == attempt.snapshot["total_cents"])


def _observe(owner, pk, observation):
    """Apply a GET observation. APPROVED never resolves a dispatched capture."""
    try:
        return _apply_observation(owner, pk, observation)
    except IntegrityError:
        # A concurrently reused capture ID cannot verify two intended purchases.
        with _locked(owner, pk) as (request, approval, offer, attempt):
            if attempt.state not in TERMINAL:
                _transition(request, offer, attempt, "PAYMENT_REVIEW", "PAYMENT_MISMATCH")
            return _result(attempt)


def _apply_observation(owner, pk, observation):
    with _locked(owner, pk) as (request, approval, offer, attempt):
        if attempt.state in TERMINAL:
            return _result(attempt)
        matched = _matching_order(attempt, observation)
        capture = observation.get("capture") if isinstance(observation, dict) else None
        status = observation.get("status") if isinstance(observation, dict) else None
        capture_status = capture.get("status") if isinstance(capture, dict) else None
        if capture_status == "COMPLETED":
            unique = _valid_id(capture.get("id")) and not PaymentAttempt.objects.exclude(id=attempt.id).filter(capture_id=capture["id"]).exists()
            if unique:
                attempt.capture_id = capture["id"]
            if matched and status == "COMPLETED" and _matching_capture(attempt, capture) and unique:
                _release(offer, attempt, paid=True)
                _transition(request, offer, attempt, "PAID")
            else:
                _transition(request, offer, attempt, "PAYMENT_REVIEW", "PAYMENT_MISMATCH")
        elif capture_status == "PENDING":
            _transition(request, offer, attempt, "UNKNOWN", "PAYMENT_PENDING", "verification")
        elif matched and ((status == "VOIDED" and capture is None)
                          or (capture_status == "DECLINED" and _matching_capture(attempt, capture))):
            _transition(request, offer, attempt, "STOPPED", "PROVIDER_DECLINED")
        elif attempt.capture_dispatched_at:
            _transition(request, offer, attempt, "UNKNOWN", "PAYMENT_STATUS_UNKNOWN", attempt.pending_operation or "capture")
        elif matched and status in ("CREATED", "APPROVED") and capture is None:
            try:
                _authority(request, approval, offer, attempt.stock_hold_packs)
                reason = "STOPPED" if attempt.stop_requested else None
            except services.DomainError as error:
                reason = error.code
            _transition(request, offer, attempt, "STOPPED" if reason else "AWAITING_BUYER", reason)
        else:
            _transition(request, offer, attempt, "UNKNOWN", "PAYMENT_STATUS_UNKNOWN", "verification")
        return _result(attempt)


def capture(owner, pk, provider):
    """Read buyer approval, revalidate/claim under locks, commit, then capture."""
    _outside_transaction()
    attempt = owned_attempt(owner, pk)
    if attempt.state != "AWAITING_BUYER":
        return _result(attempt)
    try:
        observation = provider.get_order(attempt.provider_order_id)
    except Exception:
        return _unknown(owner, pk, "verification")
    observed_capture = observation.get("capture") if isinstance(observation, dict) else None
    if observed_capture is not None or not isinstance(observation, dict) or observation.get("status") not in ("CREATED", "APPROVED"):
        return _observe(owner, pk, observation)
    with _locked(owner, pk) as (request, approval, offer, current):
        if current.state != "AWAITING_BUYER":
            return _result(current)
        if not _matching_order(current, observation):
            _transition(request, offer, current, "STOPPED", "REVIEW_CHANGED")
            return _result(current)
        try:
            _authority(request, approval, offer, current.stock_hold_packs)
            reason = "STOPPED" if current.stop_requested else None
        except services.DomainError as error:
            reason = error.code
        if reason:
            _transition(request, offer, current, "STOPPED", reason)
            return _result(current)
        if observation.get("status") != "APPROVED":
            current.reason_code = "BUYER_APPROVAL_REQUIRED"
            _save(current)
            return _result(current)
        current.capture_dispatched_at = timezone.now()
        current.capture_payload = {"order_id": current.provider_order_id, "reference_id": str(current.id),
                                   "review_digest": current.create_payload["review_digest"],
                                   "currency": current.snapshot["currency"], "total_cents": current.snapshot["total_cents"]}
        _transition(request, offer, current, "CAPTURING", operation="capture")
        attempt = current
    try:
        provider.capture_order(attempt.provider_order_id, deepcopy(attempt.capture_payload), str(attempt.capture_key))
    except DispatchDenied:
        return _dispatch_denied(owner, pk)
    except ProviderDeclined:
        return _definitive_decline(owner, pk, "capture")
    except Exception:
        return _unknown(owner, pk, "capture")
    with _locked(owner, pk) as (request, approval, offer, current):
        if current.state in TERMINAL:
            return _result(current)
        _transition(request, offer, current, "VERIFYING", operation="verification")
    return reconcile(owner, pk, provider)


def reconcile(owner, pk, provider):
    """Read only; never create, capture, resend or allocate a replacement."""
    _outside_transaction()
    attempt = owned_attempt(owner, pk)
    if attempt.state in TERMINAL:
        return _result(attempt)
    if not attempt.provider_order_id:
        with _locked(owner, pk) as (request, approval, offer, current):
            if not current.provider_order_id and current.state not in TERMINAL:
                _transition(request, offer, current, "UNKNOWN", "MANUAL_RESOLUTION_REQUIRED", "create")
            return _result(current)
    try:
        observation = provider.get_order(attempt.provider_order_id)
    except Exception:
        return _unknown(owner, pk, attempt.pending_operation or "verification")
    return _observe(owner, pk, observation)


def stop(owner, pk):
    """A local stop cannot undo a dispatched capture or release uncertain stock."""
    with _locked(owner, pk) as (request, approval, offer, attempt):
        if attempt.state in TERMINAL:
            return _result(attempt)
        attempt.stop_requested = True
        if attempt.state in PENDING or attempt.capture_dispatched_at or not attempt.provider_order_id:
            _transition(request, offer, attempt, "UNKNOWN", "STOP_REQUESTED", attempt.pending_operation or "create")
        else:
            _transition(request, offer, attempt, "STOPPED", "STOPPED")
        return _result(attempt)
