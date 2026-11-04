# Integrations and configuration

Secrets belong in a secret manager or uncommitted server `.env`; never VITE_ variables, client bundles, source control or chat. Each environment must have separate database, encryption/cookie keys, gateway account and sender configuration. Node22 entrypoints load `.env` without overriding process variables.

| Service | Required values / activation |
|---|---|
| PostgreSQL | DATABASE_URL; DB_SSL=require and DB_CA for managed TLS. Production rejects embedded engines and privileged runtime DB users. DB_POOL_MAX controls connection allocation. |
| Web/session | HTTPS APP_ORIGIN; COOKIE_SECRET at least32 random characters; ENCRYPTION_KEY64 hex characters; SESSION_HOURS; controlled TRUST_PROXY. Keep keys stable across replicas/restarts. |
| Compose | APP_HOST, POSTGRES_PASSWORD and DB_APP_PASSWORD32+ random URL-safe characters; migration role owns tables, restricted habb_runtime serves API/worker. |
| First owner | BOOTSTRAP_OWNER_EMAIL/NAME/MOBILE/PASSWORD and production BOOTSTRAP_MFA_SECRET Base32. Run once, remove bootstrap values; provision authenticator securely. |
| MyFatoorah | PAYMENT_PROVIDER=myfatoorah, MYFATOORAH_API_KEY, MYFATOORAH_ENVIRONMENT=sandbox/live, MYFATOORAH_WEBHOOK_SECRET. Merchant onboarding, KNET/card activation and settlement account required. Production refuses sandbox. |
| Email | SMTP_HOST/PORT/USER/PASSWORD, MAIL_FROM, SMTP_SECURE. Verified SPF/DKIM/DMARC sender; production requires TLS. OPERATIONS_EMAIL for alerts. |
| SMS | TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM; approved sender and E.164 recipient with explicit consent. |
| WhatsApp | Same Twilio credentials plus TWILIO_WHATSAPP_FROM and approved ContentSid template per message. Business approval and customer consent required. |
| Files | STORAGE_DIR persistent private volume, shared by API/worker, backed up with database. No public upload directory. |
| Monitoring | Optional SENTRY_DSN enables actual backend exception capture; LOG_LEVEL and METRICS_TOKEN protect structured logs/metrics. Configure central collection and alerts externally. |

MyFatoorah uses hosted checkout: persist intent → create hosted invoice → redirect → signed webhook inbox → worker fetches authoritative transaction → verify reference, currency, amount and success → one ledger/state update. Never store PAN/CVV. Provider timeouts are ambiguous, not failures safe to charge again. Worker reconciliation/refund jobs retry queries; uncertain mutations require provider lookup and operator evidence. Exercise both webhook-first and return-first ordering, duplicates, outages, failed payment retry and refunds in merchant sandbox before production activation.

SMTP/Twilio acceptance is not proof of delivery. Outbox retries/dead letters are available; bounce/status callback ingestion and delivery dashboards require further implementation if delivery SLAs demand them. SMS/WhatsApp adapters are callable by jobs; the default application workflow uses email and in-app notifications, not automatic opt-in to every channel.

Contract HTML is immutable and hashed with authenticated clickwrap evidence. Certified third-party electronic signature remains an explicit adapter/interface returning unavailable until a provider-specific integration and legal review are completed. Do not advertise a certified signature based on clickwrap alone.

Release evidence variables SANDBOX_CERTIFICATION_REFERENCE, RESTORE_DRILL_REFERENCE and SECURITY_REVIEW_REFERENCE identify actual completed reviews. `npm run audit:launch` checks configuration and database gates; it does not independently certify any review.

Primary provider documentation: [MyFatoorah](https://docs.myfatoorah.com/), [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource). Merchant credentials and real network settlement were not available during local verification.

Supplier payouts use a separate configured HTTPS bridge or vendor adapter, not the customer checkout merchant account automatically. See [SUPPLIER-SETTLEMENTS.md](SUPPLIER-SETTLEMENTS.md) for the exact contract, environment keys, recovery rules and bank certification requirements.


## Owner-managed encrypted settings (November 2026)

See CONFIGURATION-ENTRY.md. `/api/admin/integrations` returns field metadata, nonsecret configuration and secret presence only. Owner MFA and password step-up protect save/check/activate/disable. Draft and active encrypted envelopes are separate; revisions prevent concurrent or stale activation. API requests and worker jobs use isolated runtime snapshots; secrets are never inserted in public application state. ENCRYPTION_KEY is infrastructure bootstrap material and must survive backups/redeployment.

### Delivery verification

Resend callbacks: `/api/webhooks/resend`, configure `RESEND_WEBHOOK_SECRET`. Svix verifies the original raw bytes and timestamp before JSON parsing. Twilio callbacks: `/api/webhooks/twilio`, using the configured public APP_ORIGIN, AccountSid and official SDK signature verification over the full form parameters. Optional deliveryId binds an uncertain outbound attempt to its verified recipient/reference. Duplicate inbox events are idempotent; late SENT does not undo DELIVERED/READ. SMTP proves acceptance only; Resend/Twilio verified callbacks establish delivery. Ambiguous SMTP/Twilio sends are held for review rather than blindly repeated. Resend retries reuse the same idempotency key within its recovery window.

### External signature bridge contract

Optional `ESIGNATURE_MODE=bridge` replaces initial contract clickwrap, including a server guard against bypass. `POST /envelopes` accepts externalId, frozen HTML/document hash, signer and return URL; `GET /envelopes/by-external-id/:id` reconciles uncertain creates; `GET /envelopes/:providerReference/document` retrieves the signed PDF. Inspect server/providers/esignature.mjs for the exact schema. Signing origin must be allowed explicitly. Signed webhooks at `/api/webhooks/esignature` enqueue authoritative reconciliation; they do not directly mark a contract signed. Completion must match signer, frozen version/hash and PDF SHA-256, and recheck commercial lines, cancellation and availability transactionally. Original frozen HTML stays immutable. Proof files are private. A cancelled/stale request goes to MANUAL_REVIEW. Existing amendment signing retains the separately audited consent workflow; certification for amendments requires a provider-specific extension if the legal policy demands it.

This bridge is an integration boundary, not a claim of DocuSign/QES or local certification. The business must select the approved provider and establish its bridge/native mapping before enabling certified signatures.
