CREATE TABLE notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL UNIQUE REFERENCES outbox(id),
 user_id text REFERENCES users(id), channel text NOT NULL CHECK(channel IN ('EMAIL','SMS','WHATSAPP')),
 provider text NOT NULL CHECK(provider IN ('smtp','resend','twilio')),
 provider_message_id text, recipient_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('SENDING','ACCEPTED','SENT','DELIVERED','READ','DELAYED','FAILED','BOUNCED','COMPLAINED','UNKNOWN')),
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX delivery_provider_message_unique ON notification_deliveries(provider,provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX delivery_user_created_idx ON notification_deliveries(user_id,created_at DESC);
CREATE INDEX delivery_status_created_idx ON notification_deliveries(status,created_at DESC);
CREATE TABLE notification_delivery_events (
 provider text NOT NULL, event_id text NOT NULL, message_id text NOT NULL, status text NOT NULL,
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider,event_id)
);
CREATE INDEX delivery_events_message_idx ON notification_delivery_events(provider,message_id,created_at);
