# HABB ALSAAD service architecture

The approved React/Vite RTL application remains the presentation layer. Production data is served by the same-origin Node22/Fastify API. Browser localStorage may retain cosmetic preferences (intro version, mute, reduced motion), but is not an authority for users, roles, prices, availability, contracts or payments.

Components:

| Layer | Responsibility |
|---|---|
| React frontend | Approved routes/components/motion, client validation and loading/empty/error/retry states; session-specific server projection |
| HTTP API | Origin/CSRF checks, secure session authentication, request validation, rate limits, object authorization, consistent error responses |
| Business service | Booking state machine, server pricing, approvals, reservations and immutable contract snapshots inside transactions |
| PostgreSQL | Normalized authoritative records, foreign keys/checks/unique constraints, relational queries and atomic outbox |
| Integrations | Provider-hosted checkout, verified webhooks, notification channels, document rendering and storage behind adapters |
| Worker | Outbox jobs, retries, reminders, webhook work, document generation; no synchronous outbound mail inside booking transaction |
| Observability | Structured request logs, health/readiness, audit trail and monitoring hooks; no passwords, full tokens, card details or message bodies in logs |

Production uses PostgreSQL through `pg.Pool`. PGlite is an actual embedded PostgreSQL engine for local development/tests, explicitly forbidden by `server/db.mjs` when NODE_ENV=production. It cannot validate a multi-host production deployment. Docker Compose provides PostgreSQL17, API, migration job, worker and Caddy TLS reverse proxy. The database has no published host port. Production may use managed PostgreSQL and object storage instead.

`transaction(fn)` uses SERIALIZABLE and retries SQLSTATE40001/40P01 up to3 times with backoff. Work passed to a retryable transaction must contain database operations only; never perform gateway charges or SMTP delivery inside a retrying callback. Record external intent in outbox then let a worker call the adapter using a stable idempotency key.

Capacity reservations are service/date/quantity records. A booking mutation must lock the service/availability rows before reading the sum of active reservations. HELD expiry and release are explicit; CONFIRMED allocations cannot be created merely from a browser redirect. PostgreSQL unique active-payment constraints prevent two simultaneous active payments for the same base milestone, and provider/idempotency references prevent replay. Source amounts are integer KWD minor units (1KWD=1000fils); never use browser-supplied amounts for charges.

Snapshots in JSONB preserve the approved UI's rich document shapes while indexed parent/line/financial records provide relational authority. The JSON and relational projections must be updated in the same transaction. Existing signed contract versions are immutable business records; new change orders create a new version/appendix. Audit records are append-only at the DB trigger layer. Production DB credentials must not be a superuser/table-owner available to an untrusted application operator; a table owner can still disable triggers.

Environment separation is physical: independent DB, storage prefix/bucket, integration accounts, secrets, hostname and monitoring namespace per development/staging/production. Demo seeding is explicit and refuses production. There is no automatic migration from arbitrary old localStorage contents; legacy bookings require a reviewed import with reconciliation, especially finances.

This architecture does not by itself establish legal validity of an e-signature or compliance of a payment merchant. Launch requires commercial agreement, account activation, reviewed policies and execution of the readiness checklist in READINESS.md.
