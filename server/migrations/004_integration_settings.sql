CREATE TABLE integration_settings (
 id text PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 ciphertext text NOT NULL,
 active_ciphertext text, active_revision integer NOT NULL DEFAULT 0,
 updated_by text REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 last_check jsonb NOT NULL DEFAULT '{}'
);
