"""PostgreSQL guards cover bulk ORM updates as well as ordinary model saves."""
from django.db import migrations

SQL = """
CREATE FUNCTION spendconsent_review_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Review snapshots are immutable' USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER immutable_review BEFORE UPDATE OR DELETE ON purchases_review
FOR EACH ROW EXECUTE FUNCTION spendconsent_review_immutable();

CREATE FUNCTION spendconsent_approval_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Approval records are retained' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (NEW.id, NEW.review_id, NEW.approved_at, NEW.expires_at)
       IS DISTINCT FROM (OLD.id, OLD.review_id, OLD.approved_at, OLD.expires_at)
     OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RAISE EXCEPTION 'Approval authority is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_approval BEFORE UPDATE OR DELETE ON purchases_approval
FOR EACH ROW EXECUTE FUNCTION spendconsent_approval_immutable();

CREATE FUNCTION spendconsent_offer_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.sku, NEW.variant_id, NEW.name, NEW.category, NEW.attributes, NEW.pack_units,
      NEW.price_cents, NEW.shipping_cents, NEW.tax_bps, NEW.one_time)
     IS DISTINCT FROM
     (OLD.sku, OLD.variant_id, OLD.name, OLD.category, OLD.attributes, OLD.pack_units,
      OLD.price_cents, OLD.shipping_cents, OLD.tax_bps, OLD.one_time) THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER material_offer_version BEFORE UPDATE ON purchases_offer
FOR EACH ROW EXECUTE FUNCTION spendconsent_offer_version();

CREATE FUNCTION spendconsent_request_owner_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.owner_uuid, NEW.client_submission_id, NEW.submission_digest, NEW.text)
       IS DISTINCT FROM (OLD.id, OLD.owner_uuid, OLD.client_submission_id, OLD.submission_digest, OLD.text) THEN
    RAISE EXCEPTION 'Request identity is immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_request_identity BEFORE UPDATE ON purchases_purchaserequest
FOR EACH ROW EXECUTE FUNCTION spendconsent_request_owner_immutable();
"""

REVERSE = """
DROP TRIGGER immutable_request_identity ON purchases_purchaserequest;
DROP FUNCTION spendconsent_request_owner_immutable();
DROP TRIGGER material_offer_version ON purchases_offer;
DROP FUNCTION spendconsent_offer_version();
DROP TRIGGER immutable_approval ON purchases_approval;
DROP FUNCTION spendconsent_approval_immutable();
DROP TRIGGER immutable_review ON purchases_review;
DROP FUNCTION spendconsent_review_immutable();
"""


class Migration(migrations.Migration):
    dependencies = [("purchases", "0002_sample_catalog")]
    operations = [migrations.RunSQL(SQL, REVERSE)]
