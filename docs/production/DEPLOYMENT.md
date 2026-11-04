> تحديث 3 نوفمبر 2026: بطلب المالك أُلغي إعداد تطبيق المصادقة والتحقق به لجميع الأدوار، بما فيها الحسابات التي سبق تفعيل المصادقة لها. الدخول بالبريد وكلمة المرور؛ صلاحيات الأدوار وإعادة كلمة المرور للعمليات الحساسة ما زالت مطبقة. لم يعد إعداد TOTP شرطًا للتهيئة أو الإطلاق. تلغي migration009 التحديات القديمة، ومسار إكمالها أُزيل. أي ذكر سابق لإلزام MFA أدناه سجل سابق لهذه السياسة.

# Deployment and environments

## Local development

Use Node22 and `npm ci`. Copy `.env.example` to `.env` and provide random COOKIE_SECRET/ENCRYPTION_KEY, DATABASE_URL and APP_ORIGIN. Node commands may load it with `node --env-file=.env ...`; secrets remain on the host and are not included in Vite assets. Do not prefix server secrets with VITE_. Run migrations, provision owner or explicit demo seed, then run API/worker/frontend using the repository scripts. For a fresh isolated engine use DATABASE_URL=pglite:memory; it does not survive process exit and each process has its own DB. File-backed PGlite cannot be shared by separately running API/worker processes; use PostgreSQL for multi-process development.

## Production Compose

1. Provision a Linux host or container platform with DNS, firewall, TLS certificate issuance access, backups and monitoring. Set APP_HOST and APP_ORIGIN=https://your-host, NODE_ENV=production, unique POSTGRES_PASSWORD, COOKIE_SECRET, ENCRYPTION_KEY and integration secrets in a protected `.env` or secrets manager. Passwords embedded in connection URLs must be URL-encoded.
2. Use a dedicated production PostgreSQL cluster and storage. Compose's private network has no database host port. For managed PostgreSQL set DATABASE_URL and DB_SSL=require with the provider CA; do not disable certificate verification.
3. `docker compose build` then `docker compose up -d db`, then `docker compose run --rm migrate`. Review migration output before starting replicas. No destructive automatic reset exists.
4. Bootstrap the first owner once using `docker compose run --rm api node server/bootstrap.mjs` with BOOTSTRAP_OWNER_EMAIL/PASSWORD and a securely provisioned BOOTSTRAP_MFA_SECRET. Transfer the Base32 secret through a secure authenticator provisioning process. Remove bootstrap secrets afterward. The CLI refuses to reset/add an owner if one already exists.
5. `docker compose up -d api worker proxy`. Caddy terminates TLS, API is same-origin, secure cookies require HTTPS. Set TRUST_PROXY only when requests must traverse your controlled proxy. Restrict direct API ingress at the platform layer.
6. Validate `/health/live` and `/health/ready`, real account verification, customer booking, supplier confirmation, independent approvals, legal contract snapshot, hosted sandbox charge and webhook reconciliation, refund and notification delivery. Review structured logs and dead jobs.
7. Enable commercial traffic only after readiness audit and provider/account/legal approvals. Never switch a funded production environment to sandbox as a fallback.

The provided Docker setup is a deployable baseline, not a claim of a live deployment. No cloud account, DNS or TLS domain has been provisioned by this work. Docker Desktop daemon was unavailable in the implementation environment; the production container needs execution and smoke testing on a Docker-enabled staging host.

## CI/CD

`.github/workflows/ci.yml` installs dependencies with lockfile, starts PostgreSQL17, applies migrations, runs repository tests/build and builds the runtime container. It does not deploy automatically. Add registry login using short-lived OIDC credentials, immutable image digest promotion, staging smoke/E2E checks and a protected production environment with a single migration runner. Never store production secrets in workflow YAML. Third-party actions/image versions should be pinned to reviewed digests as part of release policy.

Deployment rollback must keep schema compatibility: first deploy additive migrations and compatible code; remove old fields only after a separate release. A previous image cannot undo a destructive migration. Restore a backup only under the incident runbook and reconcile gateway events after restore.
