import "./env.mjs";
import { randomBytes } from "node:crypto";

const developmentSecret = randomBytes(48).toString("hex");
const developmentEncryptionKey = randomBytes(32).toString("hex");

export function getConfig(env = process.env) {
  const production = ["production", "staging"].includes(env.NODE_ENV);
  const appOrigin =
    env.APP_ORIGIN || (production ? "" : "http://localhost:5173");
  let origin;
  try {
    origin = new URL(appOrigin).origin;
  } catch {
    throw Error("APP_ORIGIN must be a valid origin");
  }
  if (production && !appOrigin.startsWith("https://"))
    throw Error("Production APP_ORIGIN must use HTTPS");
  const cookieSecret =
    env.COOKIE_SECRET || (production ? "" : developmentSecret);
  const encryptionKey =
    env.ENCRYPTION_KEY || (production ? "" : developmentEncryptionKey);
  if (cookieSecret.length < 32)
    throw Error("COOKIE_SECRET must contain at least 32 characters");
  if (!/^[a-f\d]{64}$/i.test(encryptionKey))
    throw Error(
      "ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hex characters",
    );
  if (production && !env.DATABASE_URL)
    throw Error("DATABASE_URL is required in production");
  return {
    environment: env.NODE_ENV || "development",
    production,
    appOrigin: origin,
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 3001),
    cookieSecret,
    encryptionKey,
    sessionHours: Math.min(72, Math.max(1, Number(env.SESSION_HOURS || 12))),
    trustProxy: env.TRUST_PROXY === "true",
    logLevel: env.LOG_LEVEL || "info",
    metricsToken: env.METRICS_TOKEN || "",
    publicDir: env.PUBLIC_DIR || "dist",
    demoEnabled: !production && env.ENABLE_DEMO === "true",
    databaseUrl: env.DATABASE_URL,
    sentryDsn: env.SENTRY_DSN || "",
  };
}
export const config = getConfig();
