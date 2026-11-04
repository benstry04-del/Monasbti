import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { transaction, pool } from "./db.mjs";
import { migrate } from "./migrate.mjs";
import { hashPassword } from "./security.mjs";
import { getConfig } from "./config.mjs";
export async function bootstrapOwner(env = process.env) {
  const email = String(env.BOOTSTRAP_OWNER_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = env.BOOTSTRAP_OWNER_PASSWORD || "";
  if (!email.includes("@") || password.length < 12)
    throw Error(
      "Set BOOTSTRAP_OWNER_EMAIL and a unique BOOTSTRAP_OWNER_PASSWORD (12+ characters) to provision the first owner.",
    );
  const config = getConfig(env);
  const passwordHash = await hashPassword(password);
  const { emptyState } = await import("./business.mjs");
  await transaction(async (client) => {
    const existing = await client.query(
      "SELECT id FROM users WHERE role='admin' FOR UPDATE",
    );
    if (existing.rows.length)
      throw Error(
        "An owner already exists; bootstrap will not reset or add privileged accounts.",
      );
    const id = randomUUID();
    await client.query(
      "INSERT INTO users(id,email,name,mobile,role,password_hash,verified_at,mfa_secret) VALUES($1,$2,$3,$4,'admin',$5,now(),$6)",
      [
        id,
        email,
        env.BOOTSTRAP_OWNER_NAME || "مالك هَبّ السعد",
        env.BOOTSTRAP_OWNER_MOBILE || "",
        passwordHash,
        null,
      ],
    );
    await client.query(
      "INSERT INTO app_settings(id,data) VALUES(true,$1) ON CONFLICT(id) DO NOTHING",
      [emptyState().settings],
    );
    await client.query(
      "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,'OWNER_BOOTSTRAP','user',$1,$2)",
      [id, { email, role: "admin", mfaConfigured: false }],
    );
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await migrate();
  await bootstrapOwner();
  console.log(JSON.stringify({ event: "owner_bootstrapped" }));
  await pool.end();
}
