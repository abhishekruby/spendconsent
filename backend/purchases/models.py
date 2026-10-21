import uuid
from django.db import models
from django.db.models import F, Q

ACTIVE_STATES = ("CREATING", "AWAITING_BUYER", "CAPTURING", "VERIFYING", "UNKNOWN", "PAYMENT_REVIEW")
ATTEMPT_STATES = (*ACTIVE_STATES, "PAID", "STOPPED")
REQUEST_STATES = ("NEEDS_CLARIFICATION", "COMPARING", "READY", "NO_MATCH", "MODEL_ERROR", "CHECKOUT", "PAID")


class PurchaseRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_uuid = models.UUIDField()
    client_submission_id = models.UUIDField()
    submission_digest = models.CharField(max_length=64)
    text = models.TextField()
    constraints = models.JSONField(default=dict)
    confirmed_constraints = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=24, default="MODEL_ERROR")
    active_inference_id = models.UUIDField(null=True)
    candidates = models.JSONField(default=list)
    excluded = models.JSONField(default=list)
    clarification = models.JSONField(null=True)
    model = models.JSONField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner_uuid", "client_submission_id"], name="unique_owner_submission"),
            models.CheckConstraint(condition=Q(version__gte=1), name="positive_request_version"),
            models.CheckConstraint(condition=Q(status__in=REQUEST_STATES), name="valid_request_status"),
        ]


class Offer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(max_length=40, unique=True)
    variant_id = models.CharField(max_length=50)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=20)
    attributes = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    pack_units = models.PositiveIntegerField()
    price_cents = models.PositiveIntegerField()
    shipping_cents = models.PositiveIntegerField(default=0)
    tax_bps = models.PositiveIntegerField(default=1000)
    stock_packs = models.PositiveIntegerField(default=100)
    reserved_packs = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    one_time = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(pack_units__gte=1), name="positive_pack_units"),
            models.CheckConstraint(condition=Q(version__gte=1), name="positive_offer_version"),
            models.CheckConstraint(condition=Q(reserved_packs__lte=F("stock_packs")), name="reservation_within_stock"),
            models.CheckConstraint(condition=Q(tax_bps__lte=10000), name="bounded_fixture_tax"),
            models.CheckConstraint(condition=Q(category__in=("cloth", "bag", "bottle", "notebook")), name="valid_offer_category"),
        ]


class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(PurchaseRequest, on_delete=models.PROTECT, related_name="reviews")
    offer = models.ForeignKey(Offer, on_delete=models.PROTECT)
    version = models.PositiveIntegerField()
    request_version = models.PositiveIntegerField()
    quote_version = models.PositiveIntegerField()
    snapshot = models.JSONField()
    digest = models.CharField(max_length=64)
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["request", "version"], name="unique_review_version"),
            models.CheckConstraint(condition=Q(version__gte=1, request_version__gte=1, quote_version__gte=1), name="positive_review_versions"),
            models.CheckConstraint(condition=Q(expires_at__gt=F("created_at")), name="review_expiry_after_creation"),
        ]


class Approval(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review = models.OneToOneField(Review, on_delete=models.PROTECT, related_name="approval")
    approved_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(expires_at__gt=F("approved_at")), name="approval_expiry_after_creation")]


class PaymentAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(PurchaseRequest, on_delete=models.PROTECT, related_name="attempts")
    approval = models.OneToOneField(Approval, on_delete=models.PROTECT, related_name="attempt")
    state = models.CharField(max_length=24)
    pending_operation = models.CharField(max_length=16, null=True)
    reason_code = models.CharField(max_length=40, null=True)
    provider_order_id = models.CharField(max_length=80, null=True, unique=True)
    capture_id = models.CharField(max_length=80, null=True, unique=True)
    create_key = models.UUIDField(default=uuid.uuid4, unique=True)
    capture_key = models.UUIDField(default=uuid.uuid4, unique=True)
    snapshot = models.JSONField()
    create_payload = models.JSONField(default=dict)
    capture_payload = models.JSONField(default=dict)
    stock_hold_packs = models.PositiveIntegerField(default=0)
    create_dispatched_at = models.DateTimeField(null=True)
    capture_dispatched_at = models.DateTimeField(null=True)
    stop_requested = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["request"], condition=Q(state__in=(*ACTIVE_STATES, "PAID")), name="one_active_attempt_per_request"),
            models.CheckConstraint(condition=Q(state__in=ATTEMPT_STATES), name="valid_attempt_state"),
            models.CheckConstraint(condition=Q(pending_operation__isnull=True) | Q(pending_operation__in=("create", "capture", "verification")), name="valid_pending_operation"),
        ]


class DecisionEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(PurchaseRequest, on_delete=models.PROTECT, related_name="events")
    attempt = models.ForeignKey(PaymentAttempt, on_delete=models.PROTECT, null=True)
    type = models.CharField(max_length=32)
    reason_code = models.CharField(max_length=40, null=True)
    message = models.CharField(max_length=240)
    created_at = models.DateTimeField(auto_now_add=True)


class ApprovalLink(models.Model):
    """A shareable request for the owner to approve and pay one exact review.

    Only the SHA-256 of the random token is stored. The link grants nothing the
    review's own owner could not do, for that one cart only; every domain check
    (latest review, digest, expiry, material change, consent) still applies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review = models.ForeignKey(Review, on_delete=models.PROTECT, related_name="links")
    token_sha256 = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
