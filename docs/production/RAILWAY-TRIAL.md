# Railway client trial

Create a dedicated project with a private PostgreSQL service and one application service. Use the root Dockerfile and generate a Railway HTTPS domain for the app. Mount an application volume at /app/data/uploads and keep the PostgreSQL volume attached. Leave app sleeping disabled.

Application variables:

- NODE_ENV=staging
- APP_ORIGIN=https://<generated-domain>
- DATABASE_URL (private PostgreSQL URL for habb_runtime)
- HOST=0.0.0.0
- TRUST_PROXY=true
- STORAGE_DIR=/app/data/uploads
- COOKIE_SECRET (48 random bytes encoded as hex)
- ENCRYPTION_KEY (32 random bytes encoded as hex)

Supply secrets in Railway variables. Leave live payment, payout, notification, and signature credentials unset. Keep the trial separate from commercial infrastructure.

Deploy using Railway CLI from a clean source bundle. Verify the CLI upload exclusions before deploying. Exclude local databases, uploads, credentials, dumps, .env files, tools, and test artifacts. The Docker ignore file also excludes them from the image build. Before the first deployment and before releasing schema changes, run server/provision-runtime.mjs once with the database owner connection and DB_APP_PASSWORD. Give the application only the restricted runtime URL. Railway gates rollout on /health/ready.

To preserve existing demo records, take a logical PostgreSQL export of the isolated trial database and restore it into an empty Railway PostgreSQL database before deploying the app. If the source is PGlite, use its pg_dump tool rather than copying the database directory. Inspect the export for real personal data and enabled integration credentials before transfer. Transfer any required demo uploads separately to the mounted volume. Use new session and encryption secrets for a sanitized trial and remove restored integration secrets and sessions before first start. For a fresh trial, run the demo seed against the dedicated empty cloud database as a one-off with NODE_ENV=development, ENABLE_DEMO=true and a new DEV_DEMO_PASSWORD. Keep the running app in staging.

Before sharing, verify HTTPS, readiness, mobile pages, role sign-in, a booking and supplier update, and persistence after redeploy. Provision database and upload backups separately.


On Railway set the web start command to sh /app/server/railway-start.sh and set RAILWAY_RUN_UID=0 for the web service. The start script sets permissions on the mounted directory and immediately drops privileges before starting Node. Create a separate worker service from the same repository with start command node server/worker.mjs and no public domain. It uses the same restricted DB credentials and encryption key.
