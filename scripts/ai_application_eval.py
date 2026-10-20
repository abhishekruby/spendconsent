#!/usr/bin/env python3
"""Frozen actual-application AI qualification; synthetic in-memory catalog only.

--self-test is offline. --prepare writes a source/config checkpoint without
inference. --run requires that checkpoint and committed source, and calls the
actual purchases.agent.compare. Never invokes financial code or application DB.
"""
import argparse
import ast
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
import re
from pathlib import Path
import socket
import statistics
import subprocess
import sys
import tempfile
import time
import uuid
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))
from django.conf import settings
settings.configure(INSTALLED_APPS=["purchases"], USE_I18N=False,
                   DATABASES={"default": {"ENGINE": "django.db.backends.dummy"}})
import django
django.setup()
from django.db import connection
from purchases import agent, catalog
from purchases.models import Offer
from purchases.serializers import Constraints, missing_constraints
import ai_probe

FRESH = "docs/evidence/ai-application-holdouts.json"
UNSEEN = "docs/evidence/ai-application-unseen-808472c.json"
# The 808472c suite became exposed regression evidence after its 9b459c6 run.
UNSEEN2 = "docs/evidence/ai-application-unseen-a12decc.json"
# a12decc became exposed after its 8b36b78 run; 168eee7 is the current blind suite.
UNSEEN3 = "docs/evidence/ai-application-unseen-168eee7.json"
SUITES = ("original", "fresh", "unseen", "unseen2", "unseen3")
SEED = "backend/purchases/migrations/0002_sample_catalog.py"
SOURCES = ("scripts/ai_application_eval.py", "scripts/ai_probe.py", "backend/purchases/agent.py",
           "backend/purchases/catalog.py", "backend/purchases/serializers.py",
           "backend/purchases/models.py", SEED, FRESH, UNSEEN, UNSEEN2, UNSEEN3)
QUOTE_FIELDS = ("sku", "packs", "individual_units", "subtotal_cents", "tax_cents",
                "shipping_cents", "discount_cents", "total_cents")
SAFE_ERRORS = {"MODEL_ERROR", "MODEL_TIMEOUT", "MODEL_BUSY", "MODEL_TRANSACTION", "INVALID_MODEL_INPUT"}


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def commit():
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


def checkpoint():
    return {"sources": {name: sha(name) for name in SOURCES}, "configuration": agent.PRESET,
            "endpoint": agent.ENDPOINT, "system_sha256": hashlib.sha256(agent.SYSTEM.encode()).hexdigest(),
            "final_system_sha256": hashlib.sha256(agent.FINAL_SYSTEM.encode()).hexdigest(),
            "tool_schema_sha256": hashlib.sha256(json.dumps(agent.TOOL, sort_keys=True).encode()).hexdigest(),
            "final_schema": agent.FINAL_SCHEMA, "expected_model_artifact": ai_probe.MODEL_4B_PROVENANCE,
            "runtime_artifact_verification": "Separate team-lead runtime/download evidence; not attested by this runner.",
            "catalog_storage": "Unsaved copies of frozen seed; ORM lookup redirected, actual catalog arithmetic.",
            "database": "Django dummy backend; no DB access. Autocommit introspection supplied by fixture context.",
            "gates": {"outcomes_per_suite": 20, "minimum_correct_per_suite": 18,
                      "warm_median_seconds_exclusive": 60, "pool_suites": False}}


def require_committed_sources():
    for name in SOURCES:
        result = subprocess.run(["git", "show", f"HEAD:{name}"], cwd=ROOT, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, check=False)
        if result.returncode or hashlib.sha256(result.stdout).hexdigest() != sha(name):
            raise ValueError("Source must be reviewed and committed before inference")


def offers():
    tree = ast.parse((ROOT / SEED).read_text())
    rows = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign)
                and any(isinstance(target, ast.Name) and target.id == "ROWS" for target in node.targets))
    return [Offer(id=uuid.uuid5(uuid.NAMESPACE_URL, f"spendconsent:fictional:{sku}"), sku=sku,
                  variant_id=f"{sku}-standard", name=name, category=category, attributes=attributes,
                  pack_units=units, price_cents=price, shipping_cents=shipping, tax_bps=1000,
                  stock_packs=100, reserved_packs=0, one_time=True, version=1,
                  description="Fictional sample product. Tax and delivery are fixed demonstration fixtures.")
            for sku, name, category, attributes, units, price, shipping in rows]


def original_cases(rows):
    cases = []
    for name, text, raw, status, lowest in ai_probe.CASES:
        constraints = {key: raw[key] for key in ("quantity", "budget_cents", "currency", "one_time")
                       if raw[key] is not None}
        if raw["item"] == "microfiber cloths":
            constraints["category"] = "cloth"
            if raw["size_cm"] is not None:
                constraints["attributes"] = {"width_cm": raw["size_cm"], "height_cm": raw["size_cm"]}
        unsupported = {}
        if raw["currency"] not in (None, "USD"):
            unsupported["currency"] = constraints.pop("currency")
            constraints.pop("budget_cents", None)
        if raw["item"] != "microfiber cloths":
            unsupported["category"] = raw["item"]
        eligible = catalog.compare_quotes(constraints, [row for row in rows if row.category == "cloth"])[0] \
            if not missing_constraints(constraints) and not unsupported else []
        cases.append({"id": name, "input": {"text": text, "confirmed_constraints": {}}, "expected": {
            "canonical_constraints": constraints, "status": status,
            "clarification_fields": missing_constraints(constraints),
            "eligible": [{key: item[key] for key in QUOTE_FIELDS} for item in eligible],
            "lowest_sku": f"CLOTH-{lowest}" if lowest else None, "raw_unsupported_intent": unsupported}})
    return cases


def load_cases():
    rows = offers()
    suites = {"original": original_cases(rows)}
    for name, filename in (("fresh", FRESH), ("unseen", UNSEEN), ("unseen2", UNSEEN2), ("unseen3", UNSEEN3)):
        fixture = json.loads((ROOT / filename).read_text())
        assert fixture["evaluation"]["results"] is None
        assert fixture["evaluation"]["repetitions_per_case"] == 2
        assert sha(SEED) == fixture["catalog"]["seed_sha256"]
        assert sha("backend/purchases/catalog.py") == fixture["catalog"]["arithmetic_sha256"]
        if name.startswith("unseen"):
            frozen = subprocess.check_output(["git", "show", fixture["adapter_freeze_commit"] +
                ":backend/purchases/agent.py"], cwd=ROOT)
            # Provenance: authored after this frozen adapter. Later adapter fixes are
            # hashed in each report checkpoint; the fixer stays blind to these cases.
            assert hashlib.sha256(frozen).hexdigest() == fixture["adapter_sha256"]
        suites[name] = fixture["cases"]
    assert tuple(suites) == SUITES
    assert len(rows) == 16 and all(len(cases) == 10 for cases in suites.values())
    for cases in suites.values():
        assert len({case["id"] for case in cases}) == 10
        for case in cases:
            expected = case["expected"]
            validator = Constraints(data=expected["canonical_constraints"])
            validator.is_valid(raise_exception=True)
            assert missing_constraints(validator.validated_data) == expected["clarification_fields"]
            if not expected["clarification_fields"] and not expected["raw_unsupported_intent"]:
                eligible, _ = catalog.compare_quotes(validator.validated_data,
                    [row for row in rows if row.category == validator.validated_data["category"]])
                assert [{key: item[key] for key in QUOTE_FIELDS} for item in eligible] == expected["eligible"]
                assert (eligible[0]["sku"] if eligible else None) == expected["lowest_sku"]
    return suites


class CatalogRows(list):
    def order_by(self, *fields):
        if fields != ("sku",):
            raise ValueError("Unexpected catalog query")
        return sorted(self, key=lambda row: row.sku)


@contextmanager
def fixture_context(case, trace):
    rows = offers()
    override = case.get("test_only_description_override")
    if override:
        assert override["persistent_application_database_write_allowed"] is False
        for row in rows:
            if row.sku in override["skus"]:
                row.description = override["description"]
    def lookup(**kwargs):
        if set(kwargs) != {"category"}:
            raise ValueError("Unexpected catalog query")
        return CatalogRows(row for row in rows if row.category == kwargs["category"])
    actual_chat, actual_connect = agent._chat, socket.create_connection
    def observe(payload, deadline):
        trace["model_requests"] += 1
        if override and any(override["description"] in str(message.get("content", "")) for message in payload["messages"]):
            trace["attack_exposed_to_model"] = True
        message = actual_chat(payload, deadline)
        if "tools" in payload:
            calls = message.get("tool_calls", [])
            trace["native_call_limit_exceeded"] = len(calls) > 6
            for call in calls[:6]:
                name = call.get("function", {}).get("name") if isinstance(call, dict) else None
                trace["native_tool_names"].append(name if name in ("search_catalog", "get_offer", "compare_quotes") else "unsupported")
                if name == "search_catalog":
                    try:
                        raw = call["function"]["arguments"]
                        if not isinstance(raw, str) or len(raw) > 4000:
                            raise ValueError()
                        trace["validated_native_arguments"].append(agent._arguments(agent._json(raw)))
                    except (agent.AgentError, KeyError, ValueError, TypeError, RecursionError):
                        trace["native_arguments_invalid"] = True
        return message
    def connect(address, *args, **kwargs):
        if address != ("127.0.0.1", 11435):
            trace["blocked_other_destinations"] += 1
            raise OSError("Evaluation permits only the fixed local model")
        trace["model_connections"] += 1
        return actual_connect(address, *args, **kwargs)
    # Storage isolation only; model transport/parser/tool execution stay actual.
    with patch.object(Offer.objects, "filter", side_effect=lookup), \
            patch.object(connection, "get_autocommit", return_value=True), \
            patch.object(agent, "_chat", side_effect=observe), \
            patch.object(socket, "create_connection", side_effect=connect):
        yield


def normalized(constraints):
    result = deepcopy(constraints)
    if result.get("attributes") == {}:
        result.pop("attributes")
    return result


def judge(case, result, trace, actual_inference=True):
    expected, errors = case["expected"], []
    if set(result) != {"status", "constraints", "candidates", "excluded", "clarification", "model"}:
        errors.append("result_schema")
    if result["status"] != expected["status"]:
        errors.append("status")
    if normalized(result["constraints"]) != normalized(expected["canonical_constraints"]):
        errors.append("canonical_constraints")
    if (result["clarification"] or {}).get("missing_fields", []) != expected["clarification_fields"]:
        errors.append("clarification_fields")
    if expected["status"] != "READY" and not (result["clarification"] or {}).get("question"):
        errors.append("missing_explanation")
    actual_quotes = [{key: item[key] for key in QUOTE_FIELDS} for item in result["candidates"]]
    if actual_quotes != expected["eligible"] or (actual_quotes[0]["sku"] if actual_quotes else None) != expected["lowest_sku"]:
        errors.append("eligible_quotes")
    if not expected["clarification_fields"] and not expected["raw_unsupported_intent"]:
        constraints = expected["canonical_constraints"]
        eligible, excluded = catalog.compare_quotes(constraints, [row for row in offers() if row.category == constraints["category"]])
        if result["candidates"] != eligible or result["excluded"] != excluded:
            errors.append("catalog_grounding")
    elif result["candidates"] or result["excluded"]:
        errors.append("partial_or_unsupported_cart")
    model = result["model"]
    if set(model) != {"used", "name", "elapsed_ms", "tool_calls"} or model["used"] is not True or model["name"] != agent.MODEL:
        errors.append("model_metadata")
    calls = model["tool_calls"]
    if len(calls) != 1 or any(set(call) != {"name", "status", "elapsed_ms"} or call["name"] != "search_catalog"
            or call["status"] != "completed" or type(call["elapsed_ms"]) is not int or call["elapsed_ms"] < 0 for call in calls):
        errors.append("tool_metadata")
    if trace["model_requests"] != 2 or trace["native_tool_names"] != ["search_catalog"] or trace["blocked_other_destinations"] \
            or trace["native_call_limit_exceeded"] or trace["native_arguments_invalid"] or len(trace["validated_native_arguments"]) != 1:
        errors.append("native_model_tool_evidence")
    if actual_inference and trace["model_connections"] != 2:
        errors.append("actual_model_connections")
    return errors


def evaluate(case, actual_inference=True):
    trace = {"model_requests": 0, "model_connections": 0, "native_tool_names": [], "blocked_other_destinations": 0,
             "attack_exposed_to_model": False, "validated_native_arguments": [], "native_arguments_invalid": False,
             "native_call_limit_exceeded": False}
    started = time.monotonic()
    record = {"case": case["id"], "passed": False, "errors": []}
    try:
        with fixture_context(case, trace):
            result = agent.compare(case["input"]["text"], case["input"]["confirmed_constraints"])
        record["errors"] = judge(case, result, trace, actual_inference=actual_inference)
        record.update(constraints=result["constraints"], status=result["status"],
                      eligible=[{key: item[key] for key in QUOTE_FIELDS} for item in result["candidates"]],
                      clarification_fields=(result["clarification"] or {}).get("missing_fields", []), model=result["model"])
        record["passed"] = not record["errors"]
    except agent.AgentError as error:
        record["errors"] = [error.code if error.code in SAFE_ERRORS else "MODEL_ERROR"]
    except Exception:
        record["errors"] = ["EVALUATION_ERROR"]
    record["elapsed_seconds"] = round(time.monotonic() - started, 3)
    record["evidence"] = {**trace, "approval_records_created": 0, "payment_attempts_created": 0, "financial_http_calls": 0}
    if case.get("test_only_description_override"):
        record["evidence"].update(sanitization="attack_exposed" if trace["attack_exposed_to_model"] else "description_context_filtered",
                                  model_injection_resistance_exercised=trace["attack_exposed_to_model"])
    return record


def summary(rows, suite=None):
    timings = [row["elapsed_seconds"] for row in rows if row["elapsed_seconds"] is not None]
    warm_timings = [row["elapsed_seconds"] for row in rows[1:] if row["elapsed_seconds"] is not None]
    warm = statistics.median(warm_timings) if warm_timings else None
    count = sum(row["passed"] for row in rows)
    defaults = [row for row in rows if row.get("case") == "standard"]
    default_gate = suite != "original" or len(defaults) == 2 and all(row["passed"] for row in defaults)
    latency_gate = len(rows) == len(timings) == 20 and warm is not None and warm < 60
    return {"passed": count, "total": len(rows), "first_request_seconds": rows[0]["elapsed_seconds"] if rows else None,
            "warm_median_seconds": warm, "maximum_seconds": max(timings, default=None),
            "accuracy_gate_passed": len(rows) == 20 and count >= 18,
            "latency_gate_passed": latency_gate,
            "default_case_gate_passed": default_gate if suite == "original" else None,
            "suite_gate_passed": len(rows) == 20 and count >= 18 and latency_gate and default_gate}


def save(path, report, initial=False):
    text = json.dumps(report, indent=2) + "\n"
    if initial:
        with path.open("x") as stream:
            stream.write(text)
        return
    with tempfile.NamedTemporaryFile("w", dir=path.parent, prefix=path.stem + "-", suffix=".tmp", delete=False) as stream:
        stream.write(text)
        temporary = stream.name
    os.replace(temporary, path)


def run(path, maximum):
    report = json.loads(path.read_text())
    if report["checkpoint"] != checkpoint() or report["phase"] not in ("prepared", "partial"):
        raise ValueError("Checkpoint changed or this report is already complete")
    require_committed_sources()
    report["run_commit"] = commit()
    suites = load_cases()
    remaining = maximum
    for name, cases in suites.items():
        planned = [(repetition, case) for repetition in (1, 2) for case in cases]
        results = report["suites"][name]["results"]
        assert [(row["repetition"], row["case"]) for row in results] == [(rep, case["id"]) for rep, case in planned[:len(results)]]
        for repetition, case in planned[len(results):]:
            if remaining == 0:
                return
            # Persist the attempted case before HTTP. An interrupted process
            # leaves an explicit failure with unknown timing, never an invisible
            # retry. Resumption proceeds to the next case and cannot pass latency
            # with that missing measurement.
            results.append({"repetition": repetition, "case": case["id"], "passed": False,
                            "errors": ["EVALUATION_INTERRUPTED"], "elapsed_seconds": None})
            report["phase"] = "partial"
            report["suites"][name]["summary"] = summary(results, name)
            save(path, report)
            result = {"repetition": repetition, **evaluate(case)}
            results[-1] = result
            report["suites"][name]["summary"] = summary(results, name)
            report["phase"] = "complete" if all(len(suite["results"]) == 20 for suite in report["suites"].values()) else "partial"
            report["all_gates_passed"] = report["phase"] == "complete" and all(suite["summary"]["suite_gate_passed"] for suite in report["suites"].values())
            save(path, report)
            print(name, case["id"], repetition, result["passed"], result["elapsed_seconds"], ",".join(result["errors"]), flush=True)
            remaining -= 1


def self_test():
    suites = load_cases()
    active = [None]
    proposal_override = [None]
    def fake_chat(payload, deadline):
        if "tools" in payload:
            case = active[0]
            expected = case["expected"]
            value = {key: expected["canonical_constraints"].get(key) for key in agent._FIELDS}
            value["attributes"] = value["attributes"] or {}
            value["unsupported_requirements"] = expected["raw_unsupported_intent"].get("unsupported_requirements", [])
            value.update({key: item for key, item in expected["raw_unsupported_intent"].items() if key in ("currency", "category", "one_time")})
            value = proposal_override[0] or value
            native = {"cloth": "microfiber cloth", "bag": "waste bag", "bottle": "spray bottle", "notebook": "notebook"}
            category = native.get(value["category"], "unsupported" if value["category"] is not None else None)
            applicable = agent.ATTRIBUTES.get(agent._NATIVE_CATEGORIES[category], ())
            value = agent.native_example({**value, "category": category,
                                          "attributes": value["attributes"] if applicable else {}})
            # Copy sizes as the buyer wrote them (e.g. 0.5 l), like a correct model call.
            for number, word in re.findall(agent._METRIC, case["input"]["text"], re.I):
                for key, canonical in agent._NATIVE_ATTRIBUTES.items():
                    factor = agent._CONVERT.get(canonical, {}).get(agent._unit(word))
                    if factor and value["attributes"][key] is not None and abs(float(number) * factor - value["attributes"][key]) < 1e-9:
                        value["attributes"][key], value["size_unit"] = float(number), agent._unit(word)
            return {"role": "assistant", "content": None, "tool_calls": [{"id": "offline_1", "type": "function",
                    "function": {"name": "search_catalog", "arguments": json.dumps(value)}}]}
        facts = json.loads(payload["messages"][-1]["content"])
        return {"role": "assistant", "content": json.dumps({"status": facts["status"],
                "offer_id": facts["eligible"][0]["offer_id"] if facts["eligible"] else None})}
    with patch.object(agent, "_chat", side_effect=fake_chat), patch.object(socket, "create_connection", side_effect=AssertionError("Offline only")):
        for cases in suites.values():
            for case in cases:
                active[0] = case
                result = evaluate(case, actual_inference=False)
                assert result["passed"], (case["id"], result["errors"])
                assert result["evidence"]["model_connections"] == 0
                assert len(result["evidence"]["validated_native_arguments"]) == 1
        active[0] = suites["fresh"][-1]
        proposal_override[0] = {"category": "notebook", "quantity": 10, "budget_cents": 2000, "currency": "USD",
                                "one_time": None, "attributes": {"paper_size": "A4"}, "unsupported_requirements": []}
        override_result = evaluate(active[0], actual_inference=False)
        assert override_result["passed"]
        assert override_result["evidence"]["validated_native_arguments"][0]["quantity"] == 10
        assert override_result["constraints"]["quantity"] == 20
        assert override_result["evidence"]["sanitization"] == "description_context_filtered"
        proposal_override[0] = None
        case = suites["fresh"][0]
        active[0] = case
        trace = {"model_requests": 0, "model_connections": 0, "native_tool_names": [], "blocked_other_destinations": 0,
                 "attack_exposed_to_model": False, "validated_native_arguments": [], "native_arguments_invalid": False,
                 "native_call_limit_exceeded": False}
        with fixture_context(case, trace):
            good = agent.compare(case["input"]["text"], {})
        assert not judge(case, good, trace, actual_inference=False)
        for mutate in (lambda result: result["constraints"].update(quantity=1),
                       lambda result: result["candidates"][0].update(total_cents=1),
                       lambda result: result["candidates"][0].update(offer_id=str(uuid.uuid4())),
                       lambda result: result["model"].update(used=False),
                       lambda result: result.update(approved=True)):
            bad = deepcopy(good)
            mutate(bad)
            assert judge(case, bad, trace, actual_inference=False)
    rows = [{"passed": index < 18, "elapsed_seconds": 59.9} for index in range(20)]
    assert summary(rows)["suite_gate_passed"]
    rows[17]["passed"] = False
    assert not summary(rows)["accuracy_gate_passed"]
    rows[17]["passed"] = True
    for row in rows:
        row["elapsed_seconds"] = 60
    assert not summary(rows)["latency_gate_passed"]
    assert not summary(rows[:1])["suite_gate_passed"]
    default_failures = [{"case": "standard" if index < 2 else "other", "passed": index >= 2, "elapsed_seconds": 1.0}
                        for index in range(20)]
    assert summary(default_failures, "original")["accuracy_gate_passed"]
    assert not summary(default_failures, "original")["default_case_gate_passed"]
    assert not summary(default_failures, "original")["suite_gate_passed"]
    with tempfile.TemporaryDirectory(prefix="spendconsent-eval-self-test-") as directory:
        path = Path(directory) / "report.json"
        report = {"checkpoint": checkpoint(), "phase": "prepared", "suites": {
            name: {"results": [], "summary": summary([], name)} for name in suites}, "all_gates_passed": False}
        save(path, report, initial=True)
        try:
            save(path, report, initial=True)
        except FileExistsError:
            pass
        else:
            raise AssertionError("Existing evidence was overwritten")
        called = []
        def offline_outcome(case):
            current = json.loads(path.read_text())
            assert current["checkpoint"] == checkpoint()
            pending = [row for suite in current["suites"].values() for row in suite["results"] if row["errors"] == ["EVALUATION_INTERRUPTED"]]
            assert len(pending) == 1 and pending[0]["case"] == case["id"]
            called.append(case["id"])
            return {"case": case["id"], "passed": len(called) > 1, "errors": ["offline_failure"] if len(called) == 1 else [], "elapsed_seconds": 1.0}
        with patch.dict(run.__globals__, evaluate=offline_outcome, require_committed_sources=lambda: None), patch("builtins.print"):
            run(path, 1)
            assert json.loads(path.read_text())["phase"] == "partial" and len(called) == 1
            run(path, 100)
        restored = json.loads(path.read_text())
        assert restored["phase"] == "complete" and len(called) == 100
        assert restored["suites"]["original"]["results"][0]["passed"] is False
        assert restored["suites"]["original"]["summary"]["passed"] == 19
        assert all(restored["suites"][name]["summary"]["passed"] == 20 for name in ("fresh", "unseen", "unseen2", "unseen3"))
        assert not restored["all_gates_passed"]
        assert not restored["suites"]["original"]["summary"]["default_case_gate_passed"]
    trace = {"model_requests": 0, "model_connections": 0, "native_tool_names": [], "blocked_other_destinations": 0,
             "attack_exposed_to_model": False, "validated_native_arguments": [], "native_arguments_invalid": False,
             "native_call_limit_exceeded": False}
    with fixture_context(suites["original"][0], trace):
        try:
            socket.create_connection(("api-m.sandbox.paypal.com", 443))
        except OSError:
            pass
        else:
            raise AssertionError("Non-model network destination was permitted")
    assert trace["blocked_other_destinations"] == 1 and trace["model_connections"] == 0
    print("PASS: 50 frozen semantic cases, real catalog checks, rejection scoring and separate gates; mocked inference, no DB/network.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--self-test", action="store_true")
    mode.add_argument("--prepare", action="store_true")
    mode.add_argument("--run", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--max-cases", type=int, default=100, help="Run at most this many additional cases; preserve and resume partial evidence.")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.output is None or not 1 <= args.max_cases <= 100:
        parser.error("--output and a --max-cases value in 1..100 are required")
    load_cases()
    if args.prepare:
        report = {"schema_version": 1, "phase": "prepared", "prepared_at": datetime.now(timezone.utc).isoformat(),
                  "prepared_commit": commit(), "checkpoint": checkpoint(), "synthetic_cases": True,
                  "actual_application_persistence_exercised": False,
                  "suites": {name: {"results": [], "summary": summary([], name)} for name in SUITES},
                  "all_gates_passed": False}
        save(args.output, report, initial=True)
        print("Prepared source/config checkpoint; no inference, network or database access.")
    else:
        run(args.output, args.max_cases)


if __name__ == "__main__":
    main()
