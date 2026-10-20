"""Human action-time consent for ONE PayPal sandbox purchase (command line only).

Shows the newest valid in-app approval's exact cart and, only after a person
types its exact total, writes the private one-time permission that lets the
server create and capture that single sandbox order. There is still no HTTP
endpoint that writes permission. This command makes no PayPal request.
"""
import json
import os
import sys
import tempfile
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from purchases import runtime_paypal
from purchases.models import Approval


def write_private(path, data):
    """Owner-only file in an owner-only directory, replaced atomically."""
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.parent.is_symlink() or path.parent.stat().st_mode & 0o077:
        raise CommandError(f"{path.parent} must be an owner-only directory")
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")  # unique, 0600
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(data, stream, indent=2)
        os.replace(temporary, path)
    except BaseException:
        os.unlink(temporary)
        raise


class Command(BaseCommand):
    help = "Show the newest valid app approval and, after the exact total is typed, allow one sandbox purchase."

    def handle(self, **options):
        if not sys.stdin.isatty():
            raise CommandError("Run this in an interactive terminal; consent must be typed by a person.")
        config = runtime_paypal.configuration(readonly=True)
        if not config:
            raise CommandError("Private sandbox configuration (.env) is missing or invalid; nothing written.")
        now = timezone.now()
        approval = (Approval.objects.select_related("review__request", "review__offer")
                    .filter(revoked_at=None, expires_at__gt=now).order_by("-approved_at").first())
        if approval is None:
            raise CommandError("No unexpired approval. Approve the exact cart in the app first.")
        review, snapshot = approval.review, approval.review.snapshot
        if (review.request.reviews.order_by("-version").values_list("id", flat=True).first() != review.id
                or review.offer.version != review.quote_version or snapshot["payee_ref"] != config["PAYPAL_MERCHANT_ID"]):
            raise CommandError("That approval is no longer valid (newer review, changed offer or different payee). "
                               "Review and approve again in the app.")
        item, total = snapshot["item"], f"{snapshot['total_cents'] / 100:.2f}"
        expires = min(approval.expires_at, review.expires_at)
        self.stdout.write(
            f"PayPal SANDBOX purchase (test money only)\n"
            f"  Merchant: {snapshot['merchant']['name']}\n"
            f"  Item:     {item['name']} ({item['sku']})\n"
            f"  Quantity: {item['packs']} packs x {item['pack_units']} = {item['individual_units']} units\n"
            f"  Total:    USD {total} (items, delivery and fixture tax)\n"
            f"  Valid until {timezone.localtime(expires):%H:%M:%S}; one create and one capture only.")
        if input(f"Type {total} to allow this one sandbox purchase (anything else cancels): ").strip() != total:
            raise CommandError("Cancelled; nothing written.")
        if timezone.now() >= expires:
            raise CommandError("The approval expired while waiting; approve again in the app. Nothing written.")
        write_private(settings.SPENDCONSENT_PAYPAL_PERMISSION, {
            "schema_version": 1, "human_authorized": True, "approval_id": str(approval.id),
            "review_id": str(review.id), "review_digest": review.digest, "request_id": str(review.request_id),
            "owner_uuid": str(review.request.owner_uuid), "merchant_id": config["PAYPAL_MERCHANT_ID"],
            "currency": "USD", "total_cents": snapshot["total_cents"], "operations": ["create", "capture"],
            "expires_at": expires.isoformat()})
        self.stdout.write("Allowed. Start sandbox checkout in the app before it expires.")
