"""Real-PG checkout/recovery checks. Provider below is test-only, with zero HTTP."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
import threading
import uuid
from unittest.mock import patch
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.http import Http404
from django.test import TransactionTestCase
from django.utils import timezone
from . import checkout, services
from .models import Approval, Offer, PaymentAttempt, PurchaseRequest
from .tests import make_approval, make_review, ready_request, seed


class FakeProvider:
    """Injected simulator, never loaded/configured by a running application."""
    def __init__(self):
        self.orders = {}
        self.calls = {"create": 0, "capture": 0, "get": 0}
        self.hooks = {}
        self.mutex = threading.Lock()
        self.check_locks = True

    def _io(self, operation, payload):
        assert not connection.in_atomic_block and connection.get_autocommit(), "Provider called inside a transaction"
        if self.check_locks:
            def prove_committed_and_unlocked():
                close_old_connections()
                try:
                    with transaction.atomic():
                        request = PurchaseRequest.objects.select_for_update(nowait=True).get(id=payload["request_id"])
                        approval = Approval.objects.select_for_update(nowait=True).get(review_id=payload["review_id"])
                        offer = Offer.objects.select_for_update(nowait=True).get(id=payload["item"]["offer_id"])
                        attempt = PaymentAttempt.objects.get(id=payload["reference_id"])
                        if operation == "create":
                            assert attempt.create_payload == payload
                        assert approval.review.request_id == request.id
                        assert offer.reserved_packs >= attempt.stock_hold_packs
                finally:
                    close_old_connections()
            with ThreadPoolExecutor(max_workers=1) as pool:
                pool.submit(prove_committed_and_unlocked).result(timeout=5)
        with self.mutex:
            self.calls[operation] += 1
        if operation in self.hooks:
            self.hooks[operation]()

    def create_order(self, payload, key):
        self._io("create", payload)
        assert str(PaymentAttempt.objects.get(id=payload["reference_id"]).create_key) == key
        order_id = f"fake-order-{uuid.uuid4()}"
        self.orders[order_id] = {"id": order_id, "status": "APPROVED", "purchase": deepcopy(payload), "capture": None}
        return {"id": order_id}

    def get_order(self, order_id):
        self._io("get", self.orders[order_id]["purchase"])
        return deepcopy(self.orders[order_id])

    def complete(self, order_id, status="COMPLETED"):
        order = self.orders[order_id]
        payload = order["purchase"]
        order["status"] = "COMPLETED" if status == "COMPLETED" else "APPROVED"
        order["capture"] = {"id": f"fake-capture-{uuid.uuid4()}", "order_id": order_id, "status": status,
                            "payee_ref": payload["payee_ref"], "currency": payload["currency"], "total_cents": payload["total_cents"]}

    def capture_order(self, order_id, payload, key):
        self._io("capture", self.orders[order_id]["purchase"])
        attempt = PaymentAttempt.objects.get(id=payload["reference_id"])
        assert attempt.state in ("CAPTURING", "UNKNOWN")
        assert attempt.capture_payload == payload and str(attempt.capture_key) == key
        assert attempt.capture_dispatched_at and str(attempt.create_key) != key
        self.complete(order_id)
        return {"accepted": True}


class CheckoutDomainTests(TransactionTestCase):
    def setUp(self):
        seed()
        self.provider = FakeProvider()

    def purchase(self):
        request = ready_request()
        review = make_review(request)
        approval = make_approval(review)
        return request, review, approval

    def start(self):
        request, review, approval = self.purchase()
        attempt, status = checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual((attempt.state, status), ("AWAITING_BUYER", 200))
        return request, review, approval, attempt

    def stock(self, review):
        offer = Offer.objects.get(id=review.offer_id)
        return offer.stock_packs, offer.reserved_packs, offer.version

    def test_exact_hold_payload_paid_finalization_and_replays(self):
        request, review, approval, attempt = self.start()
        self.assertEqual(self.stock(review), (100, 2, 1))
        self.assertEqual(attempt.create_payload["total_cents"], 4180)
        self.assertEqual(attempt.create_payload["item"]["packs"], 2)
        self.assertEqual(attempt.create_payload["item"]["individual_units"], 40)
        paid, status = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual((paid.state, status), ("PAID", 200))
        self.assertTrue(paid.capture_id)
        self.assertEqual(self.stock(review), (98, 0, 1))
        request.refresh_from_db()
        self.assertEqual(request.status, "PAID")
        before = dict(self.provider.calls)
        for operation in (lambda: checkout.start(request.owner_uuid, approval.id, self.provider),
                          lambda: checkout.capture(request.owner_uuid, attempt.id, self.provider),
                          lambda: checkout.reconcile(request.owner_uuid, attempt.id, self.provider),
                          lambda: checkout.stop(request.owner_uuid, attempt.id)):
            self.assertEqual(operation()[0].id, attempt.id)
        self.assertEqual(before, self.provider.calls)
        self.assertEqual(self.stock(review), (98, 0, 1))
        with self.assertRaises(services.DomainError):
            make_review(request, 1)

    def test_reservation_recognizes_its_own_last_available_packs(self):
        request, review, approval = self.purchase()
        Offer.objects.filter(id=review.offer_id).update(stock_packs=2)
        attempt, _ = checkout.start(request.owner_uuid, approval.id, self.provider)
        paid, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(paid.state, "PAID")
        self.assertEqual(self.stock(review), (0, 0, 1))

    def test_wrong_session_absent_expired_superseded_or_revoked_approval(self):
        request, review, approval = self.purchase()
        for operation in (lambda: checkout.start(uuid.uuid4(), approval.id, self.provider),
                          lambda: checkout.start(request.owner_uuid, uuid.uuid4(), self.provider)):
            with self.assertRaises(Http404):
                operation()
        with patch("purchases.checkout.timezone.now", return_value=approval.expires_at):
            with self.assertRaises(services.DomainError) as error:
                checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual(error.exception.code, "REVIEW_EXPIRED")
        replacement = make_review(request, 1)
        with self.assertRaises(services.DomainError):
            checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual(self.provider.calls["create"], 0)
        self.assertEqual(self.stock(review)[1], 0)
        latest = make_approval(replacement)
        latest.revoked_at = timezone.now()
        latest.save(update_fields=["revoked_at"])
        with self.assertRaises(services.DomainError):
            checkout.start(request.owner_uuid, latest.id, self.provider)

    def test_capture_checks_owner_buyer_approval_and_expiry(self):
        request, review, approval, attempt = self.start()
        for function in (checkout.capture, checkout.reconcile):
            with self.assertRaises(Http404):
                function(uuid.uuid4(), attempt.id, self.provider)
        with self.assertRaises(Http404):
            checkout.stop(uuid.uuid4(), attempt.id)
        self.provider.orders[attempt.provider_order_id]["status"] = "CREATED"
        waiting, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(waiting.reason_code, "BUYER_APPROVAL_REQUIRED")
        self.assertEqual(self.provider.calls["capture"], 0)
        self.provider.orders[attempt.provider_order_id]["status"] = "APPROVED"
        with patch("purchases.checkout.timezone.now", return_value=approval.expires_at):
            stopped, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual((stopped.state, stopped.reason_code), ("STOPPED", "REVIEW_EXPIRED"))
        self.assertEqual(self.stock(review), (100, 0, 1))
        self.assertEqual(self.provider.calls["capture"], 0)

    def test_material_mutations_before_capture_force_fresh_review(self):
        for field, value in (("price_cents", 1800), ("variant_id", "different-same-price"),
                             ("one_time", False), ("shipping_cents", 1)):
            with self.subTest(field=field):
                request, review, approval, attempt = self.start()
                old = Offer.objects.get(id=review.offer_id)
                self.provider.hooks["get"] = lambda: Offer.objects.filter(id=review.offer_id).update(**{field: value})
                stopped, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
                self.assertEqual((stopped.state, stopped.reason_code), ("STOPPED", "REVIEW_CHANGED"))
                self.assertEqual(self.stock(review)[1], 0)
                self.assertEqual(self.provider.calls["capture"], 0)
                self.provider.hooks.clear()
                Offer.objects.filter(id=old.id).update(**{field: getattr(old, field)})

    def test_after_dispatch_quote_is_frozen_even_after_price_change_or_expiry(self):
        request, review, approval, attempt = self.start()
        clock = [timezone.now()]
        def change_after_dispatch():
            Offer.objects.filter(id=review.offer_id).update(price_cents=1800)
            clock[0] = approval.expires_at + timedelta(hours=1)
        self.provider.hooks["capture"] = change_after_dispatch
        with patch("purchases.checkout.timezone.now", side_effect=lambda: clock[0]):
            paid, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(paid.state, "PAID")
        self.assertEqual(paid.snapshot["total_cents"], 4180)
        self.assertEqual(paid.create_payload["total_cents"], 4180)
        self.assertEqual(self.stock(review), (98, 0, 2))

    def test_create_timeout_without_order_id_is_manual_not_resend_or_lookup(self):
        request, review, approval = self.purchase()
        def timeout():
            raise TimeoutError("PRIVATE PROVIDER BODY MUST NEVER BE RECORDED")
        self.provider.hooks["create"] = timeout
        unknown, status = checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual((unknown.state, status, unknown.pending_operation), ("UNKNOWN", 202, "create"))
        self.assertIsNone(unknown.provider_order_id)
        again, _ = checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual(again.id, unknown.id)
        stopped, _ = checkout.stop(request.owner_uuid, unknown.id)
        self.assertEqual(stopped.state, "UNKNOWN")
        manual, _ = checkout.reconcile(request.owner_uuid, unknown.id, self.provider)
        self.assertEqual(manual.reason_code, "MANUAL_RESOLUTION_REQUIRED")
        self.assertEqual(self.provider.calls, {"create": 1, "capture": 0, "get": 0})
        self.assertEqual(self.stock(review), (100, 2, 1))
        self.assertFalse(request.events.filter(message__contains="PRIVATE").exists())
        with self.assertRaises(services.DomainError):
            make_review(request, 1)

    def test_known_order_create_recovery_and_stale_capture_are_get_only(self):
        request, review, approval, attempt = self.start()
        PaymentAttempt.objects.filter(id=attempt.id).update(state="UNKNOWN", pending_operation="create")
        recovered, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(recovered.state, "AWAITING_BUYER")
        # Crash immediately after claiming capture; no automatic re-dispatch on restart.
        def crash():
            raise SystemExit("simulated process exit")
        self.provider.hooks["capture"] = crash
        with self.assertRaises(SystemExit):
            checkout.capture(request.owner_uuid, attempt.id, self.provider)
        persisted = PaymentAttempt.objects.get(id=attempt.id)
        self.assertEqual(persisted.state, "CAPTURING")
        self.assertIsNotNone(persisted.capture_dispatched_at)
        unknown, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual((unknown.state, unknown.pending_operation), ("UNKNOWN", "capture"))
        self.assertEqual(checkout.capture(request.owner_uuid, attempt.id, self.provider)[0].state, "UNKNOWN")
        self.assertEqual(self.provider.calls["capture"], 1)
        self.assertEqual(self.stock(review)[1], 2)

    def test_timeout_after_possible_capture_keeps_hold_until_completed_get(self):
        request, review, approval, attempt = self.start()
        def sent_then_timeout():
            self.provider.complete(attempt.provider_order_id)
            raise TimeoutError("uncertain after send")
        self.provider.hooks["capture"] = sent_then_timeout
        unknown, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(unknown.state, "UNKNOWN")
        self.assertEqual(self.stock(review)[1], 2)
        paid, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(paid.state, "PAID")
        self.assertEqual(self.provider.calls["capture"], 1)
        self.assertEqual(self.stock(review), (98, 0, 1))

    def test_pending_capture_and_verification_failure_never_claim_paid(self):
        request, review, approval, attempt = self.start()
        original_capture = self.provider.capture_order
        def pending(order, payload, key):
            original_capture(order, payload, key)
            self.provider.complete(order, status="PENDING")
        self.provider.capture_order = pending
        pending_attempt, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual((pending_attempt.state, pending_attempt.reason_code), ("UNKNOWN", "PAYMENT_PENDING"))
        self.assertEqual(self.stock(review), (100, 2, 1))
        self.provider.hooks["get"] = lambda: (_ for _ in ()).throw(TimeoutError("read failed"))
        failed_read, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(failed_read.state, "UNKNOWN")
        self.assertEqual(self.stock(review)[1], 2)
        self.assertEqual(self.provider.calls["capture"], 1)

    def test_persisted_creating_crash_is_never_automatically_resent(self):
        request, review, approval = self.purchase()
        def crash():
            raise SystemExit("simulated crash before create result persistence")
        self.provider.hooks["create"] = crash
        with self.assertRaises(SystemExit):
            checkout.start(request.owner_uuid, approval.id, self.provider)
        persisted = PaymentAttempt.objects.get(approval=approval)
        self.assertEqual(persisted.state, "CREATING")
        duplicate, status = checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual((duplicate.id, status), (persisted.id, 202))
        unknown, _ = checkout.reconcile(request.owner_uuid, persisted.id, self.provider)
        self.assertEqual((unknown.state, unknown.reason_code), ("UNKNOWN", "MANUAL_RESOLUTION_REQUIRED"))
        self.assertEqual(self.provider.calls, {"create": 1, "capture": 0, "get": 0})
        self.assertEqual(self.stock(review)[1], 2)

    def test_uncertain_preflight_stop_retains_hold_until_get_resolves_no_capture(self):
        request, review, approval, attempt = self.start()
        self.provider.hooks["get"] = lambda: (_ for _ in ()).throw(TimeoutError("unavailable read"))
        unknown, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual((unknown.state, unknown.pending_operation), ("UNKNOWN", "verification"))
        stopped, _ = checkout.stop(request.owner_uuid, attempt.id)
        self.assertEqual(stopped.state, "UNKNOWN")
        self.assertEqual(self.stock(review)[1], 2)
        self.provider.hooks.clear()
        resolved, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(resolved.state, "STOPPED")
        self.assertEqual(self.stock(review)[1], 0)
        self.assertEqual(self.provider.calls["capture"], 0)

    def test_completed_preflight_without_capture_evidence_stays_uncertain_after_stop(self):
        request, review, approval, attempt = self.start()
        self.provider.orders[attempt.provider_order_id]["status"] = "COMPLETED"
        self.assertIsNone(self.provider.orders[attempt.provider_order_id]["capture"])
        uncertain, status = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual((uncertain.state, status), ("UNKNOWN", 202))
        self.assertEqual(self.provider.calls["capture"], 0)
        stopped, status = checkout.stop(request.owner_uuid, attempt.id)
        self.assertEqual((stopped.state, status), ("UNKNOWN", 202))
        self.assertEqual(self.stock(review), (100, 2, 1))
        with self.assertRaises(services.DomainError):
            make_review(request, 1)

    def test_completed_mismatch_or_missing_evidence_needs_manual_payment_review(self):
        variants = ["order", "payee", "currency", "amount", "capture_id", "line", "quantity_type"]
        for variant in variants:
            with self.subTest(variant=variant):
                request, review, approval, attempt = self.start()
                self.provider.complete(attempt.provider_order_id)
                order = self.provider.orders[attempt.provider_order_id]
                if variant == "order":
                    order["id"] = "wrong-order"
                elif variant == "payee":
                    order["capture"]["payee_ref"] = "wrong-payee"
                elif variant == "currency":
                    order["capture"]["currency"] = "EUR"
                elif variant == "amount":
                    order["capture"]["total_cents"] += 1
                elif variant == "capture_id":
                    del order["capture"]["id"]
                elif variant == "line":
                    order["purchase"]["item"]["variant_id"] = "same-price-other-item"
                else:
                    order["purchase"]["item"]["packs"] = 2.0
                result, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
                self.assertEqual((result.state, result.reason_code), ("PAYMENT_REVIEW", "PAYMENT_MISMATCH"))
                self.assertEqual(result.stock_hold_packs, 2)
                with self.assertRaises(services.DomainError):
                    make_review(request, 1)
                self.assertEqual(checkout.stop(request.owner_uuid, attempt.id)[0].state, "PAYMENT_REVIEW")
        self.assertEqual(self.provider.calls["capture"], 0)

    def test_stop_before_during_create_and_after_capture_dispatch(self):
        request, review, approval, attempt = self.start()
        stopped, _ = checkout.stop(request.owner_uuid, attempt.id)
        self.assertEqual(stopped.state, "STOPPED")
        self.assertEqual(self.stock(review), (100, 0, 1))
        self.assertEqual(checkout.capture(request.owner_uuid, attempt.id, self.provider)[0].state, "STOPPED")
        self.assertEqual(self.provider.calls["capture"], 0)
        # A stop racing the initial create holds stock until that create resolves.
        request, review, approval = self.purchase()
        self.provider.hooks["create"] = lambda: checkout.stop(request.owner_uuid, PaymentAttempt.objects.get(approval=approval).id)
        ended, _ = checkout.start(request.owner_uuid, approval.id, self.provider)
        self.assertEqual(ended.state, "STOPPED")
        self.assertEqual(self.stock(review)[1], 0)
        self.provider.hooks.clear()
        request, review, approval, attempt = self.start()
        self.provider.hooks["capture"] = lambda: checkout.stop(request.owner_uuid, attempt.id)
        paid, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(paid.state, "PAID")
        self.assertTrue(paid.stop_requested)
        self.assertEqual(paid.stock_hold_packs, 0)

    def test_definitive_decline_releases_exactly_once_but_timeout_does_not(self):
        for operation in ("create", "capture"):
            request, review, approval = self.purchase()
            def decline():
                raise checkout.ProviderDeclined()
            if operation == "create":
                self.provider.hooks["create"] = decline
                result, _ = checkout.start(request.owner_uuid, approval.id, self.provider)
            else:
                self.provider.hooks.clear()
                attempt, _ = checkout.start(request.owner_uuid, approval.id, self.provider)
                self.provider.hooks["capture"] = decline
                result, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
            self.assertEqual((result.state, result.reason_code), ("STOPPED", "PROVIDER_DECLINED"))
            self.assertEqual(self.stock(review)[1], 0)
            checkout.stop(request.owner_uuid, result.id)
            self.assertEqual(self.stock(review)[1], 0)
            self.provider.hooks.clear()

    def test_attempt_authority_and_sent_payload_immutable_even_raw_sql(self):
        request, review, approval, attempt = self.start()
        for fields in ({"snapshot": {}}, {"create_payload": {}}, {"create_key": uuid.uuid4()}, {"request_id": uuid.uuid4()}):
            with self.subTest(fields=fields), self.assertRaises(IntegrityError), transaction.atomic():
                PaymentAttempt.objects.filter(id=attempt.id).update(**fields)
        def crash():
            raise SystemExit()
        self.provider.hooks["capture"] = crash
        with self.assertRaises(SystemExit):
            checkout.capture(request.owner_uuid, attempt.id, self.provider)
        with self.assertRaises(IntegrityError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("UPDATE purchases_paymentattempt SET capture_payload='{}'::jsonb WHERE id=%s", [attempt.id])
        with self.assertRaises(RuntimeError), transaction.atomic():
            checkout.reconcile(request.owner_uuid, attempt.id, self.provider)

    def test_provider_order_or_capture_id_cannot_be_reused_for_another_purchase(self):
        request, review, approval, attempt = self.start()
        other_request, other_review, other_approval = self.purchase()
        original_create = self.provider.create_order
        def duplicate_order(payload, key):
            original_create(payload, key)
            return {"id": attempt.provider_order_id}
        self.provider.create_order = duplicate_order
        duplicate, _ = checkout.start(other_request.owner_uuid, other_approval.id, self.provider)
        self.assertEqual(duplicate.state, "UNKNOWN")
        self.assertIsNone(duplicate.provider_order_id)
        self.assertEqual(duplicate.stock_hold_packs, 2)
        self.provider.create_order = original_create
        paid, _ = checkout.capture(request.owner_uuid, attempt.id, self.provider)
        self.assertEqual(paid.state, "PAID")
        third_request, third_review, third_approval, third = self.start()
        self.provider.complete(third.provider_order_id)
        self.provider.orders[third.provider_order_id]["capture"]["id"] = paid.capture_id
        result, _ = checkout.reconcile(third_request.owner_uuid, third.id, self.provider)
        self.assertEqual(result.state, "PAYMENT_REVIEW")
        self.assertEqual(result.stock_hold_packs, 2)


    def worker(self, function):
        def run():
            close_old_connections()
            try:
                return function()
            finally:
                close_old_connections()
        return run

    def test_double_create_single_dispatch_and_no_locks_while_waiting(self):
        request, review, approval = self.purchase()
        started, release = threading.Event(), threading.Event()
        def wait_for_release():
            started.set()
            assert release.wait(5), "create test synchronization timed out"
        self.provider.hooks["create"] = wait_for_release
        with ThreadPoolExecutor(max_workers=1) as pool:
            first = pool.submit(self.worker(lambda: checkout.start(request.owner_uuid, approval.id, self.provider)))
            try:
                self.assertTrue(started.wait(5))
                duplicate, status = checkout.start(request.owner_uuid, approval.id, self.provider)
                self.assertEqual((duplicate.state, status), ("CREATING", 202))
                self.assertEqual(self.stock(review), (100, 2, 1))
            finally:
                release.set()
            resolved, _ = first.result(timeout=10)
        self.assertEqual(duplicate.id, resolved.id)
        self.assertEqual(self.provider.calls["create"], 1)
        self.assertEqual(PaymentAttempt.objects.count(), 1)

    def test_double_capture_uncertain_reconcile_and_stop_dispatch_once(self):
        request, review, approval, attempt = self.start()
        started, release = threading.Event(), threading.Event()
        def wait_for_release():
            started.set()
            assert release.wait(5), "capture test synchronization timed out"
        self.provider.hooks["capture"] = wait_for_release
        with ThreadPoolExecutor(max_workers=1) as pool:
            first = pool.submit(self.worker(lambda: checkout.capture(request.owner_uuid, attempt.id, self.provider)))
            try:
                self.assertTrue(started.wait(5))
                duplicate, status = checkout.capture(request.owner_uuid, attempt.id, self.provider)
                self.assertEqual((duplicate.state, status), ("CAPTURING", 202))
                unknown, _ = checkout.reconcile(request.owner_uuid, attempt.id, self.provider)
                self.assertEqual(unknown.state, "UNKNOWN")
                stopped, _ = checkout.stop(request.owner_uuid, attempt.id)
                self.assertEqual(stopped.state, "UNKNOWN")
                self.assertEqual(self.stock(review)[1], 2)
            finally:
                release.set()
            paid, _ = first.result(timeout=10)
        self.assertEqual(paid.state, "PAID")
        self.assertEqual(self.provider.calls["capture"], 1)
        self.assertEqual(self.stock(review), (98, 0, 1))

    def test_same_offer_competing_requests_cannot_oversell(self):
        first_request, first_review, first_approval = self.purchase()
        second_request, second_review, second_approval = self.purchase()
        Offer.objects.filter(id=first_review.offer_id).update(stock_packs=2)
        barrier = threading.Barrier(2)
        def try_start(request, approval):
            barrier.wait(timeout=5)
            try:
                return checkout.start(request.owner_uuid, approval.id, self.provider)[0].state
            except services.DomainError as error:
                return error.code
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.worker(lambda r=r, a=a: try_start(r, a)))
                       for r, a in ((first_request, first_approval), (second_request, second_approval))]
            results = [future.result(timeout=10) for future in futures]
        self.assertCountEqual(results, ["AWAITING_BUYER", "REVIEW_CHANGED"])
        self.assertEqual(self.provider.calls["create"], 1)
        self.assertEqual(self.stock(first_review), (2, 2, 1))
        self.assertEqual(PaymentAttempt.objects.count(), 1)

    def test_stop_or_merchant_edit_during_preflight_blocks_capture(self):
        for action in ("stop", "mutate"):
            with self.subTest(action=action):
                request, review, approval, attempt = self.start()
                started, release = threading.Event(), threading.Event()
                def wait_for_release():
                    started.set()
                    assert release.wait(5), "preflight test synchronization timed out"
                self.provider.hooks["get"] = wait_for_release
                with ThreadPoolExecutor(max_workers=1) as pool:
                    first = pool.submit(self.worker(lambda: checkout.capture(request.owner_uuid, attempt.id, self.provider)))
                    try:
                        self.assertTrue(started.wait(5))
                        if action == "stop":
                            checkout.stop(request.owner_uuid, attempt.id)
                        else:
                            Offer.objects.filter(id=review.offer_id).update(price_cents=1800)
                    finally:
                        release.set()
                    result, _ = first.result(timeout=10)
                self.assertEqual(result.state, "STOPPED")
                self.assertEqual(self.provider.calls["capture"], 0)
                self.assertEqual(self.stock(review)[1], 0)
                self.provider.hooks.clear()
