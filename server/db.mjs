import "./env.mjs";
import pg from "pg";
const databaseURL = process.env.DATABASE_URL;
if (!databaseURL)
  throw new Error(
    "DATABASE_URL is required; use PostgreSQL in production or pglite:memory for isolated tests.",
  );
const embedded = databaseURL.startsWith("pglite:");
if (embedded && ["production", "staging"].includes(process.env.NODE_ENV))
  throw new Error("Embedded databases are not allowed in production.");
let engine;
let serial = Promise.resolve();
if (embedded) {
  const { PGlite } = await import("@electric-sql/pglite");
  const path = databaseURL.replace(/^pglite:(?:\/\/)?/, "");
  engine = new PGlite(!path || path === "memory" ? undefined : path);
  await engine.waitReady;
}
function normalizeParameters(params) {
  return params?.map((p) =>
    p && typeof p === "object" && !(p instanceof Date) && !ArrayBuffer.isView(p)
      ? JSON.stringify(p)
      : p,
  );
}
const embeddedQuery = async (text, params) => {
  const result = await engine.query(text, normalizeParameters(params));
  return {
    ...result,
    rowCount: result.fields?.length
      ? result.rows.length
      : (result.affectedRows ?? 0),
  };
};
export const pool = embedded
  ? {
      async query(text, params) {
        const client = await this.connect();
        try {
          return await client.query(text, params);
        } finally {
          client.release();
        }
      },
      async connect() {
        let release;
        const previous = serial;
        serial = new Promise((resolve) => {
          release = resolve;
        });
        await previous;
        return { query: embeddedQuery, release };
      },
      async end() {
        await engine.close();
      },
    }
  : new pg.Pool({
      connectionString: databaseURL,
      max: Number(process.env.DB_POOL_MAX || 12),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      statement_timeout: 15000,
      ssl:
        process.env.DB_SSL === "require"
          ? {
              rejectUnauthorized: true,
              ...(process.env.DB_CA
                ? { ca: process.env.DB_CA.replace(/\\n/g, "\n") }
                : {}),
            }
          : undefined,
    });
export const query = (text, params) => pool.query(text, params);
export async function transaction(work, options = {}) {
  const attempts = options.attempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const client = await pool.connect();
    try {
      await client.query(options.readOnly?"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY":"BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (!["40001", "40P01"].includes(error.code) || attempt === attempts - 1)
        throw error;
    } finally {
      client.release();
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 20 * 2 ** attempt + Math.random() * 20),
    );
  }
}
export async function executeSQL(text) {
  if (embedded) return engine.exec(text);
  return pool.query(text);
}
export const databaseKind = embedded ? "pglite-development" : "postgresql";
