"""One-click answers for what a request is missing, read from the catalog (never the model).

Sizes the catalog sells, amounts its packs can make exactly, the cheapest exact
fit for a missing budget, and "did you mean" when a size belongs to another item.
"""
from math import ceil
import re
from . import catalog
from .models import Offer
from .serializers import ATTRIBUTES

NAMES = {"cloth": "Microfiber cloths", "bag": "Waste bags", "bottle": "Spray bottles", "notebook": "Notebooks"}
# "40 x 40 cm", "40 by 40 cm", and "40 into 40 cm" as speech-to-text writes it.
CLOTH_SIZE = re.compile(r"(\d{1,3})\s*(?:cm)?\s*(?:x|×|\*|by|into)\s*(\d{1,3})\s*cm\b", re.I)


def size_label(category, attributes):
    return {"cloth": lambda a: f"{a['width_cm']} × {a['height_cm']} cm", "bag": lambda a: f"{a['capacity_l']} L",
            "bottle": lambda a: f"{a['volume_ml']} ml", "notebook": lambda a: a["paper_size"]}[category](attributes)


def suggestions(purchase):
    c = purchase.constraints or {}
    category, attributes = c.get("category"), c.get("attributes") or {}
    out = {"sizes": [], "category_hint": None, "quantities": [], "budgets": [], "cheapest_cents": None}
    if purchase.status not in ("NEEDS_CLARIFICATION", "NO_MATCH"):
        return out
    offers = list(Offer.objects.order_by("sku"))
    sized = category in ATTRIBUTES and set(ATTRIBUTES[category]) <= set(attributes)
    if category in ATTRIBUTES:
        mine = [o for o in offers if o.category == category]
        if not sized or not any(o.attributes == attributes for o in mine):
            seen = []
            for offer in sorted(mine, key=lambda o: [str(v).zfill(6) for v in o.attributes.values()]):
                if offer.attributes not in seen:
                    seen.append(offer.attributes)
            out["sizes"] = [{"label": size_label(category, a), "attributes": a} for a in seen]
        packs = {o.pack_units for o in mine if not sized or o.attributes == attributes}
        # Missing, or an amount no pack size can make exactly (e.g. 1 bottle sold in 3s, 5s, 10s).
        if packs and ("quantity" not in c or not any(c["quantity"] % p == 0 for p in packs)):
            out["quantities"] = sorted({p * k for p in packs for k in (1, 2, 5)})[:6]
        if "quantity" in c and sized:
            rows, _ = catalog.compare_quotes({"category": category, "quantity": c["quantity"], "attributes": attributes,
                                              "budget_cents": 1000000, "currency": "USD", "one_time": True}, mine)
            # A missing budget, or one below the cheapest exact fit.
            if rows and ("budget_cents" not in c or rows[0]["total_cents"] > c["budget_cents"]):
                cheapest = rows[0]["total_cents"]
                first = ceil(cheapest / 100) * 100
                out["cheapest_cents"] = cheapest
                out["budgets"] = sorted({first, max(first + 500, ceil(cheapest * 1.25 / 1000) * 1000), max(first + 1000, ceil(cheapest * 1.6 / 1000) * 1000)})
    match = CLOTH_SIZE.search(purchase.text)
    if match and category != "cloth":
        cloth = {"width_cm": int(match[1]), "height_cm": int(match[2])}
        if any(o.category == "cloth" and o.attributes == cloth for o in offers):
            out["category_hint"] = {"category": "cloth", "label": f"{NAMES['cloth']}, {size_label('cloth', cloth)}", "attributes": cloth}
    return out
