#!/usr/bin/env python3
"""Previously measured synthetic regressions; --run uses local real AI.

Expected constraints/results are scoring data only, never model context.
Keep every failed row and timing. No payments or raw model responses.
"""
import argparse
import hashlib
import json
from pathlib import Path
import statistics

from ai_probe import ENDPOINT, MODEL, MODEL_PROFILES, constraints, experiment_configuration, probe, search_catalog


# Originally frozen before prompt-only inference; now measured regression cases.
CASES = [
    ("sixty_words", "I need sixty microfiber cloths, each 40 by 40 cm, at most eighty US dollars including tax and delivery, one-time only.", constraints(quantity=60, budget_cents=8000), "READY", "B"),
    ("eighty", "Find exactly 80 microfiber cloths, each 40 by 40 cm, with a maximum budget of $90 USD including tax and delivery. One-time purchase only.", constraints(quantity=80, budget_cents=9000), "READY", "B"),
    ("boundary_exact", "Exactly 10 microfiber cloths, 40 by 40 cm, at most $17.90 USD including tax and delivery, one-time only.", constraints(quantity=10, budget_cents=1790), "READY", "A"),
    ("boundary_low", "Exactly 10 microfiber cloths, 40 by 40 cm, at most $17.89 USD including tax and delivery, one-time only.", constraints(quantity=10, budget_cents=1789), "NO_MATCH", None),
    ("fifty", "Please find exactly 50 microfiber cloths sized 40 by 40 cm. Spend no more than $60 USD total including tax and delivery, one-time only.", constraints(quantity=50), "READY", "A"),
    ("small_twenty", "Exactly 20 microfiber cloths sized 30 by 30 cm, at most $22.60 USD including tax and delivery, one-time only.", constraints(quantity=20, size_cm=30, budget_cents=2260), "READY", "C"),
    ("missing_budget", "Find exactly 40 microfiber cloths sized 40 by 40 cm, priced in USD including tax and delivery, one-time only.", constraints(budget_cents=None), "NEEDS_CLARIFICATION", None),
    ("missing_terms", "Find exactly 40 microfiber cloths sized 40 by 40 cm, at most $60 USD including tax and delivery.", constraints(one_time=None), "NEEDS_CLARIFICATION", None),
    ("recurring", "Find exactly 40 microfiber cloths sized 40 by 40 cm, at most $60 USD including tax and delivery. This must be a recurring purchase, not a one-time purchase.", constraints(one_time=False), "NO_MATCH", None),
    ("euro", "Exactly 20 microfiber cloths sized 40 by 40 cm, at most 25 euros including tax and delivery, one-time only.", constraints(quantity=20, budget_cents=2500, currency="EUR"), "NO_MATCH", None),
]


def self_test():
    assert len(CASES) == len({case[0] for case in CASES}) == 10
    totals = (6270, 8360, 1790, None, 5750, 2260, None, None, None, None)
    for (_, _, arguments, status, offer), total in zip(CASES, totals):
        result = search_catalog(arguments)
        assert result["status"] == status
        best = result["eligible"][0] if result["eligible"] else None
        assert (best["offer_id"] if best else None) == offer
        assert (best["total_cents"] if best else None) == total
    print("Ten frozen holdout expectations and totals passed; no inference or network.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--thinking-extraction", action="store_true",
                        help="Enable bounded thinking for extraction; these cases are now regressions.")
    parser.add_argument("--model-profile", choices=MODEL_PROFILES, default="qwen3-1.7b")
    parser.add_argument("--output", type=Path, default=Path("docs/evidence/ai-holdout.json"))
    args = parser.parse_args()
    if args.thinking_extraction and args.model_profile != "qwen3-1.7b":
        parser.error("the 4B trial is non-thinking; do not combine profiles")
    if args.self_test:
        self_test()
    if not args.run:
        return
    if args.output.exists() or args.output.name.startswith("ai-probe"):
        parser.error("choose a new holdout output; existing evidence and baseline paths are protected")
    source = Path(__file__).resolve()
    report = {"model": MODEL_PROFILES[args.model_profile].get("model", MODEL), "endpoint": ENDPOINT, "synthetic_cases": True,
              "payment_calls": 0, "holdout": False, "regression": True,
              "configuration": experiment_configuration(args.thinking_extraction, args.model_profile),
              "probe_sha256": hashlib.sha256(source.with_name("ai_probe.py").read_bytes()).hexdigest(),
              "holdout_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "results": []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as output:
        output.write(json.dumps(report, indent=2) + "\n")
    for repetition in (1, 2):
        for case in CASES:
            result = {"repetition": repetition,
                      **probe(case, thinking_extraction=args.thinking_extraction,
                              model_profile=args.model_profile)}
            report["results"].append(result)
            args.output.write_text(json.dumps(report, indent=2) + "\n")
            print(case[0], repetition, result["passed"], result["elapsed_seconds"],
                  result.get("error", ""), flush=True)
    rows = report["results"]
    report["summary"] = {"passed": sum(row["passed"] for row in rows), "total": len(rows),
        "first_request_seconds": rows[0]["elapsed_seconds"],
        "warm_median_seconds": statistics.median(row["elapsed_seconds"] for row in rows[1:]),
        "maximum_seconds": max(row["elapsed_seconds"] for row in rows)}
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report["summary"]))


if __name__ == "__main__":
    main()
