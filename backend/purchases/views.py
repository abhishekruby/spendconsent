"""Same-origin anonymous API; financial dispatch requires exact private permission."""
import uuid
from django.core.exceptions import BadRequest, RequestDataTooBig
from django.http import Http404, JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework.authentication import CSRFCheck, BaseAuthentication
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler
from . import checkout, inference, runtime_paypal, serializers, services
from .models import Approval, PaymentAttempt, PurchaseRequest


def error(code, message, status, **extra):
    return JsonResponse({"error": {"code": code, "message": message, "retryable": False}, **extra}, status=status)


def csrf_failure(request, reason=""):
    return error("CSRF_FAILED", "Reload this page and retry with its CSRF token.", 403)


def bad_request(request, exception=None):
    return error("INVALID_REQUEST", "Invalid request.", 400)


def forbidden(request, exception=None):
    return error("FORBIDDEN", "This action is not permitted.", 403)


def not_found(request, exception=None):
    return error("NOT_FOUND", "This record or route was not found in this session.", 404)


def server_error(request):
    return error("SERVER_ERROR", "The request could not be completed. Reload its saved status.", 500)


def exception_handler(exc, context):
    if isinstance(exc, (BadRequest, RequestDataTooBig)):
        return Response({"error": {"code": "INVALID_REQUEST", "message": "Invalid or oversized request.", "retryable": False}}, status=400)
    if isinstance(exc, services.DomainError):
        payload = {"error": {"code": exc.code, "message": exc.message, "retryable": exc.retryable}}
        if exc.request_id:
            payload["request_id"] = exc.request_id
        return Response(payload, status=exc.status_code)
    if isinstance(exc, checkout.DispatchDenied):
        return Response({"error": {"code": "FINANCIAL_ACTIONS_DISABLED", "message": "This sandbox operation needs current permission for the exact approved cart.", "retryable": False}}, status=503)
    response = drf_exception_handler(exc, context)
    if response is None:
        # Do not expose traceback, model input, DB details, provider payload or credentials.
        return Response({"error": {"code": "SERVER_ERROR", "message": "The request could not be completed. Reload its saved status.", "retryable": False}}, status=500)
    code = {400: "INVALID_REQUEST", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 413: "INVALID_REQUEST", 415: "INVALID_REQUEST"}.get(response.status_code, "INVALID_REQUEST")
    response.data = {"error": {"code": code, "message": "The request was rejected.", "retryable": False,
                               **({"fields": response.data} if isinstance(exc, ValidationError) else {})}}
    return response


class AnonymousCSRF(BaseAuthentication):
    def authenticate(self, request):
        # DRF SessionAuthentication skips anonymous users; enforce its CSRF path for all.
        check = CSRFCheck(lambda request: None)
        check.process_request(request)
        if check.process_view(request, None, (), {}):
            raise services.DomainError("CSRF_FAILED", "Reload this page and retry with its CSRF token.", 403)
        return None


def endpoint(methods):
    def decorate(view):
        return api_view(methods)(authentication_classes([AnonymousCSRF])(view))
    return decorate


def owner(request):
    value = request.session.get("owner_uuid")
    if not value:
        raise services.DomainError("SESSION_REQUIRED", "Initialize this browser session before creating a request.", 403)
    return uuid.UUID(value)


def validated(schema, request):
    serializer = schema(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def approval_data(approval):
    now = timezone.now()
    status = "REVOKED" if approval.revoked_at else "EXPIRED" if now >= approval.expires_at else "APPROVED"
    if hasattr(approval, "attempt"):
        status = "CONSUMED"
    return {"id": str(approval.id), "review_id": str(approval.review_id), "approved_at": approval.approved_at,
            "expires_at": approval.expires_at, "status": status}


def review_data(review):
    payload = review.snapshot
    # Explicit allowlist excludes owner UUID, internal payee binding and structured snapshot.
    return {"id": str(review.id), "version": review.version, "request_version": review.request_version,
            "quote_version": review.quote_version, "digest": review.digest, "created_at": review.created_at,
            "expires_at": review.expires_at, "merchant": payload["merchant"],
            "item": {name: payload["item"][name] for name in ("offer_id", "sku", "variant_id", "name", "specification", "pack_units", "packs", "individual_units")},
            **{name: payload[name] for name in ("shipping", "terms", "currency", "subtotal_cents", "shipping_cents", "tax_cents", "discount_cents", "total_cents", "evidence")}}


def attempt_data(attempt):
    actions = []
    if attempt.state == "PAYMENT_REVIEW":
        actions = ["check_status"]
    elif attempt.state not in ("PAID", "STOPPED"):
        actions = ["check_status", "stop"]
        if attempt.state == "AWAITING_BUYER" and runtime_paypal.allowed(attempt.approval, "capture"):
            actions += ["open_paypal", "capture"]
    return {"id": str(attempt.id), "state": attempt.state, "pending_operation": attempt.pending_operation,
            "reason_code": attempt.reason_code, "created_at": attempt.created_at, "updated_at": attempt.updated_at,
            "provider_order_id": attempt.provider_order_id, "capture_id": attempt.capture_id,
            "total_cents": attempt.snapshot["total_cents"], "currency": attempt.snapshot["currency"], "allowed_actions": actions}


def request_data(request):
    review = request.reviews.order_by("-version").first()
    approval = Approval.objects.filter(review=review).first() if review else None
    attempt = request.attempts.order_by("-created_at").first()
    return {"id": str(request.id), "version": request.version, "status": request.status, "text": request.text,
            "constraints": request.constraints, "clarification": request.clarification, "candidates": request.candidates,
            "excluded": request.excluded, "review": review_data(review) if review else None,
            "approval": approval_data(approval) if approval else None, "attempt": attempt_data(attempt) if attempt else None,
            "events": [{"id": str(item.id), "type": item.type, "reason_code": item.reason_code,
                        "message": item.message, "created_at": item.created_at} for item in request.events.order_by("created_at", "id")],
            "model": request.model}


@endpoint(["GET"])
def session(request):
    if "owner_uuid" not in request.session:
        request.session["owner_uuid"] = str(uuid.uuid4())
    ai_ready = inference.ready()
    capabilities, paypal_config = runtime_paypal.session_data(owner(request), request.session.get("current_request_id"), ai_ready)
    return Response({"environment": "sandbox", "csrf_token": get_token(request),
                     "capabilities": {"ai_ready": ai_ready, **capabilities},
                     "current_request_id": request.session.get("current_request_id"), "paypal": paypal_config})


@endpoint(["POST"])
def requests(request):
    purchase, inference_id = inference.begin_submit(owner(request), validated(serializers.CreateRequest, request))
    request.session["current_request_id"] = str(purchase.id)
    # Django deliberately skips automatic session saving on 5xx. Persist refresh
    # recovery before returning the truthful MODEL_UNAVAILABLE 503 response.
    request.session.save()
    return comparison_response(inference.compare(owner(request), purchase, inference_id))


def comparison_response(purchase):
    if purchase.status == "MODEL_ERROR":
        latest = purchase.events.filter(type="MODEL_ERROR").order_by("-created_at").first()
        code = latest.reason_code if latest else "MODEL_ERROR"
        if code not in ("MODEL_UNAVAILABLE", "MODEL_ERROR", "MODEL_BUSY", "MODEL_TIMEOUT"):
            code = "MODEL_ERROR"
        raise services.DomainError(code, "Actual AI comparison did not complete. Your request was saved; confirm requirements to compare again.",
                                   429 if code == "MODEL_BUSY" else 503, purchase.id, retryable=code == "MODEL_BUSY")
    return Response(request_data(purchase), status=202 if purchase.status == "COMPARING" else 200)


@endpoint(["GET"])
def request_detail(request, pk):
    return Response(request_data(inference.recover(owner(request), pk)))


@endpoint(["POST"])
def clarify(request, pk):
    data = validated(serializers.ClarifyRequest, request)
    purchase = inference.clarify(owner(request), pk, **data)
    return comparison_response(purchase)


@endpoint(["POST"])
def reviews(request, pk):
    data = validated(serializers.CreateReview, request)
    review = services.create_review(owner(request), pk, **data)
    return Response(request_data(review.request), status=201)


@endpoint(["POST"])
def approve(request, pk):
    approval = services.approve(owner(request), pk, **validated(serializers.ApproveReview, request))
    return Response(request_data(approval.review.request))


@endpoint(["POST"])
def start_attempt(request, pk):
    validated(serializers.Empty, request)
    approval = Approval.objects.select_related("review__request").filter(id=pk, review__request__owner_uuid=owner(request)).first()
    if not approval:
        raise Http404
    existing = PaymentAttempt.objects.filter(approval=approval).first()
    if existing:
        attempt, status = checkout._result(existing)
    else:
        provider = runtime_paypal.provider(runtime_paypal.require(approval, "create"))
        attempt, status = checkout.start(owner(request), approval.id, provider)
    return Response({"attempt": attempt_data(attempt)}, status=status)


def owned_attempt(request, pk):
    try:
        return PaymentAttempt.objects.get(id=pk, request__owner_uuid=owner(request))
    except PaymentAttempt.DoesNotExist:
        raise Http404


@endpoint(["GET"])
def attempt_detail(request, pk):
    return Response({"attempt": attempt_data(owned_attempt(request, pk))})


@endpoint(["POST"])
def attempt_action(request, pk, action):
    if action not in ("capture", "stop", "reconcile"):
        raise Http404
    validated(serializers.Empty, request)
    attempt = owned_attempt(request, pk)
    if action == "stop":
        attempt, status = checkout.stop(owner(request), attempt.id)
    elif attempt.state in checkout.TERMINAL or (action == "capture" and attempt.state != "AWAITING_BUYER"):
        attempt, status = checkout._result(attempt)
    elif action == "reconcile" and not attempt.provider_order_id:
        # No configuration or provider lookup can resolve uncertain creation
        # without an ID. Keep the persisted manual-resolution state visible.
        attempt, status = checkout.reconcile(owner(request), attempt.id, None)
    else:
        config = runtime_paypal.require(attempt.approval, "capture") if action == "capture" else runtime_paypal.configuration(readonly=True)
        if not config:
            return Response({"error": {"code": "INTEGRATION_UNAVAILABLE", "message": "Read-only verification is unavailable. The stored outcome remains unresolved.", "retryable": False},
                             "attempt": attempt_data(attempt)}, status=503)
        provider = runtime_paypal.provider(config)
        attempt, status = (checkout.capture if action == "capture" else checkout.reconcile)(owner(request), attempt.id, provider)
    return Response({"attempt": attempt_data(attempt)}, status=status)
