"""Default-off sandbox runtime; only a private, exact human permission allows POSTs.

There is no endpoint that writes permission. The team lead writes it only after
explicit action-time human consent. Read-only recovery does not need permission.
"""
import configparser
from datetime import datetime
import json
import os
from pathlib import Path
import stat
import uuid
from django.conf import settings
from django.utils import timezone
from . import checkout, inference, paypal
from .models import Approval, PaymentAttempt


def _private_text(path, limit, private_parent=False):
    path = Path(path)
    if path.parent.is_symlink() or path.parent.parent.is_symlink():
        raise ValueError
    if private_parent:
        parent = path.parent.stat()
        if path.parent.is_symlink() or parent.st_uid != os.getuid() or parent.st_mode & 0o077:
            raise ValueError
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > limit:
            raise ValueError
        raw = stream.read(limit + 1)
        if len(raw) > limit:
            raise ValueError
    return raw.decode("utf-8")


def configuration(readonly=False):
    # Importing this module or using the disabled application never reads .env.
    if not readonly and not settings.SPENDCONSENT_PAYPAL_ENABLED:
        return None
    try:
        parser = configparser.ConfigParser(interpolation=None)
        parser.optionxform = str
        parser.read_string("[runtime]\n" + _private_text(settings.SPENDCONSENT_PAYPAL_CREDENTIALS, 16384))
        values = {}
        for key in ("PAYPAL_ENV", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_MERCHANT_ID"):
            value = parser["runtime"].get(key, "").strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[key] = value
        if values["PAYPAL_ENV"] != "sandbox":
            return None
        # Constructor validates formats but makes no network request.
        paypal.SandboxClient(values["PAYPAL_CLIENT_ID"], values["PAYPAL_CLIENT_SECRET"], values["PAYPAL_MERCHANT_ID"])
        return values
    except (OSError, ValueError, UnicodeError, configparser.Error, paypal.PayPalUnavailable):
        return None


def merchant_ref():
    config = configuration()
    return config["PAYPAL_MERCHANT_ID"] if config else None


def _permission(approval, operation, config):
    try:
        permission = json.loads(_private_text(settings.SPENDCONSENT_PAYPAL_PERMISSION, 4096, private_parent=True),
                                object_pairs_hook=paypal._unique_object)
        review = approval.review
        expected = {"schema_version": 1, "human_authorized": True, "approval_id": str(approval.id),
                    "review_id": str(review.id), "review_digest": review.digest,
                    "request_id": str(review.request_id), "owner_uuid": str(review.request.owner_uuid),
                    "merchant_id": config["PAYPAL_MERCHANT_ID"], "currency": "USD",
                    "total_cents": review.snapshot["total_cents"]}
        if (not isinstance(permission, dict) or set(permission) != {*expected, "operations", "expires_at"}
                or any(type(permission[key]) is not type(value) or permission[key] != value for key, value in expected.items())
                or review.snapshot["payee_ref"] != config["PAYPAL_MERCHANT_ID"]
                or not isinstance(permission["operations"], list) or not permission["operations"]
                or len(permission["operations"]) != len(set(permission["operations"]))
                or not set(permission["operations"]) <= {"create", "capture"} or operation not in permission["operations"]):
            return False
        if review.request.reviews.order_by("-version").values_list("id", flat=True).first() != review.id:
            return False
        expiry = datetime.fromisoformat(permission["expires_at"])
        now = timezone.now()
        return (expiry.tzinfo is not None and not approval.revoked_at
                and approval.approved_at <= now < expiry <= approval.expires_at <= review.expires_at)
    except (OSError, ValueError, TypeError, KeyError, UnicodeError, OverflowError):
        return False


def allowed(approval, operation, config=None):
    if not settings.SPENDCONSENT_PAYPAL_ENABLED or not inference.ready():
        return False
    config = config or configuration()
    return bool(config and _permission(approval, operation, config))


def require(approval, operation):
    config = configuration()
    if not config or not allowed(approval, operation, config):
        raise checkout.DispatchDenied()
    return config


def _dispatch(operation, key):
    # Called after OAuth, immediately before the financial HTTP request. The
    # persisted operation key selects the intended attempt, never a browser ID.
    try:
        field = "create_key" if operation == "create" else "capture_key"
        attempt = PaymentAttempt.objects.select_related("approval__review__request").get(**{field: uuid.UUID(key)})
        if (attempt.state != ("CREATING" if operation == "create" else "CAPTURING")
                or attempt.pending_operation != operation or attempt.stop_requested):
            raise checkout.DispatchDenied()
        require(attempt.approval, operation)
    except (PaymentAttempt.DoesNotExist, ValueError, TypeError):
        raise checkout.DispatchDenied() from None


def provider(config):
    return paypal.SandboxClient(config["PAYPAL_CLIENT_ID"], config["PAYPAL_CLIENT_SECRET"], config["PAYPAL_MERCHANT_ID"],
                                before_financial=_dispatch)


def session_data(owner, current_request_id, ai_ready):
    config = configuration()
    enabled = False
    if config and ai_ready and current_request_id:
        approval = Approval.objects.select_related("review__request").filter(
            review__request_id=current_request_id, review__request__owner_uuid=owner).order_by("-review__version").first()
        if approval:
            enabled = _permission(approval, "capture" if hasattr(approval, "attempt") else "create", config)
    return {"paypal_ready": bool(config), "financial_actions_enabled": enabled}, (
        {"client_id": config["PAYPAL_CLIENT_ID"], "currency": "USD"} if config else None)
