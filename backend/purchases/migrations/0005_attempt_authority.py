"""Keep a dispatched purchase immutable even through bulk ORM/raw SQL writes."""
from django.db import migrations

SQL = """
CREATE FUNCTION spendconsent_attempt_authority() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_request uuid; expected_snapshot jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payment evidence is retained' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  SELECT r.request_id, r.snapshot INTO expected_request, expected_snapshot
    FROM purchases_approval a JOIN purchases_review r ON a.review_id=r.id WHERE a.id=NEW.approval_id;
  IF NEW.request_id IS DISTINCT FROM expected_request OR NEW.snapshot IS DISTINCT FROM expected_snapshot THEN
    RAISE EXCEPTION 'Attempt must bind its approved request snapshot' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW.request_id, NEW.approval_id, NEW.snapshot, NEW.create_payload,
        NEW.create_key, NEW.capture_key, NEW.create_dispatched_at)
      IS DISTINCT FROM
       (OLD.id, OLD.request_id, OLD.approval_id, OLD.snapshot, OLD.create_payload,
        OLD.create_key, OLD.capture_key, OLD.create_dispatched_at)
      OR (OLD.provider_order_id IS NOT NULL AND NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id)
      OR (OLD.capture_id IS NOT NULL AND NEW.capture_id IS DISTINCT FROM OLD.capture_id)
      OR (OLD.capture_dispatched_at IS NOT NULL AND
          (NEW.capture_dispatched_at, NEW.capture_payload) IS DISTINCT FROM (OLD.capture_dispatched_at, OLD.capture_payload))
      OR (NEW.capture_dispatched_at IS NULL AND NEW.capture_payload IS DISTINCT FROM OLD.capture_payload)
      OR NEW.stock_hold_packs NOT IN (OLD.stock_hold_packs, 0)
      OR (OLD.state IN ('PAID', 'STOPPED', 'PAYMENT_REVIEW') AND NEW.state <> OLD.state) THEN
      RAISE EXCEPTION 'Attempt authority and dispatched quote are immutable' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_attempt_authority BEFORE INSERT OR UPDATE OR DELETE ON purchases_paymentattempt
FOR EACH ROW EXECUTE FUNCTION spendconsent_attempt_authority();
"""


class Migration(migrations.Migration):
    dependencies = [("purchases", "0004_remove_paymentattempt_one_active_attempt_per_request_and_more")]
    operations = [migrations.RunSQL(SQL, "DROP TRIGGER immutable_attempt_authority ON purchases_paymentattempt; DROP FUNCTION spendconsent_attempt_authority();")]
