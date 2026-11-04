import "./env.mjs";
import {requiredMigrations} from './schema.mjs';
const db = process.env.DATABASE_URL ? await import("./db.mjs") : null;
const query = (...args) =>
  db ? db.query(...args) : Promise.reject(Error("Database not configured"));
const databaseKind = db?.databaseKind || "unconfigured";
let effective=process.env;
try{if(db)effective=await (await import('./integration-runtime.mjs')).loadIntegrationEnvironment(db,process.env.ENCRYPTION_KEY,{force:true});}catch{}
const checks = [];
const check = (name, ok) => checks.push({ name, passed: !!ok });
check("external_postgresql", databaseKind === "postgresql");
check("production_environment", process.env.NODE_ENV === "production");
for (const key of [
  "COOKIE_SECRET",
  "ENCRYPTION_KEY",
  "MYFATOORAH_API_KEY",
  "MYFATOORAH_WEBHOOK_SECRET",
  "MAIL_FROM",
  "OPERATIONS_EMAIL",
])
  check("configured_" + key, !!effective[key]);
check('payments_enabled',effective.INTEGRATION_PAYMENTS_ENABLED!=='false');
check('email_enabled',effective.INTEGRATION_EMAIL_ENABLED!=='false');
check('email_transport',effective.EMAIL_PROVIDER==='resend'?!!effective.RESEND_API_KEY:!!effective.SMTP_HOST);
check("https_origin", /^https:\/\//.test(process.env.APP_ORIGIN || ""));
check(
  "live_payment_environment",
  effective.MYFATOORAH_ENVIRONMENT === "live",
);
try {
  const data =
      (await query("SELECT data FROM app_settings WHERE id=true")).rows[0]
        ?.data || {},
    s = data.settings || data;
  for (const key of [
    "companyName",
    "registrationNumber",
    "contactEmail",
    "contactPhone",
    "terms",
    "privacy",
    "cancellation",
  ])
    check(
      "business_" + key,
      typeof s[key] === "string" && s[key].trim().length > 0,
    );
  check(
    "migrations_applied",
    (
      await query(
        'SELECT count(*) FROM schema_migrations WHERE name IN (SELECT jsonb_array_elements_text($1::jsonb))',[JSON.stringify(requiredMigrations)],
      )
    ).rows[0].count == requiredMigrations.length,
  );
  check(
    "owner_provisioned",
    (
      await query(
        "SELECT count(*) FROM users WHERE role='admin' AND active=true AND verified_at IS NOT NULL",
      )
    ).rows[0].count > 0,
  );
  check(
    "catalog_published",
    (await query("SELECT count(*) FROM catalog_services WHERE active=true"))
      .rows[0].count > 0,
  );
  check(
    "no_dead_jobs",
    (await query("SELECT count(*) FROM outbox WHERE status='DEAD'")).rows[0]
      .count == 0,
  );
} catch {
  check("database_schema_access", false);
}
for (const key of [
  "SANDBOX_CERTIFICATION_REFERENCE",
  "RESTORE_DRILL_REFERENCE",
  "SECURITY_REVIEW_REFERENCE",
])
  check("operations_" + key, !!effective[key]);
const result = {
  decision: checks.every((c) => c.passed)
    ? "CONFIGURATION_GATES_PASSED"
    : "NO_GO",
  at: new Date().toISOString(),
  checks,
  note: "Configuration checks do not certify external provider settlement, legal validity or deployment health. Evidence references must identify actual completed reviews.",
};
console.log(JSON.stringify(result, null, 2));
await db?.pool.end();
if (checks.some((c) => !c.passed)) process.exitCode = 1;
