import { fileURLToPath } from "node:url";
import { seed } from "../src/domain.mjs";
import { transaction, pool } from "./db.mjs";
import { migrate } from "./migrate.mjs";
import { hashPassword } from "./security.mjs";
export async function seedDemo(env = process.env) {
  if (["production", "staging"].includes(env.NODE_ENV) || env.ENABLE_DEMO !== "true")
    throw Error(
      "Demo seed requires a non-production environment and ENABLE_DEMO=true.",
    );
  if ((env.DEV_DEMO_PASSWORD || "").length < 12)
    throw Error(
      "Set DEV_DEMO_PASSWORD (12+ characters). No default credentials are installed.",
    );
  const s = seed(),
    passwordHash = await hashPassword(env.DEV_DEMO_PASSWORD);
  await transaction(async (client) => {
    for (const supplier of s.suppliers)
      await client.query(
        "INSERT INTO suppliers(id,name,data,active) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING",
        [supplier.id, supplier.name, supplier],
      );
    for (const service of s.services)
      await client.query(
        "INSERT INTO catalog_services(id,supplier_id,name,data,capacity) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
        [
          service.id,
          service.supplierId,
          service.title,
          { ...service, available: true },
          service.category === "قاعات" ? 1 : 100,
        ],
      );
    for (const pack of s.packages)
      await client.query(
        "INSERT INTO packages(id,title,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        [pack.id, pack.title, pack],
      );
    for (const [id, role, name, supplierId] of [
      ["customer", "customer", "عميل بيئة التطوير", null],
      ["staff", "staff", "موظف بيئة التطوير", null],
      ["admin", "admin", "مالك بيئة التطوير", null],
      ["supplier", "supplier", "مورد بيئة التطوير", "v1"],
    ]) {
      await client.query(
        "INSERT INTO users(id,email,name,mobile,role,supplier_id,password_hash,verified_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(id) DO NOTHING",
        [
          id,
          `${id}@demo.kw`,
          name,
          "96550001234",
          role,
          supplierId,
          passwordHash,
        ],
      );
    }
    await client.query(
      "INSERT INTO app_settings(id,data) VALUES(true,$1) ON CONFLICT(id) DO NOTHING",
      [{ ...s.settings, categories: s.categories }],
    );
    await client.query(
      "INSERT INTO audit_log(action,resource_type,resource_id,after_data) VALUES('DEVELOPMENT_SEED','environment','demo',$1)",
      [
        {
          suppliers: s.suppliers.length,
          services: s.services.length,
          packages: s.packages.length,
          financialRecords: 0,
        },
      ],
    );
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await migrate();
  await seedDemo();
  console.log(
    JSON.stringify({
      event: "development_catalog_seeded",
      bookings: 0,
      payments: 0,
    }),
  );
  await pool.end();
}
