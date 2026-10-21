"""Actual API/adapter/runtime with fake urllib only; never real config or network."""
from datetime import timedelta
import json
from pathlib import Path
import tempfile
import uuid
import hashlib
import io
from unittest.mock import Mock, patch
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import Client, TransactionTestCase, override_settings
from django.utils import timezone
from . import agent, checkout, runtime_paypal, services
from .models import ApprovalLink, PaymentAttempt
from .test_paypal import FakeHTTP, MERCHANT
from .tests import make_approval, make_review, ready_request, seed


class RuntimePayPalTests(TransactionTestCase):
    def setUp(self):
        seed()
        temporary = tempfile.TemporaryDirectory(prefix="spendconsent-paypal-test-")
        self.addCleanup(temporary.cleanup)
        self.private = Path(temporary.name)
        self.config = self.private / "fixture.env"
        self.config.write_text(f"PAYPAL_ENV=sandbox\nPAYPAL_CLIENT_ID=fixture-client\nPAYPAL_CLIENT_SECRET=fixture-secret\nPAYPAL_MERCHANT_ID={MERCHANT}\n")
        self.config.chmod(0o600)
        self.permission = self.private / "permission.json"
        configured = override_settings(SPENDCONSENT_PAYPAL_ENABLED=True, SPENDCONSENT_PAYPAL_CREDENTIALS=self.config,
                                       SPENDCONSENT_PAYPAL_PERMISSION=self.permission)
        configured.enable()
        self.addCleanup(configured.disable)
        qualified = patch("purchases.runtime_paypal.inference.ready", return_value=True)
        qualified.start()
        self.addCleanup(qualified.stop)
        guard = patch("http.client.HTTPSConnection.connect", side_effect=AssertionError("Actual network forbidden"))
        guard.start()
        self.addCleanup(guard.stop)
        self.http = FakeHTTP()
        def fake_open(request, timeout):
            self.assertFalse(connection.in_atomic_block, "HTTP must not hold database locks")
            return self.http(request, timeout)
        transport = patch("urllib.request.OpenerDirector.open", side_effect=fake_open)
        self.transport = transport.start()
        self.addCleanup(transport.stop)
        self.client = Client(enforce_csrf_checks=True, HTTP_HOST="127.0.0.1:5173")
        initial = self.client.get("/api/session").json()
        self.token = initial["csrf_token"]
        self.owner = uuid.UUID(self.client.session["owner_uuid"])

    def purchase(self):
        request = ready_request(self.owner)
        review = make_review(request)
        approval = make_approval(review)
        session = self.client.session
        session["current_request_id"] = str(request.id)
        session.save()
        return request, review, approval

    def permit(self, approval, **changes):
        review = approval.review
        data = {"schema_version": 1, "human_authorized": True, "approval_id": str(approval.id),
                "review_id": str(review.id), "review_digest": review.digest, "request_id": str(review.request_id),
                "owner_uuid": str(self.owner), "merchant_id": MERCHANT, "currency": "USD",
                "total_cents": review.snapshot["total_cents"], "operations": ["create", "capture"],
                "expires_at": approval.expires_at.isoformat(), **changes}
        self.permission.write_text(json.dumps(data))
        self.permission.chmod(0o600)

    def post(self, path):
        return self.client.post(path, {}, content_type="application/json", HTTP_X_CSRFTOKEN=self.token)

    def begin(self):
        request, review, approval = self.purchase()
        self.permit(approval)
        response = self.post(f"/api/approvals/{approval.id}/attempts")
        self.assertEqual(response.status_code, 200)
        attempt = response.json()["attempt"]
        self.assertEqual(attempt["state"], "AWAITING_BUYER")
        return request, review, approval, attempt

    def test_owner_link_lets_another_browser_approve_and_pay_only_that_exact_cart(self):
        request = ready_request(self.owner)
        review = make_review(request)
        token = self.post(f"/api/reviews/{review.id}/link").json()["token"]
        self.assertFalse(ApprovalLink.objects.filter(token_sha256=token).exists(), "only a hash is stored")
        owner = Client(enforce_csrf_checks=True, HTTP_HOST="127.0.0.1:5173")
        csrf = owner.get("/api/session").json()["csrf_token"]
        post = lambda path, data=None: owner.post(path, data or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(owner.get("/api/links/" + "x" * 43).status_code, 404)
        self.assertEqual(owner.get(f"/api/links/{token}").json()["request"]["id"], str(request.id))
        self.assertEqual(owner.get(f"/api/requests/{request.id}").status_code, 404, "a link is not session access")
        with override_settings(SPENDCONSENT_PAYPAL_CONSENT="buyer"):
            self.assertEqual(post(f"/api/links/{token}/attempts").status_code, 409, "approve before paying")
            self.assertEqual(post(f"/api/links/{token}/approve", {"expected_version": review.version, "expected_digest": "0" * 64}).status_code, 409)
            approved = post(f"/api/links/{token}/approve", {"expected_version": review.version, "expected_digest": review.digest})
            self.assertEqual(approved.json()["approval"]["status"], "APPROVED")
            attempt = post(f"/api/links/{token}/attempts").json()["attempt"]
            self.assertEqual(attempt["state"], "AWAITING_BUYER")
            self.http.order["status"] = "APPROVED"
            self.assertEqual(post(f"/api/links/{token}/attempt/refund").status_code, 404)
            self.assertEqual(post(f"/api/links/{token}/attempt/capture").json()["attempt"]["state"], "PAID")
        self.assertEqual(self.client.get(f"/api/requests/{request.id}").json()["attempt"]["state"], "PAID", "requester sees the outcome")
        ApprovalLink.objects.update(expires_at=timezone.now())
        self.assertEqual(owner.get(f"/api/links/{token}").status_code, 404)

    def test_owner_link_requires_the_current_review_and_stops_working_when_superseded(self):
        request = ready_request(self.owner)
        old = make_review(request)
        token = self.post(f"/api/reviews/{old.id}/link").json()["token"]
        make_review(request)
        self.assertEqual(self.post(f"/api/reviews/{old.id}/link").status_code, 409)
        stale = self.client.post(f"/api/links/{token}/approve", {"expected_version": old.version, "expected_digest": old.digest},
                                 content_type="application/json", HTTP_X_CSRFTOKEN=self.token)
        self.assertEqual(stale.status_code, 404, "a superseded link shows and does nothing")
        self.assertEqual(self.client.get(f"/api/links/{token}").status_code, 404)
        other = ready_request()
        self.assertEqual(self.post(f"/api/reviews/{make_review(other).id}/link").status_code, 409, "only your own review")

    def test_buyer_consent_mode_authorizes_only_the_exact_unexpired_approved_cart(self):
        request, review, approval = self.purchase()
        self.assertFalse(runtime_paypal.allowed(approval, "create"), "operator mode still needs the typed permission")
        with override_settings(SPENDCONSENT_PAYPAL_CONSENT="buyer"):
            self.assertFalse(self.permission.exists())
            capabilities = self.client.get("/api/session").json()["capabilities"]
            self.assertTrue(capabilities["financial_actions_enabled"])
            self.assertEqual(capabilities["consent_mode"], "buyer")
            self.assertFalse(runtime_paypal.allowed(approval, "refund"))
            with override_settings(SPENDCONSENT_BUYER_MAX_CENTS=review.snapshot["total_cents"] - 1):
                self.assertFalse(runtime_paypal.allowed(approval, "create"))
            with patch("purchases.runtime_paypal.timezone.now", return_value=approval.expires_at):
                self.assertFalse(runtime_paypal.allowed(approval, "create"))
            config = runtime_paypal.configuration()
            self.assertFalse(runtime_paypal.allowed(approval, "create", {**config, "PAYPAL_MERCHANT_ID": "OTHERMERCHANT1"}))
            self.config.write_text(self.config.read_text().replace("PAYPAL_ENV=sandbox", "PAYPAL_ENV=live"))
            self.assertFalse(runtime_paypal.allowed(approval, "create"))
            self.config.write_text(self.config.read_text().replace("PAYPAL_ENV=live", "PAYPAL_ENV=sandbox"))
            response = self.post(f"/api/approvals/{approval.id}/attempts")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["attempt"]["state"], "AWAITING_BUYER")
            self.assertTrue(runtime_paypal.allowed(approval, "capture"))
            approval.revoked_at = timezone.now()
            approval.save(update_fields=["revoked_at"])
            self.assertFalse(runtime_paypal.allowed(approval, "capture"))
            _, second, fresh = self.purchase()
            self.assertTrue(runtime_paypal.allowed(fresh, "create"))
            make_review(second.request)
            self.assertFalse(runtime_paypal.allowed(fresh, "create"), "a superseded review no longer authorizes")

    def test_typed_consent_command_writes_only_the_exact_one_time_permission(self):
        request, review, approval = self.purchase()
        total = f"{review.snapshot['total_cents'] / 100:.2f}"
        def run(typed, tty=True):
            with patch("sys.stdin", Mock(**{"isatty.return_value": tty})), patch("builtins.input", return_value=typed):
                call_command("authorize_sandbox_purchase", stdout=io.StringIO())
        for typed, tty in (("9.99", True), ("yes", True), (total, False)):
            with self.subTest(typed=typed, tty=tty), self.assertRaises(CommandError):
                run(typed, tty)
            self.assertFalse(self.permission.exists())
        run(total)
        self.assertEqual(self.permission.stat().st_mode & 0o777, 0o600)
        self.assertTrue(runtime_paypal.allowed(approval, "create"))
        self.assertTrue(runtime_paypal.allowed(approval, "capture"))
        approval.revoked_at = timezone.now()
        approval.save(update_fields=["revoked_at"])
        self.permission.unlink()
        with self.assertRaises(CommandError):
            run(total)
        self.assertFalse(self.permission.exists())

    def test_ai_readiness_is_granted_only_from_a_passing_report_for_this_adapter(self):
        marker = self.private / "ai" / "ai-ready.json"
        adapter = hashlib.sha256(Path(agent.__file__).read_bytes()).hexdigest()
        report = self.private / "report.json"
        def grant(**changes):
            data = {"phase": "complete", "all_gates_passed": True, "checkpoint": {
                "sources": {"backend/purchases/agent.py": adapter}, "configuration": {"model": agent.MODEL}}, **changes}
            report.write_text(json.dumps(data))
            with override_settings(SPENDCONSENT_AI_READINESS=marker):
                call_command("grant_ai_readiness", str(report), stdout=io.StringIO())
        for changes in ({"all_gates_passed": False}, {"phase": "partial"},
                        {"checkpoint": {"sources": {"backend/purchases/agent.py": "0" * 64}, "configuration": {"model": agent.MODEL}}},
                        {"checkpoint": {"sources": {"backend/purchases/agent.py": adapter, "backend/purchases/catalog.py": "0" * 64},
                                        "configuration": {"model": agent.MODEL}}},
                        {"checkpoint": {"sources": [], "configuration": {"model": agent.MODEL}}}):
            with self.subTest(changes=changes), self.assertRaises(CommandError):
                grant(**changes)
            self.assertFalse(marker.exists())
        grant()
        self.assertEqual(json.loads(marker.read_text()), {"schema_version": 1, "model": agent.MODEL,
                                                          "qualified": True, "adapter_sha256": adapter})
        self.assertEqual(marker.parent.stat().st_mode & 0o777, 0o700)

    def test_default_off_never_reads_config_or_allocates_attempt(self):
        with override_settings(SPENDCONSENT_PAYPAL_ENABLED=False), patch.object(runtime_paypal, "_private_text", side_effect=AssertionError("Disabled runtime cannot read files")):
            request, review, approval = self.purchase()
            self.assertEqual(review.snapshot["payee_ref"], services.PAYEE_REF)
            self.assertFalse(self.client.get("/api/session").json()["capabilities"]["paypal_ready"])
            self.assertEqual(self.post(f"/api/approvals/{approval.id}/attempts").status_code, 503)
        self.assertFalse(PaymentAttempt.objects.exists())
        self.assertEqual(self.http.calls, [])

    def test_missing_wrong_expired_or_unqualified_permission_makes_no_http(self):
        request, review, approval = self.purchase()
        route = f"/api/approvals/{approval.id}/attempts"
        self.assertEqual(self.post(route).status_code, 503)
        for changes in ({"review_digest": "0" * 64}, {"approval_id": str(uuid.uuid4())}, {"owner_uuid": str(uuid.uuid4())},
                        {"merchant_id": "ZZZZZZZZZZZZZ"}, {"currency": "EUR"}, {"total_cents": 4181},
                        {"human_authorized": False}, {"operations": ["capture"]},
                        {"expires_at": (timezone.now() - timedelta(seconds=1)).isoformat()},
                        {"expires_at": (approval.expires_at + timedelta(seconds=1)).isoformat()}):
            with self.subTest(changes=changes):
                self.permit(approval, **changes)
                response = self.post(route)
                self.assertEqual((response.status_code, response.json()["error"]["code"]), (503, "FINANCIAL_ACTIONS_DISABLED"))
        self.permit(approval)
        with patch("purchases.runtime_paypal.inference.ready", return_value=False):
            self.assertEqual(self.post(route).status_code, 503)
        self.permission.chmod(0o644)
        self.assertEqual(self.post(route).status_code, 503)
        self.assertFalse(PaymentAttempt.objects.exists())
        self.assertEqual(self.http.calls, [])

    def test_configured_binding_requires_fresh_review_and_exposes_no_secret(self):
        with override_settings(SPENDCONSENT_PAYPAL_ENABLED=False):
            request, old, approval = self.purchase()
        self.permit(approval)
        self.assertEqual(self.post(f"/api/approvals/{approval.id}/attempts").status_code, 503)
        fresh = make_review(request)
        self.assertEqual(fresh.snapshot["payee_ref"], MERCHANT)
        current = make_approval(fresh)
        self.permit(current)
        session = self.client.get("/api/session").json()
        self.assertTrue(session["capabilities"]["financial_actions_enabled"])
        self.assertEqual(session["paypal"], {"client_id": "fixture-client", "currency": "USD"})
        self.assertNotIn("fixture-secret", json.dumps(session))
        self.assertNotIn("permission", json.dumps(session))
        self.assertEqual(self.http.calls, [])

    def test_exact_api_dispatch_capture_and_replays_use_one_persisted_attempt(self):
        request, review, approval, attempt = self.begin()
        self.assertIn("open_paypal", attempt["allowed_actions"])
        self.assertEqual(self.post(f"/api/approvals/{approval.id}/attempts").json()["attempt"]["id"], attempt["id"])
        self.http.order["status"] = "APPROVED"
        paid = self.post(f"/api/attempts/{attempt['id']}/capture")
        self.assertEqual((paid.status_code, paid.json()["attempt"]["state"]), (200, "PAID"))
        self.post(f"/api/attempts/{attempt['id']}/capture")
        self.post(f"/api/attempts/{attempt['id']}/reconcile")
        self.assertEqual(sum(call.full_url.endswith("/v2/checkout/orders") for call in self.http.calls), 1)
        self.assertEqual(sum(call.full_url.endswith("/capture") for call in self.http.calls), 1)
        self.assertEqual(PaymentAttempt.objects.count(), 1)
        self.assertNotIn("fixture-secret", paid.content.decode())

    def test_permission_rechecked_after_oauth_before_financial_dispatch(self):
        request, review, approval = self.purchase()
        self.permit(approval)
        def expire_after_oauth(request, timeout):
            response = self.http(request, timeout)
            if request.full_url.endswith("/v1/oauth2/token"):
                self.permit(approval, expires_at=(timezone.now() - timedelta(seconds=1)).isoformat())
            return response
        self.transport.side_effect = expire_after_oauth
        response = self.post(f"/api/approvals/{approval.id}/attempts")
        attempt = response.json()["attempt"]
        self.assertEqual((attempt["state"], attempt["reason_code"]), ("STOPPED", "FINANCIAL_ACTIONS_DISABLED"))
        self.assertEqual(len(self.http.calls), 1)  # Read-only OAuth; zero financial HTTP.
        self.assertEqual(PaymentAttempt.objects.get(id=attempt["id"]).stock_hold_packs, 0)

    def test_capture_permission_expiry_during_preflight_prevents_post(self):
        request, review, approval, attempt = self.begin()
        self.http.order["status"] = "APPROVED"
        def expire_after_read(request, timeout):
            response = self.http(request, timeout)
            if request.get_method() == "GET":
                self.permit(approval, expires_at=(timezone.now() - timedelta(seconds=1)).isoformat())
            return response
        self.transport.side_effect = expire_after_read
        response = self.post(f"/api/attempts/{attempt['id']}/capture")
        self.assertEqual(response.json()["attempt"]["state"], "STOPPED")
        self.assertFalse(any(call.full_url.endswith("/capture") for call in self.http.calls))

    def test_unknown_capture_can_reconcile_after_permission_and_switch_disable(self):
        request, review, approval, attempt = self.begin()
        self.http.order["status"] = "APPROVED"
        def uncertain_capture(request, timeout):
            response = self.http(request, timeout)
            if request.full_url.endswith("/capture"):
                raise TimeoutError("private provider detail")
            return response
        self.transport.side_effect = uncertain_capture
        response = self.post(f"/api/attempts/{attempt['id']}/capture")
        self.assertEqual(response.json()["attempt"]["state"], "UNKNOWN")
        self.permit(approval, expires_at=(timezone.now() - timedelta(seconds=1)).isoformat())
        self.transport.side_effect = self.http
        with override_settings(SPENDCONSENT_PAYPAL_ENABLED=False), patch("purchases.runtime_paypal.inference.ready", return_value=False):
            session = self.client.get("/api/session").json()
            self.assertFalse(session["capabilities"]["financial_actions_enabled"])
            recovered = self.post(f"/api/attempts/{attempt['id']}/reconcile")
            self.assertEqual(recovered.json()["attempt"]["state"], "PAID")
            self.assertEqual(self.post(f"/api/attempts/{attempt['id']}/capture").json()["attempt"]["state"], "PAID")
        self.assertEqual(sum(call.full_url.endswith("/capture") for call in self.http.calls), 1)

    def test_guard_wrong_key_and_unknown_creation_recovery_have_no_http(self):
        with self.assertRaises(checkout.DispatchDenied):
            runtime_paypal._dispatch("capture", str(uuid.uuid4()))
        request, review, approval = self.purchase()
        attempt = PaymentAttempt.objects.create(request=request, approval=approval, state="UNKNOWN", pending_operation="create", snapshot=review.snapshot)
        with patch.object(runtime_paypal, "configuration", side_effect=AssertionError("No provider needed without ID")):
            response = self.post(f"/api/attempts/{attempt.id}/reconcile")
        self.assertEqual(response.json()["attempt"]["reason_code"], "MANUAL_RESOLUTION_REQUIRED")
        self.assertEqual(self.http.calls, [])

    def test_financial_routes_keep_csrf_ownership_and_server_only_authority(self):
        request, review, approval, attempt = self.begin()
        capture = f"/api/attempts/{attempt['id']}/capture"
        self.http.calls.clear()
        self.assertEqual(self.client.post(capture, {}, content_type="application/json").status_code, 403)
        outsider = Client(HTTP_HOST="127.0.0.1:5173")
        outsider.get("/api/session")
        self.assertEqual(outsider.post(capture, {}, content_type="application/json").status_code, 404)
        self.assertEqual(self.client.post(capture, {"order_id": "ARBITRARY", "total_cents": 1},
                         content_type="application/json", HTTP_X_CSRFTOKEN=self.token).status_code, 400)
        self.assertEqual(self.http.calls, [])

    def test_stop_during_capture_preflight_prevents_financial_dispatch(self):
        request, review, approval, attempt = self.begin()
        self.http.order["status"] = "APPROVED"
        # Stop after the independent buyer-approval GET, before claiming POST.
        def stop_after_read(http_request, timeout):
            response = self.http(http_request, timeout)
            if http_request.get_method() == "GET":
                checkout.stop(self.owner, attempt["id"])
            return response
        self.transport.side_effect = stop_after_read
        response = self.post(f"/api/attempts/{attempt['id']}/capture")
        self.assertEqual(response.json()["attempt"]["state"], "STOPPED")
        self.assertFalse(any(call.full_url.endswith("/capture") for call in self.http.calls))

    def test_live_insecure_and_symlink_configuration_fails_closed(self):
        original = self.config.read_text()  # Fixture credentials only.
        for content in (original.replace("sandbox", "live"), original.replace(f"PAYPAL_MERCHANT_ID={MERCHANT}", "PAYPAL_MERCHANT_ID=")):
            self.config.write_text(content)
            self.assertIsNone(runtime_paypal.configuration())
        self.config.write_text(original)
        self.config.chmod(0o644)
        self.assertIsNone(runtime_paypal.configuration())
        self.config.chmod(0o600)
        link = self.private / "linked.env"
        link.symlink_to(self.config)
        with override_settings(SPENDCONSENT_PAYPAL_CREDENTIALS=link):
            self.assertIsNone(runtime_paypal.configuration())
        self.assertEqual(self.http.calls, [])
