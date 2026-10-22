"""Supplier-style display names for the same sixteen fictional SKUs.

Only names change (descriptive, no brands); prices, packs, specs and tax are
untouched. The offer-version trigger bumps each quote version, so any open
review of the old name must be reviewed again.
"""
from django.db import migrations

NAMES = {
    "CLOTH-A": "Everyday microfiber cloths 40 × 40 cm, 10-pack",
    "CLOTH-B": "Bulk microfiber cloths 40 × 40 cm, 20-pack",
    "CLOTH-C": "Compact microfiber cloths 30 × 30 cm, 10-pack",
    "CLOTH-D": "Trial microfiber cloths 40 × 40 cm, 7-pack",
    "BAG-A": "Everyday waste bags 30 L, 10-roll",
    "BAG-B": "Bulk waste bags 30 L, 20-roll",
    "BAG-C": "Large waste bags 50 L, 10-roll",
    "BAG-D": "Trial waste bags 30 L, 6-roll",
    "BOTTLE-A": "Everyday spray bottles 500 ml, 5-pack",
    "BOTTLE-B": "Bulk spray bottles 500 ml, 10-pack",
    "BOTTLE-C": "Mini spray bottles 250 ml, 5-pack",
    "BOTTLE-D": "Trial spray bottles 500 ml, 3-pack",
    "NOTEBOOK-A": "Everyday A5 notebooks, 5-pack",
    "NOTEBOOK-B": "Bulk A5 notebooks, 10-pack",
    "NOTEBOOK-C": "Office A4 notebooks, 5-pack",
    "NOTEBOOK-D": "Trial A5 notebooks, 3-pack",
}


def rename(apps, schema_editor):
    Offer = apps.get_model("purchases", "Offer")
    for sku, name in NAMES.items():
        Offer.objects.filter(sku=sku).update(name=name)


class Migration(migrations.Migration):
    dependencies = [("purchases", "0007_approval_link")]
    operations = [migrations.RunPython(rename, migrations.RunPython.noop)]
