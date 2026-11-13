CREATE TABLE admin_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text REFERENCES bookings(id),
  supplier_id text REFERENCES suppliers(id),
  expense_date date NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  paid_minor bigint NOT NULL CHECK(paid_minor BETWEEN 0 AND amount_minor),
  archived boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_expenses_date ON admin_expenses(expense_date) WHERE NOT archived;
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id text NOT NULL REFERENCES suppliers(id),
  booking_id text REFERENCES bookings(id),
  delivery_date date NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  paid_minor bigint NOT NULL CHECK(paid_minor BETWEEN 0 AND amount_minor),
  status text NOT NULL CHECK(status IN ('DRAFT','SENT','RECEIVED','CANCELLED')),
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_orders_booking_idx ON purchase_orders(booking_id);
CREATE INDEX purchase_orders_supplier_idx ON purchase_orders(supplier_id);
CREATE TABLE content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text NOT NULL,
  value text NOT NULL,
  created_by text NOT NULL REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_revisions_lookup ON content_revisions(content_key,created_at DESC);
CREATE TABLE content_publications (
  content_key text PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES content_revisions(id)
);
