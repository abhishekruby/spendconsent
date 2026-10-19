# Manual versus assisted comparison protocol

Prepared 19 October 2026, before any timed study. **No timing or participant
results have been collected.** This is the five-task effort check required by
[PRD section 8](PRD.md#8-success-measures-and-release-gates), separate from AI
accuracy qualification. Developer-only or agent-operated runs are preliminary;
they cannot establish buyer usability, market fit or willingness to pay. No
merchant contacts or interviews are prerequisites.

Freeze this document at its reviewed private commit before timing. These tasks
were derived from the sample seed and arithmetic, without reading the fresh AI
holdout. Do not tune model prompts on these answers or count them toward the AI
qualification gate. A changed task, catalog, protocol or answer starts a new
documented study version; preserve earlier results, including failures.

## Conditions and task sheet

Use the same sixteen fictional offers for both methods, one sample merchant,
USD, one-time terms, stock 100 packs per offer, zero reservations, quote version
1, and no discounts. Delivery is charged once per order. Fixture tax is 10% of
the item subtotal, rounded half-up to the nearest cent. It excludes delivery.
One offer per purchase; exact individual quantities are required. No mixed
SKUs, rounding up packs, substitution or changed budgets. These are synthetic
prices and tax rules, not supplier data or tax advice.

Give the participant only this task/catalog sheet and the instructions below;
keep the frozen answer key and prior results out of view. Ask them to find the
lowest full delivered total among eligible offers, or explain why none qualify.
Every task has complete requirements; unnecessary clarification adds effort.

| Task | Request, identical for manual and assisted methods |
| --- | --- |
| U1 | Exactly 20 microfiber cloths, 40 × 40 cm, for at most USD $28.00 including tax and delivery. One-time purchase only. |
| U2 | Exactly 60 waste bags, 30 L each, for at most USD $35.00 including tax and delivery. One-time purchase only. |
| U3 | Exactly 15 spray bottles, 500 ml each, for at most USD $39.00 including tax and delivery. One-time purchase only. |
| U4 | Exactly 30 A5 notebooks, for at most USD $60.00 including tax and delivery. One-time purchase only. |
| U5 | Exactly 21 microfiber cloths, 40 × 40 cm, for at most USD $27.00 including tax and delivery. One-time purchase only. |

| SKU | Declared specification | Units/pack | Pack price USD | Delivery USD |
| --- | --- | ---: | ---: | ---: |
| CLOTH-A | Microfiber cloth, 40 × 40 cm | 10 | 9.00 | 8.00 |
| CLOTH-B | Microfiber cloth, 40 × 40 cm | 20 | 19.00 | 0.00 |
| CLOTH-C | Microfiber cloth, 30 × 30 cm | 10 | 8.00 | 5.00 |
| CLOTH-D | Microfiber cloth, 40 × 40 cm | 7 | 7.00 | 4.00 |
| BAG-A | Waste bag, 30 L | 10 | 5.00 | 3.00 |
| BAG-B | Waste bag, 30 L | 20 | 9.00 | 0.00 |
| BAG-C | Waste bag, 50 L | 10 | 7.00 | 3.00 |
| BAG-D | Waste bag, 30 L | 6 | 3.50 | 3.00 |
| BOTTLE-A | Spray bottle, 500 ml | 5 | 10.00 | 4.00 |
| BOTTLE-B | Spray bottle, 500 ml | 10 | 18.00 | 0.00 |
| BOTTLE-C | Spray bottle, 250 ml | 5 | 8.00 | 4.00 |
| BOTTLE-D | Spray bottle, 500 ml | 3 | 6.50 | 3.00 |
| NOTEBOOK-A | Notebook, A5 | 5 | 10.00 | 4.00 |
| NOTEBOOK-B | Notebook, A5 | 10 | 18.00 | 0.00 |
| NOTEBOOK-C | Notebook, A4 | 5 | 14.00 | 4.00 |
| NOTEBOOK-D | Notebook, A5 | 3 | 6.50 | 3.00 |

## Procedure and timing

Use a neutral stopwatch and ordinary calculator. No benchmark framework is
needed. Record participant pseudonym, operator type (buyer, developer or agent),
study/source commit, date, laptop, browser, model/runtime configuration and
whether the model was already warm. Record startup separately; never silently
exclude a slow task. For any later actual-app study, verify that its catalog
matches this sheet and disclose any concurrent laptop work.

1. Use one untimed practice request with different values to learn each method.
   Explain how to read pack units, tax and delivery without revealing answers.
2. For participant 1, run U1 manual then assisted, U2 assisted then manual, U3
   manual then assisted, U4 assisted then manual, U5 manual then assisted.
   Reverse each pair's order for participant 2, and alternate thereafter.
   Both methods receive exactly the same request and catalog. Repeated requests
   create learning effects; alternating order reduces but does not remove them.
3. Manual: start timing when the request is revealed. Read the catalog sheet,
   reject mismatched specifications and non-divisible packs, use the calculator
   for subtotal + fixture tax + delivery, compare eligible totals, then review
   and write the chosen SKU, specification, packs, exact units, currency,
   subtotal, tax, delivery, discount and full total with one-time terms. For no
   match, write the limiting reasons. Reading and final checking count as work.
4. Assisted: start timing when the same request is revealed. Enter it into the
   actual local application, inspect its comparison, resolve any unnecessary
   clarification, select the cheapest eligible offer, and check the resulting
   review against the original request. Write the same answer fields as the
   manual method. For no match, inspect and write the explanation. Stop before
   approval or checkout. No payment, order creation or financial action belongs
   to this study. A mock response cannot stand in for actual assisted inference.
5. Stop the task timer when the participant declares the answer final. Include
   typing, reading, calculator use, selection, review and all correction effort
   in **active seconds**. Pause the active clock only during passive waiting
   with no task work. Record **model wait**, **other passive wait**, and total
   **wall seconds** separately. If reading or correcting during inference,
   count that interval as active, not passive wait. Keep raw start/end and pause
   timestamps so active + passive waits reconcile to wall time. Record the
   application's model elapsed time separately when available; it may overlap
   active work and must not be subtracted a second time.
6. The observer grades against the frozen key only after the answer is final.
   Record any correction/retry, incorrect answer, failure, timeout or abandoned
   task. Never replace a failed attempt with a successful rerun. Log interruption
   time separately; an interrupted pair is incomplete, not a faster result.

If actual AI/application readiness is unavailable, record the assisted method as
blocked and leave timings blank. A developer or agent may check arithmetic and
rehearse the procedure now, but that is not a measured usability result. Do not
enable application inference solely because this protocol exists.

## Frozen answer key — observer only

All amounts are USD. Discounts are $0.00 and all selected terms are one-time.
The answer includes the requested specification, which must not be substituted.

| Task | Correct outcome and specification | Packs × units/pack | Subtotal | Tax | Delivery | Full total |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| U1 | CLOTH-B; 40 × 40 cm microfiber cloth | 1 × 20 = 20 | 19.00 | 1.90 | 0.00 | 20.90 |
| U2 | BAG-B; 30 L waste bag | 3 × 20 = 60 | 27.00 | 2.70 | 0.00 | 29.70 |
| U3 | BOTTLE-A; 500 ml spray bottle | 3 × 5 = 15 | 30.00 | 3.00 | 4.00 | 37.00 |
| U4 | NOTEBOOK-B; A5 notebook | 3 × 10 = 30 | 54.00 | 5.40 | 0.00 | 59.40 |
| U5 | NO_MATCH; no eligible 40 × 40 cm cloth offer within $27.00 | — | — | — | — | — |

U1 also permits CLOTH-A at $27.80 (2 packs, $18.00 subtotal + $1.80 tax +
$8.00 delivery), but it is not cheapest. CLOTH-C has the wrong size; CLOTH-D
cannot make exactly 20 units. U2 excludes BAG-A at $36.00 and BAG-D at $41.50
as over budget, and BAG-C for wrong capacity. U3 also permits BOTTLE-D at
$38.75 (5 packs, $32.50 subtotal + $3.25 tax + $3.00 delivery), but it is not
cheapest. BOTTLE-B cannot make exactly 15 units; BOTTLE-C has the wrong volume.
U4 excludes NOTEBOOK-A at $70.00 and NOTEBOOK-D at $74.50 as over budget,
and NOTEBOOK-C for wrong paper size. U5's only exact-quantity, correct-size
offer is CLOTH-D: 3 packs × 7 = 21, $21.00 subtotal + $2.10 tax + $4.00
delivery = **$27.10**, which exceeds the budget by $0.10. CLOTH-A/B cannot
make exactly 21 units; CLOTH-C also has the wrong size. No rounding or fallback
purchase is correct.

Grade each attempt independently for (a) exact specification/category/units,
currency and one-time terms; (b) subtotal/tax/delivery/discount/full total;
(c) cheapest eligible choice or justified no match. A complete correct answer
passes all three. Count incorrect specification attempts and incorrect total
attempts separately, at most one in each column per attempt; keep the actual
mistakes in notes. A more expensive eligible offer is a selection error even
when its specification and arithmetic are correct. Missing required fields are
errors, not assumed correct. An invented purchase for U5 fails; a no-match answer
must identify the $27.10 full total or otherwise correctly exclude every offer.

## Blank results and decision

Use one table per participant. Every numeric cell remains unmeasured until an
actual timed attempt. Attach raw timestamps/answers and observations to the
reviewed study record; do not store private identity or financial information.

| Task | Order | Manual active / wall s | Assisted active / wall s | Assisted passive model / other wait s | Manual / assisted spec errors | Manual / assisted total errors | Manual / assisted complete correct | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U1 | M → A | — | — | — | — | — | — | Unmeasured |
| U2 | A → M | — | — | — | — | — | — | Unmeasured |
| U3 | M → A | — | — | — | — | — | — | Unmeasured |
| U4 | A → M | — | — | — | — | — | — | Unmeasured |
| U5 | M → A | — | — | — | — | — | — | Unmeasured |

For each complete five-pair run, report both median active times and
`100 × (median_manual_active − median_assisted_active) / median_manual_active`.
The manual median must be positive. The target is at least **30% lower median
active comparison/review time**, with no increase in specification or total
errors. Report complete-correct counts and selection errors alongside that
target; an incorrect fast answer is not successful task completion. Preserve all
attempts in the calculation and report failed/incomplete tasks explicitly; do not
claim the target from a selected subset. An unfinished run has no five-task
decision. Also report each method's median wall time, assisted passive model and
other wait, available model elapsed times, startup and worst wall time. Active
effort savings do not imply shorter elapsed time.

Report each participant separately before any aggregate. A developer/agent run
must remain labeled preliminary even if the target is met. Five synthetic pairs
are a small directional check with learning effects; they do not establish
general buyer time savings, production accuracy or commercial demand. A failed
comparison calls for a recorded product revision, not revised answer keys.

## Offline answer verification

The answers above were hand-calculated and checked against `catalog.compare_quotes`
using sixteen unsaved seed offers with Django's dummy database backend. That
check uses no model, network or actual PostgreSQL connection. Reproduce from
the repository root before accepting a changed study version:

```bash
.venv/bin/python - <<'PY'
import importlib
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path.cwd() / "backend"))
from django.conf import settings
settings.configure(INSTALLED_APPS=["purchases"],
    DATABASES={"default": {"ENGINE": "django.db.backends.dummy"}})
import django
django.setup()
from purchases import catalog
rows = importlib.import_module("purchases.migrations.0002_sample_catalog").ROWS
offers = [SimpleNamespace(id=uuid.uuid5(uuid.NAMESPACE_URL, f"spendconsent:fictional:{sku}"),
    sku=sku, name=name, category=category, attributes=attributes, pack_units=units,
    price_cents=price, shipping_cents=delivery, tax_bps=1000, stock_packs=100,
    reserved_packs=0, one_time=True, version=1)
    for sku, name, category, attributes, units, price, delivery in rows]
# Expected tuples are SKU, packs, individual units, subtotal, tax, delivery, total.
tasks = [
    ("cloth", {"width_cm": 40, "height_cm": 40}, 20, 2800,
     [("CLOTH-B", 1, 20, 1900, 190, 0, 2090), ("CLOTH-A", 2, 20, 1800, 180, 800, 2780)]),
    ("bag", {"capacity_l": 30}, 60, 3500, [("BAG-B", 3, 60, 2700, 270, 0, 2970)]),
    ("bottle", {"volume_ml": 500}, 15, 3900,
     [("BOTTLE-A", 3, 15, 3000, 300, 400, 3700), ("BOTTLE-D", 5, 15, 3250, 325, 300, 3875)]),
    ("notebook", {"paper_size": "A5"}, 30, 6000, [("NOTEBOOK-B", 3, 30, 5400, 540, 0, 5940)]),
    ("cloth", {"width_cm": 40, "height_cm": 40}, 21, 2700, []),
]
keys = ("sku", "packs", "individual_units", "subtotal_cents", "tax_cents", "shipping_cents", "total_cents")
with patch("socket.create_connection", side_effect=AssertionError("Offline only")):
    for category, attributes, quantity, budget, expected in tasks:
        constraints = dict(category=category, attributes=attributes, quantity=quantity,
            budget_cents=budget, currency="USD", one_time=True)
        eligible, excluded = catalog.compare_quotes(constraints, offers)
        assert [tuple(row[key] for key in keys) for row in eligible] == expected
        assert all(row["discount_cents"] == 0 for row in eligible)
        if not expected:
            amounts, reasons = catalog.quote(next(o for o in offers if o.sku == "CLOTH-D"), constraints)
            assert amounts["total_cents"] == 2710
            assert reasons == ["Full delivered total exceeds the budget."]
print("PASS: five frozen usability answers; dummy DB, no inference/network")
PY
```

Seed SHA-256: `3be8b3c85cb3e7f1a555c111472cc0fbc48afc94c596ea63df46ef70c873ffc3`.
Catalog SHA-256: `96bd9d5cfdf1a5cbb0a84c6f3911c6c202621fe94517ae81728359e444758fa2`.
Both match the source reviewed at private checkpoint `a9fdb54`. The runnable
answer check is arithmetic verification, **not a timed study result**.
