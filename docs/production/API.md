# API, permissions and state transitions

Same-origin `/api`; opaque signed HttpOnly session cookies, server-owned role and identity. GET `/auth/session` supplies a CSRF token. POST needs the exact configured Origin, `X-CSRF-Token` and, for commands/financial mutations, a stable `Idempotency-Key`. Reuse the same key only for an identical retry. Do not create a new financial request to resolve an uncertain response.

## Endpoints

| Method/path | Purpose / access |
|---|---|
| GET /auth/session | Session and CSRF; anonymous allowed |
| POST /auth/register, /login, /verify, /resend | Real customer registration/verification/login; throttled |
| POST /auth/forgot-password, /reset-password | Expiring single-use reset; revokes sessions |
| POST /auth/mfa/complete | Privileged TOTP enrollment/challenge; replay protection |
| POST /auth/logout | Session revocation |
| POST /auth/invite | Owner invitation; activation sets password through emailed link |
| GET /state | Authorized compatibility projection; costs and other parties' records excluded |
| POST /commands | `{action,payload}`; transaction, server pricing/permissions, audit and idempotency |
| GET /catalog/:kind | Services/packages/suppliers; `q`, `page`, `pageSize` |
| GET /availability | `serviceId`, `date`; actual available quantity |
| GET /availability/batch | `date`; actual catalog capacity after reservations |
| GET /reports, /audit | Admin/staff reports; audit restricted by server policy |
| POST /payments/checkout | Owner customer; bookingId, milestone 0–2, optional amendment/method |
| POST /payments/:id/reconcile | Authorized actual provider payment ID lookup |
| POST /payments/:id/refresh | Authorized durable reconciliation job |
| POST /payments/:id/refunds | Owner-authorized refund; amount and reason |
| POST /webhooks/myfatoorah | Signed canonical provider payload; no browser authentication |
| POST /files?bookingId= | Authenticated multipart; allowlisted magic bytes, 10MB limit |
| GET /files/:id | Uploader or admin/staff; private attachment download |
| GET /contracts/:bookingId | Authorized frozen contract HTML/version |
| GET /documents/quote/:id, /documents/receipt/:id | Authorized quote / verified payment receipt |

Confirm route details against `server/app.mjs`, `auth.mjs` and `integrations.mjs`; authentication is enforced at server boundaries, independently of navigation visibility. Errors use non-2xx status and localized message/error envelope, with correlation ID for unexpected failures. Validation400, authentication401, authorization403, conflict409, throttle429, unavailable provider503. No sensitive card fields are accepted.

## Roles

- Customer: own profile, workspace, favorites, cart, drafts, bookings, quotes, consent, payments, cancellations, feedback and support.
- Supplier: assigned service lines, confirmations, execution, own uploads and service/date availability; no customer retail payment ledger or other supplier invoices.
- Staff: operational bookings, supplier coordination, one independent approval, permitted reports. Cannot impersonate owner, administer users or settle refunds by hand.
- Admin/owner: commercial settings, team invitations, catalogs, distinct owner approval and authorized refunds. MFA mandatory for admin/staff. Role changes revoke sessions; self-demotion of the active owner is rejected.

## State machines

Submission reserves capacity under sorted service locks. Supplier WAITING becomes CONFIRMED_SUPPLIER or REJECTED. A real alternative resets approvals and requires fresh confirmation. Staff and owner must approve independently before a quote is published. Customer acceptance freezes the quoted financials into a versioned contract; authenticated consent/name signs it. Signed base documents cannot be changed or deleted through SQL DML. Amendments need supplier confirmation, independent reviewers and separate explicit customer signature.

Payment CREATED → PENDING → PAID is controlled by authoritative gateway reconciliation, never the return URL. Uncertain creation stays durable and blocks another charge. Failed hosted invoices are reused to avoid two chargeable invoices. Refund requests remain pending until provider confirmation. Confirmed reservations are released only by the appropriate cancellation/expiry workflow. Outbox, notifications and reports derive from persisted operations.

Compatibility snapshots still grow with an owner's history. Paginated catalog endpoints exist, but complete admin history hydration is a documented scaling limit; production load testing must establish acceptable volume before broader rollout.

Supplier settlement endpoints, independent approvals, idempotency and authoritative transfer verification are described in [SUPPLIER-SETTLEMENTS.md](SUPPLIER-SETTLEMENTS.md). The ledger is implemented; the bank-facing bridge must be supplied/certified before enabling transfers.


## Owner configuration, paged records and delivery/signature APIs

- `GET /api/admin/integrations`; owner MFA only. `POST /api/admin/integrations/:id/{save,check,activate,disable}` requires password and revision. No secret values in readback.
- `GET /api/records/:kind?page=1&pageSize=25&q=&status=`. Maximum pageSize100. Kinds: bookings, payments, users, customers, suppliers, services, packages, tickets, audit. Role and ownership restrictions apply before counting. Response: items,total,page,pageSize,pages and optional payment summary. Booking filters include kind/occasion/area/date/max. Users are owner-only.
- `GET /api/records/{bookings,payments,audit}/export` applies the same filters/permissions with a read-only consistent snapshot and streamed output. CSV neutralizes leading spreadsheet formulas.
- `GET /api/notification-deliveries?page=1&status=`; staff/owner. Provider callback routes documented in INTEGRATIONS.md.
- `POST /api/signatures` with bookingId, signature and consent; authenticated owner of booking only. `GET /api/signatures/:id` is private to the requester. Verified external completion changes contract/booking states transactionally; browser return URLs cannot sign contracts.

- `GET /api/report-summary?period=6&occasion=`: owner/staff only; aggregate totals, funnel counts and monthly net cash/cost/tax from persisted financial records and completed refunds. Date/occasion filters execute in SQL. Read-only repeatable snapshots do not consume financial SERIALIZABLE predicate locks.
- `GET /api/calendar?month=YYYY-MM`: authenticated, scoped customer/supplier or owner/staff event counts for the entire month, independent of displayed booking page.
- `/api/state?route=` selects only bookings needed by the current screen. Initial owner overview is bounded to recent/relevant bookings; customer dashboard selects the owned active booking; supplier lists load booking pages separately. Header `X-App-Route` applies compatible projections after commands. Approval counters remain database-wide.
