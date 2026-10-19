"""Transactional local purchase authority. No model or provider HTTP calls."""
from datetime import timedelta
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import APIException
from . import catalog
from .models import ACTIVE_STATES, Approval, DecisionEvent, Offer, PurchaseRequest, Review
from .serializers import Constraints

MERCHANT = {"id": "sample-merchant", "name": "Fictional Supply Merchant"}
SHIPPING = {"option_id": "fixture-standard", "label": "Synthetic standard delivery",
            "destination_ref": "sample-business", "destination_label": "Fictional sample only — SpendConsent Demo Business, 100 Fictional Supply Lane, San Jose, CA 95131, US"}
TERMS = {"one_time": True, "description": "One-time purchase. Fictional catalog; no real goods or fulfillment."}
# An unconfigured fixture binding cannot authorize a PayPal payment. Real configuration
# changes this binding and requires a new review before financial integration.
PAYEE_REF = "unconfigured-sandbox-sample-merchant"


class DomainError(APIException):
    def __init__(self, code, message, status=409, request_id=None, retryable=False):
        self.status_code = status
        self.code = code
        self.message = message
        self.request_id = str(request_id) if request_id else None
        self.retryable = retryable
        super().__init__(message)


def event(request, kind, message, reason=None):
    DecisionEvent.objects.create(request=request, type=kind, reason_code=reason, message=message)


def owned_request(owner, pk, lock=False):
    query = PurchaseRequest.objects
    if lock:
        query = query.select_for_update()
    try:
        return query.get(id=pk, owner_uuid=owner)
    except PurchaseRequest.DoesNotExist:
        raise Http404


def editable(request):
    if request.status == "PAID" or request.attempts.filter(state__in=(*ACTIVE_STATES, "PAID")).exists():
        raise DomainError("OPERATION_PENDING", "Resolve the existing payment attempt before changing this purchase.", request_id=request.id)


def request_version(request, expected_version):
    if request.version != expected_version:
        raise DomainError("REVIEW_CHANGED", "The request changed. Reload its current version.", request_id=request.id)


def revoke_unconsumed(request, now):
    # All callers hold the request lock. Keep the same request → approval → offer order.
    list(Approval.objects.select_for_update().filter(review__request=request).order_by("pk"))
    Approval.objects.filter(review__request=request, attempt__isnull=True, revoked_at__isnull=True).update(revoked_at=now)


@transaction.atomic
def submit(owner, data, inference_id=None):
    submission_digest = catalog.digest({"text": data["text"], "constraints": data.get("constraints", {})})
    request, created = PurchaseRequest.objects.get_or_create(
        owner_uuid=owner, client_submission_id=data["client_submission_id"],
        defaults={"text": data["text"], "constraints": data.get("constraints", {}),
                  "confirmed_constraints": data.get("constraints", {}), "submission_digest": submission_digest,
                  "status": "COMPARING" if inference_id else "MODEL_ERROR", "active_inference_id": inference_id})
    if request.submission_digest != submission_digest:
        raise DomainError("SUBMISSION_CONFLICT", "That submission ID was already used for a different request.", request_id=request.id)
    if created:
        event(request, "REQUESTED", "Purchase request saved.")
        comparison_event(request, inference_id)
    return request


@transaction.atomic
def clarify(owner, pk, expected_version, constraints, inference_id=None):
    request = owned_request(owner, pk, lock=True)
    editable(request)
    request_version(request, expected_version)
    combined = {**request.confirmed_constraints, **constraints}
    changed_category = combined.get("category") != request.confirmed_constraints.get("category")
    if changed_category:
        combined["attributes"] = constraints.get("attributes", {})
    elif "attributes" in constraints and isinstance(constraints["attributes"], dict):
        combined["attributes"] = {**request.confirmed_constraints.get("attributes", {}), **constraints["attributes"]}
    validator = Constraints(data=combined)
    validator.is_valid(raise_exception=True)
    revoke_unconsumed(request, timezone.now())
    request.constraints = validator.validated_data
    request.confirmed_constraints = validator.validated_data
    request.version += 1
    request.status = "COMPARING" if inference_id else "MODEL_ERROR"
    request.candidates = []
    request.excluded = []
    request.model = None
    request.clarification = None
    request.active_inference_id = inference_id
    request.save(update_fields=["constraints", "confirmed_constraints", "version", "status", "candidates", "excluded", "model", "clarification", "active_inference_id"])
    comparison_event(request, inference_id)
    return request


def comparison_event(request, inference_id):
    if inference_id:
        event(request, "COMPARING", "Actual AI comparison started; no purchase is authorized.")
    else:
        event(request, "MODEL_ERROR", "Actual AI comparison is unavailable; the request is saved.", "MODEL_UNAVAILABLE")


def snapshot(request, offer, result, version, created_at, expires_at):
    return {"schema_version": 1, "owner_uuid": str(request.owner_uuid), "request_id": str(request.id),
            "request_version": request.version, "review_version": version, "quote_version": offer.version,
            "created_at": created_at.isoformat(), "expires_at": expires_at.isoformat(),
            "merchant": MERCHANT, "payee_ref": PAYEE_REF,
            "item": {"offer_id": str(offer.id), "sku": offer.sku, "variant_id": offer.variant_id,
                     "name": offer.name, "specification": result["specification"], "attributes": offer.attributes,
                     "pack_units": offer.pack_units, "packs": result["packs"], "individual_units": result["individual_units"]},
            "constraints": request.constraints, "unit_pack_price_cents": offer.price_cents,
            "fixture_tax_bps": offer.tax_bps, "shipping": SHIPPING, "terms": TERMS, "currency": "USD",
            **{name: result[name] for name in ("subtotal_cents", "shipping_cents", "tax_cents", "discount_cents", "total_cents")},
            "evidence": result["evidence"]}


@transaction.atomic
def create_review(owner, pk, expected_version, candidate_id):
    request = owned_request(owner, pk, lock=True)
    editable(request)
    request_version(request, expected_version)
    chosen = next((item for item in request.candidates if item["id"] == str(candidate_id)), None)
    if request.status != "READY" or not chosen:
        raise DomainError("INVALID_CANDIDATE", "Select an eligible candidate from the current comparison.", 400, request.id)
    revoke_unconsumed(request, timezone.now())
    try:
        offer = Offer.objects.select_for_update().get(id=chosen["offer_id"])
    except Offer.DoesNotExist:
        raise DomainError("REVIEW_CHANGED", "The selected offer is no longer available.", request_id=request.id)
    current, reasons = catalog.candidate(offer, request.constraints)
    if reasons or current != chosen:
        raise DomainError("REVIEW_CHANGED", "The offer changed. Compare the current facts again.", request_id=request.id)
    last = request.reviews.order_by("-version").first()
    version = last.version + 1 if last else 1
    now = timezone.now()
    expires = now + timedelta(minutes=10)
    payload = snapshot(request, offer, current, version, now, expires)
    review = Review.objects.create(request=request, offer=offer, version=version, request_version=request.version,
                                   quote_version=offer.version, snapshot=payload, digest=catalog.digest(payload),
                                   created_at=now, expires_at=expires)
    event(request, "REVIEWED", "Exact fictional purchase prepared for review.")
    return review


def validate_review(request, review, offer, now, own_hold=0):
    current = request.reviews.order_by("-version").values_list("id", flat=True).first()
    if current != review.id or review.request_version != request.version:
        raise DomainError("REVIEW_CHANGED", "This review was superseded. Inspect the current review.", request_id=request.id)
    if now >= review.expires_at:
        raise DomainError("REVIEW_EXPIRED", "This quote expired. Prepare a fresh review.", 410, request.id)
    result, reasons = catalog.candidate(offer, request.constraints, own_hold=own_hold)
    if reasons or offer.version != review.quote_version or catalog.digest(review.snapshot) != review.digest:
        raise DomainError("REVIEW_CHANGED", "Material offer facts changed. Prepare a fresh review.", request_id=request.id)
    current_payload = snapshot(request, offer, result, review.version, review.created_at, review.expires_at)
    if current_payload != review.snapshot:
        raise DomainError("REVIEW_CHANGED", "The exact purchase changed. Prepare a fresh review.", request_id=request.id)


@transaction.atomic
def approve(owner, pk, expected_version, expected_digest):
    # Resolve ownership before acquiring locks; immutable review IDs cannot move requests.
    try:
        reference = Review.objects.get(id=pk, request__owner_uuid=owner)
    except Review.DoesNotExist:
        raise Http404
    request = owned_request(owner, reference.request_id, lock=True)
    editable(request)
    approval = Approval.objects.select_for_update().filter(review=reference).first()
    offer = Offer.objects.select_for_update().get(id=reference.offer_id)
    now = timezone.now()
    if reference.version != expected_version or reference.digest != expected_digest:
        raise DomainError("REVIEW_CHANGED", "Review version or digest changed. Reload the current review.", request_id=request.id)
    validate_review(request, reference, offer, now)
    if approval:
        if approval.revoked_at:
            raise DomainError("REVIEW_CHANGED", "This approval was revoked. Inspect a fresh review.", request_id=request.id)
        if now >= approval.expires_at:
            raise DomainError("REVIEW_EXPIRED", "This approval expired. Inspect and approve a fresh review.", 410, request.id)
        return approval
    approval = Approval.objects.create(review=reference, approved_at=now,
                                       expires_at=min(reference.expires_at, now + timedelta(minutes=5)))
    event(request, "APPROVED", "The buyer approved this exact fictional cart; no payment was initiated.")
    return approval
