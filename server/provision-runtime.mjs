import { migrate } from "./migrate.mjs";
import { query, pool, databaseKind } from "./db.mjs";
if (databaseKind !== "postgresql")
  throw Error("Runtime-role provisioning requires external PostgreSQL");
const password = process.env.DB_APP_PASSWORD;
if (!password || password.length < 32)
  throw Error("DB_APP_PASSWORD must contain at least 32 characters");
await migrate();
const literal = "'" + password.replaceAll("'", "''") + "'";
await query(
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='habb_runtime') THEN CREATE ROLE habb_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF; END $$`,
);
await query(`ALTER ROLE habb_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${literal}`);
await query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
await query("GRANT USAGE ON SCHEMA public TO habb_runtime");
await query(
  "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO habb_runtime",
);
await query("REVOKE UPDATE,DELETE,TRUNCATE ON audit_log FROM habb_runtime");
await query("REVOKE ALL ON schema_migrations FROM habb_runtime");
await query("GRANT SELECT ON schema_migrations TO habb_runtime");
await query(
  "INSERT INTO app_settings(id,data) VALUES(true,'{}') ON CONFLICT DO NOTHING",
);
await pool.end();
console.log(JSON.stringify({ event: "runtime_role_provisioned" }));
