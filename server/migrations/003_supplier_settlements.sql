CREATE TABLE supplier_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text NOT NULL REFERENCES bookings(id),
 supplier_id text NOT NULL REFERENCES suppliers(id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
 currency text NOT NULL DEFAULT 'KWD' CHECK(currency='KWD'), recipient_ref text NOT NULL,
 status text NOT NULL CHECK(status IN ('IN_REVIEW','APPROVED','SUBMITTING','PENDING','SETTLED','FAILED','CANCELLED')),
 requested_by text NOT NULL REFERENCES users(id), idempotency_key text NOT NULL UNIQUE,
 provider_ref text UNIQUE, submission_started_at timestamptz, settled_at timestamptz,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_settlements_supplier_idx ON supplier_settlements(supplier_id,created_at DESC);
CREATE INDEX supplier_settlements_booking_idx ON supplier_settlements(booking_id,supplier_id,status);
CREATE INDEX supplier_settlements_pending_idx ON supplier_settlements(status,updated_at) WHERE status IN ('SUBMITTING','PENDING');
CREATE TABLE supplier_settlement_approvals (
 settlement_id uuid NOT NULL REFERENCES supplier_settlements(id), actor_id text NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK(role IN ('staff','admin')), reason text NOT NULL CHECK(length(trim(reason))>0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(settlement_id,actor_id), UNIQUE(settlement_id,role)
);
CREATE FUNCTION protect_settlement_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'settlement evidence is immutable'; END IF;
 IF OLD.status IN ('SETTLED','FAILED','CANCELLED') THEN RAISE EXCEPTION 'settlement evidence is immutable'; END IF;
 IF ROW(OLD.booking_id,OLD.supplier_id,OLD.amount_minor,OLD.currency,OLD.recipient_ref,OLD.snapshot,OLD.requested_by,OLD.idempotency_key)
   IS DISTINCT FROM ROW(NEW.booking_id,NEW.supplier_id,NEW.amount_minor,NEW.currency,NEW.recipient_ref,NEW.snapshot,NEW.requested_by,NEW.idempotency_key)
 THEN RAISE EXCEPTION 'settlement terms are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER settlement_evidence_immutable BEFORE UPDATE OR DELETE ON supplier_settlements FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence();
CREATE FUNCTION protect_settlement_approvals() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'settlement approvals are immutable';
END $$;
CREATE TRIGGER settlement_approvals_immutable BEFORE UPDATE OR DELETE ON supplier_settlement_approvals FOR EACH ROW EXECUTE FUNCTION protect_settlement_approvals();
