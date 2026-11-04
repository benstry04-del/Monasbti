# Supplier settlements — implemented 2026-11-01

This module records actual supplier liabilities, approval evidence, durable payment intents and verified transfer outcomes. It does not claim that a bank account or marketplace payout service is connected.

## Accounting and permissions

Only COMPLETED bookings with signed contract state qualify. The server snapshots the supplier's normalized order-line cost × quantity in integer KWD fils, subtracting every non-cancelled/non-failed prior settlement. A booking lock and SERIALIZABLE transaction prevent two operators allocating the same balance. The client cannot supply an amount or recipient override.

The owner configures `payoutRecipientId` in the supplier form: an opaque beneficiary reference issued by the approved payment service, not card details. A settlement freezes that reference and the agreed costs. Changing the supplier later cannot redirect an already approved settlement.

Staff and owner each approve once with a reason; one user/role cannot approve both stages. Both require an MFA-verified session. Only the owner can submit or cancel. Cancellation is allowed before external submission only. Supplier accounts see only their own records and costs; customers cannot access settlements. Terminal settlement evidence and approval records reject database mutation/deletion.

## Routes and interface

- `/admin/settlements`: eligible completed costs, request, independent approval, submission, reconciliation and pre-submission cancellation.
- `/supplier/settlements`: supplier-scoped transfer history and totals; no transfer/approval controls.
- GET `/api/settlements?page=1`: 25 records/page and scoped database totals; GET `/api/settlements/eligible`: first100 eligible booking/supplier balances.
- POST `/api/settlements`: `{bookingId,supplierId}` and Idempotency-Key.
- POST `/api/settlements/:id/approve`: `{reason}`; `/submit`: `{}`; `/cancel`: `{reason}`; `/refresh`: `{}` and Idempotency-Key.
- POST `/api/webhooks/supplier-payouts`: authenticated provider notification, never direct settlement authority.

States: IN_REVIEW → APPROVED → SUBMITTING → PENDING → SETTLED or terminal FAILED. IN_REVIEW/APPROVED may become CANCELLED. SETTLED requires authoritative recipient/reference/currency/amount verification. A disabled provider cannot turn an approval into a successful transfer. Settled totals include SETTLED only.

## Bridge protocol and required implementation

`SupplierPayoutBridge` implements an explicit HTTPS protocol for an organization-operated bridge or a payout vendor that supports this exact contract. It is **not** a native MyFatoorah, bank or Twilio payout adapter. Connecting an actual bank/marketplace requires implementing/certifying the bridge's bank-facing side or replacing this class with a vendor-specific adapter. Credentials alone do not create that integration.

Configure SUPPLIER_PAYOUT_PROVIDER=bridge, SUPPLIER_PAYOUT_ENVIRONMENT=sandbox/live, SUPPLIER_PAYOUT_BASE_URL, SUPPLIER_PAYOUT_API_KEY and a32+character SUPPLIER_PAYOUT_WEBHOOK_SECRET. Production refuses a sandbox/default environment. No credentials should be exposed to Vite. Requests use Bearer authorization, TLS,15s timeout and refuse redirects.

POST `{base}/payouts` with Idempotency-Key equal to the local settlement UUID:

```json
{"externalId":"settlement-uuid","recipientRef":"approved-beneficiary-reference","amountMinor":21002,"currency":"KWD"}
```

The bridge must persist idempotency before initiating any bank instruction, return the same instruction for repeated keys, never create two transfers for one key, and support recovery after timeout. The application does not trust the POST response as settlement evidence. It persists submission_started_at before POST; later job retries only query the existing external ID.

GET `{base}/payouts/by-external-id/{uuid}` returns authoritative current truth:

```json
{"id":"immutable-bank-transfer-reference","externalId":"settlement-uuid","recipientRef":"approved-beneficiary-reference","amountMinor":21002,"currency":"KWD","status":"PROCESSING"}
```

Status may be PROCESSING, SUCCEEDED or FAILED. FAILED must mean an irrevocably rejected/cancelled transfer that can never debit later; a failed individual attempt or uncertain timeout must remain PROCESSING/unknown, never FAILED. A settled transfer's reference/recipient/amount must be immutable. Decimal major currency units are not accepted. Bank fees must not silently reduce the beneficiary amount; commercial fee policy needs explicit review.

Webhook body: `{eventId,externalId,timestamp}` with timestamp in Unix milliseconds. Header X-Payout-Signature is lowercase hex HMAC-SHA256 over `eventId.externalId.timestamp` using the webhook secret. Notifications outside ±5minutes or with altered IDs are rejected. A duplicate event queues one lookup. The worker always performs GET and checks all authoritative fields before ledger mutation; the webhook cannot directly declare success. Provider bridge clocks must be synchronized.

## Recovery, jobs and activation

SUPPLIER_PAYOUT_SUBMIT records the external attempt before the request. A response lost after bank acceptance does not cause a second POST. SUPPLIER_PAYOUT_RECONCILE queries pending transfers, retries failures with the existing outbox backoff, and schedules a further lookup for PROCESSING. Mismatch is a permanent exception/dead letter requiring an operator investigation; no automatic balance release or fake success. Unknown submission that cannot be found must be reconciled by bank operations, not cancelled locally and retried as a new transfer.

Test on a separately approved sandbox: success, final rejection, timeout after bank acceptance, duplicate submission/webhook, wrong recipient/reference/currency/amount, webhook-first ordering and worker crash/restart. Confirm actual beneficiary credit and fees with the provider before enabling production. No live supplier transfer was initiated during implementation.
