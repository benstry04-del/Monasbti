import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool, query, executeSQL, databaseKind } from "./db.mjs";
export async function migrate() {
  await query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const dir = new URL("./migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, dir), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const prior = await query(
      "SELECT checksum FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (prior.rows.length) {
      if (prior.rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    // A deployment runs one migration job before replicas start. DDL and its receipt commit together.
    const escapedName = name.replaceAll("'", "''");
    await executeSQL(
      `BEGIN; ${sql}\nINSERT INTO schema_migrations(name,checksum) VALUES ('${escapedName}','${checksum}'); COMMIT;`,
    );
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await migrate();
  console.log(JSON.stringify({ event: "database_migrated", databaseKind }));
  await pool.end();
}
