# Database schema and integrity

Migration sources: `server/migrations/001_initial.sql`, `002_contract_integrity.sql` and `003_supplier_settlements.sql`. `node server/migrate.mjs` applies ordered files and records SHA256 checksums in schema_migrations. Applied migration files are immutable; create a new numbered migration for each change. Run exactly one migration job before starting/upgrading API and worker replicas. Migrations and their receipts commit together.

| Tables | Relationship / purpose |
|---|---|
| users, sessions, auth_tokens | Database identities, opaque hashed session tokens, expiring single-use verification/reset/MFA challenges. Email uniqueness enforced case-insensitively. |
| suppliers, catalog_services, packages | Supplier ownership, active catalog and integer capacity. User supplier role requires a supplier FK. |
| app_settings | Singleton boolean primary key=true; commercial settings, categories and policies. |
| workspaces | Per-user/visitor cart, drafts and preferences. ID cannot be selected by an untrusted request. |
| bookings, order_lines | Customer FK, state, event date, version and detailed line snapshots. Indexes cover customer/date/status and supplier assignments. |
| service_availability, reservations | Date-specific capacity overrides; HELD/CONFIRMED/RELEASED allocation lifecycle, unique booking/service. |
| contracts, approvals | Unique booking/version, document hash, signature status, independent approvals bound to quote hash. |
| payments, refunds, webhook_events | Amounts in bigint fils, gateway references, milestone and replay protection, verified event inbox. No PAN/CVV columns exist. |
| files | Owner/booking FKs, opaque storage key, MIME, size and SHA256. Storage content is outside DB. |
| notifications, tickets, scheduled_reminders | Per-user delivery/read state, support records and due reminders. |
| outbox | Atomic external intent, claim/retry/backoff/dead-job state and unique dedupe key. |
| command_idempotency | Actor/key composite primary key with request hash and recorded response. Same key with different request must fail. |
| supplier_settlements, supplier_settlement_approvals | Booking/supplier cost snapshots, frozen beneficiary reference, integer-fils liability allocation, independent approvals and verified transfer state; terminal records/approvals are immutable. |
| audit_log | Append-only action/resource/before/after metadata. UPDATE and DELETE rejected by trigger. |

Money checks reject negative line prices/costs and nonpositive payment/refund amounts. Status checks reject unknown booking/payment/reservation states. The state machine additionally enforces allowed transitions. Foreign keys prevent orphaned users/orders/contracts/financial entries. Unique active base-payment milestone prevents simultaneous charges for the same installment; amendments are explicitly separated in payment data.

Indexes include lower(email), sessions(user_id/expiry), supplier lines, bookings(customer_id,created_at DESC), bookings(occasion_date,status), reservations(service_id,event_date,status), pending outbox claim order, unread notifications and due reminders. For search-heavy catalog growth, add reviewed trigram/FTS indexes based on actual query plans. Arbitrary unbounded JSON scans are not a substitute for pagination.

Development: set DATABASE_URL=pglite:./data/development or a local PostgreSQL URL. `node server/seed-demo.mjs` requires ENABLE_DEMO=true and DEV_DEMO_PASSWORD>=12characters. It seeds catalog/suppliers/packages and four dev identities but deliberately creates zero financial transactions or bookings. A clean production DB starts empty; first owner bootstrap creates settings and one privileged account only.

All DB access uses parameterized SQL. Row/object authorization must run in API/business code; the schema alone does not enforce customer isolation. Direct DB access is restricted to authorized operators; never expose the database network to public clients.


## Migrations004–008

004 adds encrypted draft/active owner integration settings with revisions;005 stores delivery intents and verified event inbox;006 external signature requests bound to immutable contract versions;007 large-list indexes;008 payment_valuations view for net verified cash, frozen document costs and tax allocations. There are31 application tables including schema receipts, plus the valuation view. Real financial/booking mutations retain SERIALIZABLE with retries; paged reads/exports/report snapshots use REPEATABLE READ READ ONLY.
