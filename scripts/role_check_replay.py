"""Replay the app's number role check (inference._role_checked) over a qualification report.

No inference: uses each case's text and the constraints the model produced. Counts
values the check would drop that the expected answer contains (must be 0).
Usage: .venv/bin/python scripts/role_check_replay.py
"""
import json, sys
sys.path.insert(0, "backend"); sys.path.insert(0, "scripts")

import ai_application_eval as ev
from purchases.inference import _role_checked
cases = {c["id"]: c for suite in ev.load_cases().values() for c in suite}
report = json.load(open("docs/evidence/ai-application-qualification-a01b9f9.json"))
wrong_drop = caught = rows = 0
for suite in report["suites"].values():
    for r in suite["results"]:
        rows += 1
        case = cases[r["case"]]; text = case["input"]["text"]; got = r["constraints"] or {}; want = case["expected"]["canonical_constraints"]
        for key, native in (("quantity", got.get("quantity")), ("budget", None if got.get("budget_cents") is None else got["budget_cents"] / 100)):
            if native is None: continue
            kept = _role_checked({key: native}, text)[key] is not None or (key == "budget" and _role_checked({key: (got["budget_cents"] + 1) / 100}, text)[key] is not None)
            field = "quantity" if key == "quantity" else "budget_cents"
            if not kept:
                if field in want: wrong_drop += 1; print("WOULD WRONGLY DROP", r["case"], key, native, "|", text[:90])
                else: caught += 1; print("WOULD CATCH", r["case"], key, native)
print(f"rows={rows} wrong_drops={wrong_drop} catches={caught}")
sys.exit(1 if wrong_drop else 0)
