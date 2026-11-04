CREATE TABLE signature_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id text NOT NULL REFERENCES bookings(id),
 contract_id text NOT NULL UNIQUE REFERENCES contracts(id), user_id text NOT NULL REFERENCES users(id),
 document_hash text NOT NULL, signer_email text NOT NULL,
 status text NOT NULL CHECK(status IN ('CREATED','READY','COMPLETED','DECLINED','EXPIRED','MANUAL_REVIEW')),
 provider_ref text UNIQUE, signing_url_ciphertext text, first_attempt_at timestamptz,
 consent jsonb NOT NULL, proof jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signature_booking_idx ON signature_requests(booking_id,created_at DESC);
CREATE INDEX signature_pending_idx ON signature_requests(status,updated_at) WHERE status IN ('CREATED','READY');
