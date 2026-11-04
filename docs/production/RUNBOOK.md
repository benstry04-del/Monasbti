# Production operations runbook

## Start and health

Check database connectivity and applied migrations before the API/worker. `/health/live` covers process liveness and `/health/ready` must include database access. Alert on sustained5xx, auth rejection spikes, ready failures, slow DB statements, gateway reconciliation errors, outbox age/dead jobs, file storage errors and low disk capacity. Keep request correlation IDs in logs; never log raw auth tokens, passwords, card data or unredacted webhook/message payloads. Restrict metrics and diagnostics to operators.

## Backups and restore

- Prefer managed PostgreSQL point-in-time recovery with encrypted WAL archives and daily snapshots. Define business-approved RPO/RTO, retention, legal deletion periods and offsite access policy before launch. A volume alone is not a backup.
- Self-hosted example: `pg_dump --format=custom --no-owner --file=backup.dump "$DATABASE_URL"` from an authorized operational host. Pass credentials through the environment/secret store rather than shell history. Encrypt/upload the dump and verify its checksum. Backup the uploads/object store and preserve version IDs alongside the DB snapshot. Protect ENCRYPTION_KEY separately: losing it makes encrypted MFA secrets unrecoverable.
- Restore to a new isolated database using `pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" backup.dump`; never overwrite live production as a routine test. Validate schema_migrations, row counts, foreign keys, payment totals, contract hashes and representative files. Run application smoke tests before cutover.
- A restored database can lag gateway truth. Reconcile all potentially missing payment/refund events using provider transaction lookup and stable references before accepting new charges or settlements. Never replay charges from an unreviewed outbox copy.
- Exercise restore in staging regularly and record elapsed recovery time and reconciliation evidence. Backup success without a restore drill is insufficient.

## Payment incident

Disable new checkout initiation if provider availability is unknown; allow read-only customer history. A browser return is not evidence of payment. Query provider by stored reference and compare merchant account, KWD currency, amount and booking identity. Reprocess a verified persisted inbox event using idempotent operations. Never manually edit PAID to conceal an unresolved mismatch. Refunds require authorization, remaining refundable balance and gateway confirmation. Audit incident actions and communicate via approved channels.

## Queue and notification incident

Inspect outbox DEAD records and last_error in an access-controlled operator context. Fix credentials/provider restrictions first, then requeue the same dedupe key rather than inserting a duplicate customer notification. Reclaim stale PROCESSING leases according to worker policy. SMTP acceptance is not proof of recipient delivery; use provider bounce/delivery callbacks where supported. Do not mark a failed notification delivered.

## Security incident

Revoke affected sessions and reset credentials through the verified flow. Rotate COOKIE_SECRET if session signing is compromised, and encryption keys using a documented re-encryption procedure (blind rotation loses MFA decryptability). Preserve audit evidence and restrict DB writes. Enforce MFA for privileged accounts. Audit append-only triggers protect against normal application mutation; database superusers remain capable of tampering, so ship audit evidence to an independently controlled immutable log store where required.

## Capacity and double-booking incident

Freeze affected service/date sale, inspect reservations and provider/payment state under transaction locks, release only expired/unfunded holds according to policy, and contact affected parties through operational workflow. Never delete confirmed allocations merely to make the count fit. Monitor transaction retries and pool saturation; scale workers/API only after verifying lock scope and provider limits.

## Release gate

Use the final READINESS report, confirmed commercial settings, no demo credentials/data, production URLs, configured delivery/checkout/storage, successful PostgreSQL integration/E2E tests, TLS cookie validation, native-browser device checks, load test, restore drill and provider sandbox-to-live reconciliation. Outstanding business or credential requirements keep the launch gate closed rather than being silently bypassed.

## Supplier transfer incident

A supplier settlement in SUBMITTING with submission_started_at is an uncertain external instruction, not a failed transfer safe to retry. Query the bridge/bank using the immutable local settlement UUID, frozen recipient, amount and bank reference. Never reset submission_started_at, cancel a submitted record or issue another payout merely because the response timed out. Requeue lookup jobs only. A terminal contradiction or amount/reference/recipient mismatch requires incident investigation and independent bank evidence; the system preserves the ledger and records a dead-letter/Sentry/log signal rather than overwriting final evidence. Confirm the external bridge maps FAILED to an irrevocably rejected transfer before allowing allocation release.
