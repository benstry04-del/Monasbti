CREATE TABLE suppliers (
 id text PRIMARY KEY, name text NOT NULL, data jsonb NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
 id text PRIMARY KEY, email text NOT NULL, name text NOT NULL, mobile text NOT NULL DEFAULT '',
 role text NOT NULL CHECK(role IN ('customer','staff','admin','supplier')), supplier_id text REFERENCES suppliers(id),
 password_hash text NOT NULL, verified_at timestamptz, active boolean NOT NULL DEFAULT true, mfa_secret text, mfa_last_step bigint NOT NULL DEFAULT -1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (role <> 'supplier' OR supplier_id IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_lower_unique ON users(lower(email));
CREATE INDEX users_supplier_idx ON users(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE TABLE sessions (
 id text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE CASCADE, csrf_token text NOT NULL,
 expires_at timestamptz NOT NULL, mfa_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE auth_tokens (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL,
 expires_at timestamptz NOT NULL, consumed_at timestamptz, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens(user_id,purpose,expires_at) WHERE consumed_at IS NULL;
CREATE TABLE app_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE catalog_services (
 id text PRIMARY KEY, supplier_id text REFERENCES suppliers(id), name text NOT NULL, data jsonb NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true, capacity integer NOT NULL DEFAULT 1 CHECK(capacity>0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalog_services_supplier_idx ON catalog_services(supplier_id,active);
CREATE INDEX catalog_services_name_idx ON catalog_services(lower(name));
CREATE TABLE packages (id text PRIMARY KEY, title text NOT NULL, data jsonb NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true);
CREATE TABLE workspaces (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE bookings (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES users(id), status text NOT NULL, occasion_date date NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), data jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status IN ('DRAFT','REQUESTED','INTERNAL_REVIEW','SUPPLIER_CONFIRMATION','QUOTE_READY','CUSTOMER_REVIEW','CONTRACT_PENDING','CONTRACT_APPROVED','SIGNED','PAYMENT_PENDING','CONFIRMED','PREPARATION','IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED','NEEDS_CHANGES','SUPPLIER_UNAVAILABLE','PAYMENT_FAILED','DISPUTED','NEEDS_OWNER_APPROVAL'))
);
CREATE INDEX bookings_customer_created_idx ON bookings(customer_id,created_at DESC);
CREATE INDEX bookings_date_status_idx ON bookings(occasion_date,status);
CREATE TABLE order_lines (
 id text PRIMARY KEY, booking_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
 service_id text REFERENCES catalog_services(id), supplier_id text REFERENCES suppliers(id), qty integer NOT NULL CHECK(qty>0),
 cost_minor bigint CHECK(cost_minor>=0), price_minor bigint NOT NULL CHECK(price_minor>=0), data jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX order_lines_booking_idx ON order_lines(booking_id);
CREATE INDEX order_lines_supplier_idx ON order_lines(supplier_id,booking_id);
CREATE TABLE service_availability (
 service_id text NOT NULL REFERENCES catalog_services(id), event_date date NOT NULL, capacity integer NOT NULL CHECK(capacity>=0),
 blocked boolean NOT NULL DEFAULT false, PRIMARY KEY(service_id,event_date)
);
CREATE TABLE reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text NOT NULL REFERENCES bookings(id), service_id text NOT NULL REFERENCES catalog_services(id),
 event_date date NOT NULL, qty integer NOT NULL CHECK(qty>0), status text NOT NULL CHECK(status IN ('HELD','CONFIRMED','RELEASED')),
 expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(booking_id,service_id)
);
CREATE INDEX reservations_capacity_idx ON reservations(service_id,event_date,status);
CREATE INDEX reservations_expiry_idx ON reservations(expires_at) WHERE status='HELD';
CREATE TABLE contracts (
 id text PRIMARY KEY, booking_id text NOT NULL REFERENCES bookings(id), version integer NOT NULL CHECK(version>0),
 status text NOT NULL, document_hash text NOT NULL, data jsonb NOT NULL DEFAULT '{}', signed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(booking_id,version)
);
CREATE INDEX contracts_booking_idx ON contracts(booking_id,version DESC);
CREATE TABLE approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text NOT NULL REFERENCES bookings(id), actor_id text NOT NULL REFERENCES users(id),
 role text NOT NULL, reason text NOT NULL, quote_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(booking_id,actor_id,quote_hash)
);
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text NOT NULL REFERENCES bookings(id), user_id text NOT NULL REFERENCES users(id),
 provider text NOT NULL, provider_reference text UNIQUE, amount_minor bigint NOT NULL CHECK(amount_minor>0), currency text NOT NULL DEFAULT 'KWD' CHECK(currency='KWD'),
 milestone integer NOT NULL DEFAULT 0 CHECK(milestone BETWEEN 0 AND 2),
 status text NOT NULL CHECK(status IN ('CREATED','PENDING','PAID','FAILED','REFUND_PENDING','REFUNDED')),
 data jsonb NOT NULL DEFAULT '{}', idempotency_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_status_idx ON payments(booking_id,status);
CREATE UNIQUE INDEX payments_active_milestone_unique ON payments(booking_id,milestone) WHERE status IN ('CREATED','PENDING','PAID','REFUND_PENDING') AND COALESCE((data->>'amendment')::boolean,false)=false;
CREATE TABLE refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED')), provider_ref text, idempotency_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_payment_idx ON refunds(payment_id,status);
CREATE TABLE webhook_events (
 provider text NOT NULL, event_id text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'PENDING',
 created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, PRIMARY KEY(provider,event_id)
);
CREATE TABLE audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text, action text NOT NULL, resource_type text NOT NULL, resource_id text,
 before_data jsonb, after_data jsonb, ip text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_resource_idx ON audit_log(resource_type,resource_id,created_at DESC);
CREATE INDEX audit_actor_idx ON audit_log(actor_id,created_at DESC);
CREATE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_log is append only'; END; $$;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_immutable();
CREATE TABLE notifications (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), data jsonb NOT NULL DEFAULT '{}', read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id,created_at DESC) WHERE read_at IS NULL;
CREATE TABLE files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES users(id), booking_id text REFERENCES bookings(id),
 storage_key text NOT NULL UNIQUE, filename text NOT NULL, mime text NOT NULL, size bigint NOT NULL CHECK(size>0), sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tickets (id text PRIMARY KEY, user_id text REFERENCES users(id), data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX tickets_user_idx ON tickets(user_id,created_at DESC);
CREATE TABLE outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','DEAD')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz,
 last_error text, dedupe_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_claim_idx ON outbox(available_at,created_at) WHERE status='PENDING';
CREATE TABLE command_idempotency (
 actor_id text NOT NULL, key text NOT NULL, action text NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,key)
);
CREATE TABLE scheduled_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text REFERENCES bookings(id), user_id text NOT NULL REFERENCES users(id),
 due_at timestamptz NOT NULL, kind text NOT NULL, sent_at timestamptz, UNIQUE(booking_id,user_id,kind,due_at)
);
CREATE INDEX scheduled_reminders_due_idx ON scheduled_reminders(due_at) WHERE sent_at IS NULL;
