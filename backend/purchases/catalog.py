"""Trusted fictional catalog arithmetic; these functions are not model inference."""
import hashlib
import json
import uuid
from .models import Offer
from .serializers import Constraints, missing_constraints


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def specification(offer):
    values = offer.attributes
    if offer.category == "cloth":
        return f"{values['width_cm']} × {values['height_cm']} cm microfiber cloth"
    if offer.category == "bag":
        return f"{values['capacity_l']} L waste bag"
    if offer.category == "bottle":
        return f"{values['volume_ml']} ml spray bottle"
    return f"{values['paper_size']} notebook"


def quote(offer, constraints, own_hold=0):
    reasons = []
    if offer.category != constraints["category"]:
        reasons.append("Wrong category.")
    if offer.attributes != constraints["attributes"]:
        reasons.append("Declared specification does not match.")
    quantity = constraints["quantity"]
    packs, remainder = divmod(quantity, offer.pack_units)
    if remainder:
        reasons.append("Pack size cannot provide the exact individual-unit quantity.")
    if not offer.one_time:
        reasons.append("One-time terms are not available.")
    if packs > offer.stock_packs - offer.reserved_packs + own_hold:
        reasons.append("Insufficient available packs.")
    subtotal = offer.price_cents * packs
    # Integer half-up rounding of the declared synthetic tax, never binary floats.
    tax = (subtotal * offer.tax_bps + 5000) // 10000
    total = subtotal + offer.shipping_cents + tax
    if total > constraints["budget_cents"]:
        reasons.append("Full delivered total exceeds the budget.")
    return {"subtotal_cents": subtotal, "shipping_cents": offer.shipping_cents,
            "tax_cents": tax, "discount_cents": 0, "total_cents": total,
            "packs": packs, "individual_units": packs * offer.pack_units}, reasons


def candidate(offer, constraints):
    amounts, reasons = quote(offer, constraints)
    if reasons:
        return None, reasons
    spec = specification(offer)
    evidence = {"offer_id": str(offer.id), "offer_version": offer.version, "source": "sample_catalog",
                "summary": f"Fictional {offer.sku}: {spec}; {offer.pack_units} units per pack; fixed fixture tax and delivery."}
    return {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"sample:{offer.id}:{offer.version}:{digest(constraints)}")),
            "offer_id": str(offer.id), "sku": offer.sku, "name": offer.name, "specification": spec,
            "pack_units": offer.pack_units, "currency": "USD", **amounts,
            "reasons": ["Exact specification and individual-unit quantity; within the full delivered budget."],
            "evidence": [evidence]}, []


def compare_quotes(constraints, offers=None):
    validator = Constraints(data=constraints)
    validator.is_valid(raise_exception=True)
    constraints = validator.validated_data
    if missing_constraints(constraints):
        raise ValueError("Complete confirmed constraints are required before calculating quotes")
    if offers is None:
        offers = Offer.objects.filter(category=constraints["category"]).order_by("sku")
    eligible, excluded = [], []
    for offer in offers:
        result, reasons = candidate(offer, constraints)
        if result:
            eligible.append(result)
        else:
            excluded.append({"offer_id": str(offer.id), "name": offer.name, "reasons": reasons})
    return sorted(eligible, key=lambda item: (item["total_cents"], item["sku"]))[:3], excluded
