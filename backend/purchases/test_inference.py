"""Application wiring checks with explicit test-only model fakes; no inference/HTTP."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
import hashlib
import importlib
import json
from pathlib import Path
import tempfile
import threading
import uuid
from unittest.mock import patch
from django.apps import apps
from django.db import close_old_connections, connection, transaction
from django.test import Client, TransactionTestCase, override_settings
from django.utils import timezone
from . import agent, catalog, inference, services
from .models import DecisionEvent, Offer, PaymentAttempt, PurchaseRequest
from .tests import CONSTRAINTS, seed


def comparison(text, confirmed):
    constraints = {**deepcopy(CONSTRAINTS), **deepcopy(confirmed)}
    candidates, excluded = catalog.compare_quotes(constraints)
    return {"status": "READY" if candidates else "NO_MATCH", "constraints": constraints,
            "candidates": candidates, "excluded": excluded, "clarification": None,
            "model": {"used": True, "name": "test-only-model-fake", "elapsed_ms": 1,
                      "tool_calls": [{"name": "search_catalog", "status": "completed", "elapsed_ms": 1}]}}


@override_settings(SPENDCONSENT_AI_ENABLED=False)
class InferenceTests(TransactionTestCase):
    def setUp(self):
        self.assertEqual(connection.settings_dict["NAME"], "test_spendconsent")
        seed()
        self.client = Client(enforce_csrf_checks=True)
        self.token = self.client.get("/api/session").json()["csrf_token"]
        self.owner = uuid.UUID(self.client.session["owner_uuid"])
        self.data = {"text": "Synthetic request for wiring only.", "client_submission_id": str(uuid.uuid4()),
                     "constraints": deepcopy(CONSTRAINTS)}

    def post(self, route, data):
        return self.client.post(route, data, content_type="application/json", HTTP_X_CSRFTOKEN=self.token)

    def test_default_off_and_marker_identity_health_gate(self):
        with patch.object(inference, "_healthy", side_effect=AssertionError("No network while disabled")):
            self.assertFalse(inference.ready())
            self.assertEqual(self.post("/api/requests", self.data).status_code, 503)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ai-ready.json"
            marker = {"schema_version": 1, "model": agent.MODEL, "qualified": True,
                      "adapter_sha256": hashlib.sha256(Path(agent.__file__).read_bytes()).hexdigest()}
            path.write_text(json.dumps(marker))
            path.chmod(0o600)
            with override_settings(SPENDCONSENT_AI_ENABLED=True, SPENDCONSENT_AI_READINESS=path):
                with patch.object(inference, "_healthy", return_value=True) as health:
                    self.assertTrue(inference.ready())
                    health.assert_called_once()
                with patch.object(inference, "_healthy", return_value=False):
                    self.assertFalse(inference.ready())
                path.write_text(json.dumps({**marker, "adapter_sha256": "0" * 64}))
                with patch.object(inference, "_healthy", side_effect=AssertionError("Unqualified source")):
                    self.assertFalse(inference.ready())
                path.write_text(json.dumps(marker))
                path.chmod(0o644)
                self.assertFalse(inference.ready())
                path.chmod(0o600)
                alias = Path(directory) / "alias.json"
                alias.symlink_to(path)
                with override_settings(SPENDCONSENT_AI_READINESS=alias):
                    self.assertFalse(inference.ready())

    def test_busy_model_is_queued_instead_of_failing_the_buyer(self):
        outcomes = [agent.AgentError("MODEL_BUSY"), agent.AgentError("MODEL_BUSY"), None]
        def model(text, confirmed):
            outcome = outcomes.pop(0)
            if outcome:
                raise outcome
            return comparison(text, confirmed)
        with patch.object(inference, "ready", return_value=True), patch.object(agent, "compare", side_effect=model), \
                patch.object(inference.time, "sleep") as sleep:
            response = self.post("/api/requests", self.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "READY")
        self.assertEqual(sleep.call_count, 2)

    def test_live_progress_shows_the_understood_request_before_the_final_result(self):
        observed = []
        def model(text, confirmed):
            saved = PurchaseRequest.objects.get(owner_uuid=self.owner)
            observed.append(inference.progress(self.owner, saved.id))
            result = comparison(text, confirmed)
            with patch.object(inference, "_original_search", return_value=result):
                self.assertIs(agent._search({}, {}, text), result)
            observed.append(inference.progress(self.owner, saved.id))
            return result
        with patch.object(inference, "ready", return_value=True), patch.object(agent, "compare", side_effect=model):
            self.assertEqual(self.post("/api/requests", self.data).status_code, 200)
        self.assertEqual(observed[0], {"stage": "READING"})
        self.assertEqual(observed[1]["stage"], "UNDERSTOOD")
        self.assertEqual(observed[1]["constraints"], CONSTRAINTS)
        self.assertGreater(observed[1]["eligible"], 0)
        self.assertEqual(self.client.get("/api/progress").json(), {"stage": "DONE"})
        self.assertEqual(inference._PROGRESS, {})
        with patch.object(inference, "_original_search", return_value={"status": "READY"}):
            self.assertEqual(agent._search({}, {}, ""), {"status": "READY"})
        self.assertEqual(inference._PROGRESS, {})

    def test_a_size_number_is_never_taken_as_quantity_or_budget(self):
        check = inference._role_checked
        self.assertEqual(check({"quantity": None, "budget": 500}, "Some spray bottles, the 500 ml ones, one-time."),
                         {"quantity": None, "budget": None}, "500 ml is a size, not $500")
        self.assertEqual(check({"quantity": 40}, "cloths 40 × 40 cm under $60")["quantity"], None)
        self.assertEqual(check({"quantity": 40}, "40x40 cloths")["quantity"], None)
        self.assertEqual(check({"quantity": 40, "budget": 60}, "Exactly 40 microfiber cloths, 40 × 40 cm, under $60"),
                         {"quantity": 40, "budget": 60})
        self.assertEqual(check({"quantity": 50}, "I need 50 in a hurry")["quantity"], 50)
        self.assertEqual(check({"quantity": 20}, "twenty cloths 40x40")["quantity"], 20, "number words stay with the adapter")
        self.assertEqual(check({"quantity": 40}, "Exactly forty microfiber cloths, each 40 cm wide")["quantity"], 40, "forty is written as a quantity")
        swapped = check({"quantity": 1, "budget": 100, "attributes": {"volume": 10, "width": None}}, "one spray 10 budget 100 ml")
        self.assertEqual((swapped["budget"], swapped["attributes"]["volume"]), (None, None), "swapped money and size are both asked")
        self.assertEqual(check({"attributes": {"volume": 500}}, "10 bottles 500 ml under 40")["attributes"]["volume"], 500)
        seen = []
        with patch.object(inference, "_original_search", side_effect=lambda native, confirmed, text: seen.append(native) or {}):
            agent._search({"quantity": 500, "budget": None, "category": "bottle"}, {}, "500 ml bottles")
        self.assertEqual(seen[0]["quantity"], None, "the app's search path applies the role check")

    def test_create_compare_review_approve_keeps_financial_disabled(self):
        def model(text, confirmed):
            self.assertFalse(connection.in_atomic_block)
            self.assertTrue(connection.get_autocommit())
            saved = PurchaseRequest.objects.get(owner_uuid=self.owner)
            self.assertEqual(self.client.session["current_request_id"], str(saved.id))
            self.assertEqual(saved.status, "COMPARING")
            self.assertIsNotNone(saved.active_inference_id)
            return comparison(text, confirmed)
        with patch.object(inference, "ready", return_value=True), patch.object(agent, "compare", side_effect=model) as actual:
            response = self.post("/api/requests", self.data)
            self.assertEqual(response.status_code, 200)
            purchase = response.json()
            self.assertEqual(purchase["status"], "READY")
            self.assertEqual(self.client.get("/api/session").json()["capabilities"],
                             {"ai_ready": True, "paypal_ready": False, "financial_actions_enabled": False, "consent_mode": "operator"})
            self.assertEqual(self.post("/api/requests", self.data).json(), purchase)
            actual.assert_called_once()
        review = self.post(f"/api/requests/{purchase['id']}/reviews",
                           {"expected_version": 1, "candidate_id": purchase["candidates"][0]["id"]}).json()["review"]
        approved = self.post(f"/api/reviews/{review['id']}/approve",
                             {"expected_version": review["version"], "expected_digest": review["digest"]}).json()
        self.assertEqual(approved["approval"]["status"], "APPROVED")
        self.assertEqual(self.post(f"/api/approvals/{approved['approval']['id']}/attempts", {}).status_code, 503)
        self.assertFalse(PaymentAttempt.objects.exists())
        saved = PurchaseRequest.objects.get(id=purchase["id"])
        self.assertEqual(saved.confirmed_constraints, CONSTRAINTS)
        self.assertIsNone(saved.active_inference_id)

    def test_failed_model_is_saved_safe_and_duplicate_never_retries(self):
        for code, expected_code, status in (("MODEL_BUSY", "MODEL_BUSY", 429), ("MODEL_TIMEOUT", "MODEL_TIMEOUT", 503),
                                             ("PRIVATE PROVIDER OUTPUT", "MODEL_ERROR", 503)):
            data = {**self.data, "client_submission_id": str(uuid.uuid4())}
            with self.subTest(code=code), patch.object(inference, "ready", return_value=True), patch.object(
                    agent, "compare", side_effect=agent.AgentError(code)) as model, patch.object(inference, "_QUEUE_SECONDS", 0):
                response = self.post("/api/requests", data)
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.json()["error"]["code"], expected_code)
                pk = response.json()["request_id"]
                self.assertEqual(self.client.get("/api/session").json()["current_request_id"], pk)
                saved = self.client.get(f"/api/requests/{pk}").json()
                self.assertEqual(saved["status"], "MODEL_ERROR")
                self.assertIsNone(saved["model"])
                self.assertEqual(saved["candidates"], [])
                self.assertNotIn("PRIVATE", json.dumps(saved))
                self.assertEqual(self.post("/api/requests", data).status_code, status)
                model.assert_called_once()

    def test_inferred_values_do_not_become_confirmed_on_partial_clarify(self):
        with patch.object(inference, "ready", return_value=True), patch.object(agent, "compare", side_effect=comparison) as model:
            purchase = self.post("/api/requests", {**self.data, "constraints": {}}).json()
            saved = PurchaseRequest.objects.get(id=purchase["id"])
            self.assertEqual(saved.constraints, CONSTRAINTS)
            self.assertEqual(saved.confirmed_constraints, {})
            changed = self.post(f"/api/requests/{saved.id}/clarify", {"expected_version": 1, "constraints": {"quantity": 20}})
            self.assertEqual(changed.status_code, 200)
            self.assertEqual(model.call_args.args[1], {"quantity": 20})
            saved.refresh_from_db()
            self.assertEqual(saved.confirmed_constraints, {"quantity": 20})
            self.assertEqual(saved.constraints, {**CONSTRAINTS, "quantity": 20})
            self.assertEqual(saved.version, 2)

    def test_late_result_and_failure_cannot_overwrite_newer_clarification(self):
        for late_failure in (False, True):
            with self.subTest(late_failure=late_failure):
                entered, release = threading.Event(), threading.Event()
                data = {**self.data, "client_submission_id": uuid.uuid4()}
                with patch.object(inference, "ready", return_value=True):
                    purchase, inference_id = inference.begin_submit(self.owner, data)

                def model(text, confirmed):
                    if confirmed["quantity"] == 40:
                        self.assertFalse(connection.in_atomic_block)
                        entered.set()
                        self.assertTrue(release.wait(5))
                        if late_failure:
                            raise agent.AgentError("MODEL_TIMEOUT")
                    return comparison(text, confirmed)

                def run():
                    close_old_connections()
                    try:
                        return inference.compare(self.owner, purchase, inference_id)
                    finally:
                        close_old_connections()

                with patch.object(inference, "ready", return_value=True), patch.object(agent, "compare", side_effect=model) as actual:
                    with ThreadPoolExecutor(max_workers=1) as pool:
                        pending = pool.submit(run)
                        try:
                            self.assertTrue(entered.wait(5))
                            # Independent real PostgreSQL connection while inference is
                            # blocked: neither request nor offers retain row locks.
                            with transaction.atomic():
                                list(PurchaseRequest.objects.select_for_update(nowait=True).filter(id=purchase.id))
                                list(Offer.objects.select_for_update(nowait=True).all())
                            duplicate, duplicate_id = inference.begin_submit(self.owner, data)
                            self.assertEqual(inference.compare(self.owner, duplicate, duplicate_id).status, "COMPARING")
                            self.assertEqual(actual.call_count, 1)
                            updated = inference.clarify(self.owner, purchase.id, 1, {"quantity": 20})
                            self.assertEqual(updated.status, "READY")
                        finally:
                            release.set()
                        returned = pending.result(timeout=5)
                    self.assertEqual(returned.version, 2)
                    self.assertEqual(returned.constraints["quantity"], 20)
                    self.assertEqual(returned.status, "READY")
                    self.assertEqual(actual.call_count, 2)

    def test_crash_recovery_expires_claim_and_rejects_late_result(self):
        with patch.object(inference, "ready", return_value=True):
            purchase, inference_id = inference.begin_submit(self.owner, self.data)
        DecisionEvent.objects.filter(request=purchase, type="COMPARING").update(created_at=timezone.now() - timedelta(seconds=96))
        recovered = self.client.get(f"/api/requests/{purchase.id}").json()
        self.assertEqual(recovered["status"], "MODEL_ERROR")
        self.assertEqual(recovered["events"][-1]["reason_code"], "MODEL_TIMEOUT")
        stale = inference._finish(self.owner, purchase.id, 1, inference_id, result=comparison(purchase.text, CONSTRAINTS))
        self.assertEqual(stale.status, "MODEL_ERROR")
        self.assertEqual(stale.candidates, [])
        with patch.object(inference, "ready", return_value=True), patch.object(agent, "compare", side_effect=comparison):
            response = self.post(f"/api/requests/{purchase.id}/clarify", {"expected_version": 1, "constraints": {}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], 2)

    def test_provenance_backfill_preserves_preintegration_human_data(self):
        saved = services.submit(self.owner, self.data)
        PurchaseRequest.objects.filter(id=saved.id).update(confirmed_constraints={})
        importlib.import_module("purchases.migrations.0006_confirmed_constraints").preserve_confirmed(apps, None)
        saved.refresh_from_db()
        self.assertEqual(saved.confirmed_constraints, CONSTRAINTS)
        self.assertEqual(saved.constraints, CONSTRAINTS)
        self.assertEqual(saved.version, 1)
