"""Sixteen fictional SKUs; fixed synthetic tax/delivery, never live supplier data."""
import uuid
from django.db import migrations

# sku, name, category, declared attributes, units/pack, pack price cents, delivery cents
ROWS = [
    ("CLOTH-A", "Sample microfiber cloths A", "cloth", {"width_cm": 40, "height_cm": 40}, 10, 900, 800),
    ("CLOTH-B", "Sample microfiber cloths B", "cloth", {"width_cm": 40, "height_cm": 40}, 20, 1900, 0),
    ("CLOTH-C", "Sample smaller cloths C", "cloth", {"width_cm": 30, "height_cm": 30}, 10, 800, 500),
    ("CLOTH-D", "Sample seven-pack cloths D", "cloth", {"width_cm": 40, "height_cm": 40}, 7, 700, 400),
    ("BAG-A", "Sample 30 L bags A", "bag", {"capacity_l": 30}, 10, 500, 300),
    ("BAG-B", "Sample 30 L bags B", "bag", {"capacity_l": 30}, 20, 900, 0),
    ("BAG-C", "Sample 50 L bags C", "bag", {"capacity_l": 50}, 10, 700, 300),
    ("BAG-D", "Sample 30 L bags D", "bag", {"capacity_l": 30}, 6, 350, 300),
    ("BOTTLE-A", "Sample 500 ml spray bottles A", "bottle", {"volume_ml": 500}, 5, 1000, 400),
    ("BOTTLE-B", "Sample 500 ml spray bottles B", "bottle", {"volume_ml": 500}, 10, 1800, 0),
    ("BOTTLE-C", "Sample 250 ml spray bottles C", "bottle", {"volume_ml": 250}, 5, 800, 400),
    ("BOTTLE-D", "Sample 500 ml spray bottles D", "bottle", {"volume_ml": 500}, 3, 650, 300),
    ("NOTEBOOK-A", "Sample A5 notebooks A", "notebook", {"paper_size": "A5"}, 5, 1000, 400),
    ("NOTEBOOK-B", "Sample A5 notebooks B", "notebook", {"paper_size": "A5"}, 10, 1800, 0),
    ("NOTEBOOK-C", "Sample A4 notebooks C", "notebook", {"paper_size": "A4"}, 5, 1400, 400),
    ("NOTEBOOK-D", "Sample A5 notebooks D", "notebook", {"paper_size": "A5"}, 3, 650, 300),
]


def seed(apps, schema_editor):
    Offer = apps.get_model("purchases", "Offer")
    for sku, name, category, attributes, units, price, shipping in ROWS:
        Offer.objects.get_or_create(sku=sku, defaults={
            "id": uuid.uuid5(uuid.NAMESPACE_URL, f"spendconsent:fictional:{sku}"),
            "variant_id": f"{sku}-standard", "name": name, "category": category,
            "attributes": attributes, "pack_units": units, "price_cents": price,
            "shipping_cents": shipping, "tax_bps": 1000, "stock_packs": 100,
            "description": "Fictional sample product. Tax and delivery are fixed demonstration fixtures.",
        })


class Migration(migrations.Migration):
    dependencies = [("purchases", "0001_initial")]
    # Reverse is deliberately non-destructive: rolling code back does not erase catalog evidence.
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
