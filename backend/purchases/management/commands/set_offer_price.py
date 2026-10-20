"""Local operator tool for the fictional sample merchant: change one pack price.

Command line only (no HTTP endpoint). The database trigger bumps the offer
version, so existing reviews/approvals for that offer must be reviewed again.
Used to demonstrate the changed-price block; never touches PayPal.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from purchases.models import Offer


class Command(BaseCommand):
    help = "Set a sample offer's pack price in integer USD cents (bumps its quote version)."

    def add_arguments(self, parser):
        parser.add_argument("sku")
        parser.add_argument("price_cents", type=int)

    def handle(self, sku, price_cents, **options):
        if not 1 <= price_cents <= 1_000_000:
            raise CommandError("price_cents must be between 1 and 1000000")
        with transaction.atomic():
            offer = Offer.objects.select_for_update().filter(sku=sku).first()
            if offer is None:
                raise CommandError(f"Unknown sample SKU {sku!r}")
            old, offer.price_cents = offer.price_cents, price_cents
            offer.save(update_fields=["price_cents"])
            offer.refresh_from_db()
        self.stdout.write(f"{sku}: {old} -> {price_cents} cents; quote version {offer.version}")
