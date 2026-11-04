import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import Fastify from "fastify";
import {
  SupplierPayoutBridge,
  verifyPayoutWebhook,
  payoutSignatureInput,
} from "../server/providers/supplier-payouts.mjs";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "pglite:memory";
process.env.NODE_ENV = "test";
const db = await import("../server/db.mjs");
const { migrate } = await import("../server/migrate.mjs");
await migrate();
const {
  requestSettlement,
  approveSettlement,
  submitSettlement,
  reconcileSettlement,
  executeSupplierPayout,
  registerSettlementRoutes,
} = await import("../server/settlements.mjs");
const staff = { id: "staff", role: "staff", mfaVerified: false },
  owner = { id: "owner", role: "admin", mfaVerified: false };
await db.query(
  "INSERT INTO suppliers(id,name,data) VALUES('v1','Supplier1',$1),('v2','Supplier2',$2)",
  [
    { payoutRecipientId: "beneficiary-one" },
    { payoutRecipientId: "beneficiary-two" },
  ],
);
for (const a of [staff, owner, { id: "customer", role: "customer" }])
  await db.query(
    "INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$1,$3,'fixture')",
    [a.id, a.id + "@example.test", a.role],
  );
await db.query(
  "INSERT INTO users(id,email,name,role,supplier_id,password_hash) VALUES('supplier','supplier@example.test','Supplier1','supplier','v1','fixture')",
);
for (const id of ["v1", "v2"])
  await db.query(
    "INSERT INTO catalog_services(id,supplier_id,name) VALUES($1,$1,$1)",
    [id],
  );
async function booking(id, status = "COMPLETED") {
  await db.query(
    "INSERT INTO bookings(id,customer_id,status,occasion_date,data) VALUES($1,'customer',$2,'2031-01-01',$3)",
    [id, status, { contract: { status: "SIGNED" } }],
  );
  await db.query(
    "INSERT INTO order_lines(id,booking_id,service_id,supplier_id,qty,cost_minor,price_minor,data) VALUES($1,$2,'v1','v1',2,10501,20000,$3)",
    [id + ":line", id, { title: "Actual agreed supplier cost" }],
  );
}
const key = () => randomUUID();
async function ready(id) {
  await booking(id);
  const r = await requestSettlement(
    db,
    staff,
    { bookingId: id, supplierId: "v1" },
    key(),
  );
  await approveSettlement(db, staff, r.id, "Reviewed supplier invoice");
  await approveSettlement(db, owner, r.id, "Owner checked destination");
  return r;
}
after(() => db.pool.end());

test("settlement snapshot uses database cost, preserves fils and atomically prevents duplicate allocation", async () => {
  await booking("concurrent");
  const results = await Promise.allSettled([
    requestSettlement(
      db,
      staff,
      { bookingId: "concurrent", supplierId: "v1" },
      key(),
    ),
    requestSettlement(
      db,
      owner,
      { bookingId: "concurrent", supplierId: "v1" },
      key(),
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const row = results.find((r) => r.status === "fulfilled").value;
  assert.equal(Number(row.amount_minor), 21002);
  assert.equal(row.recipient_ref, "beneficiary-one");
  await assert.rejects(
    () =>
      db.query("UPDATE supplier_settlements SET amount_minor=1 WHERE id=$1", [
        row.id,
      ]),
    /immutable/,
  );
});
test("request idempotency rejects conflicting replay and cannot pay an unfinished booking", async () => {
  await booking("replay");
  const input = { bookingId: "replay", supplierId: "v1" },
    k = key();
  const first = await requestSettlement(db, staff, input, k);
  assert.equal((await requestSettlement(db, staff, input, k)).id, first.id);
  await assert.rejects(
    () => requestSettlement(db, staff, { ...input, supplierId: "v2" }, k),
    (e) => e.statusCode === 409,
  );
  await booking("unfinished", "CONFIRMED");
  await assert.rejects(
    () =>
      requestSettlement(
        db,
        staff,
        { bookingId: "unfinished", supplierId: "v1" },
        key(),
      ),
    (e) => e.statusCode === 409,
  );
  await assert.rejects(
    () =>
      requestSettlement(db, { id: "customer", role: "customer" }, input, key()),
    (e) => e.statusCode === 403,
  );
});
test("independent approvals and durable submission do not mark a transfer settled", async () => {
  await booking("approvals");
  const r = await requestSettlement(
    db,
    staff,
    { bookingId: "approvals", supplierId: "v1" },
    key(),
  );
  const provider = { assertConfigured() {} };
  await assert.rejects(
    () => submitSettlement(db, owner, r.id, provider),
    (e) => e.statusCode === 409,
  );
  await approveSettlement(db, staff, r.id, "Employee approval");
  assert.equal(
    (await approveSettlement(db, staff, r.id, "Employee approval")).status,
    "IN_REVIEW",
  );
  await assert.rejects(
    () => approveSettlement(db, staff, r.id, "Employee again"),
    (e) => e.statusCode === 409,
  );
  await approveSettlement(db, owner, r.id, "Owner approval");
  await assert.rejects(
    () => submitSettlement(db, staff, r.id, provider),
    (e) => e.statusCode === 403,
  );
  await submitSettlement(db, owner, r.id, provider);
  await submitSettlement(db, owner, r.id, provider);
  assert.equal(
    (
      await db.query("SELECT status FROM supplier_settlements WHERE id=$1", [
        r.id,
      ])
    ).rows[0].status,
    "SUBMITTING",
  );
  assert.equal(
    (
      await db.query("SELECT * FROM outbox WHERE dedupe_key=$1", [
        "supplier-payout-submit:" + r.id,
      ])
    ).rowCount,
    1,
  );
});
test("an ambiguous transfer is looked up after recovery and never blindly posted again", async () => {
  const r = await ready("uncertain");
  let calls = 0,
    status = "PROCESSING";
  const provider = {
    assertConfigured() {},
    async create() {
      calls++;
      throw Error("Network timeout after sending");
    },
    async lookup(id) {
      return {
        id: "bank-one",
        externalId: id,
        recipientRef: r.recipient_ref,
        amountMinor: Number(r.amount_minor),
        currency: "KWD",
        status,
      };
    },
  };
  await submitSettlement(db, owner, r.id, provider);
  await assert.rejects(() => executeSupplierPayout(db, r.id, provider));
  assert.equal(calls, 1);
  assert.equal(
    (await executeSupplierPayout(db, r.id, provider)).status,
    "PENDING",
  );
  assert.equal(calls, 1);
  status = "SUCCEEDED";
  const settled = await reconcileSettlement(db, r.id, provider);
  assert.equal(settled.status, "SETTLED");
  assert.ok(settled.settled_at);
  await reconcileSettlement(db, r.id, provider);
  assert.equal(calls, 1);
  assert.equal(
    (await db.query("SELECT * FROM notifications WHERE user_id='supplier'"))
      .rowCount,
    1,
  );
  assert.equal(
    (
      await db.query("SELECT * FROM outbox WHERE dedupe_key=$1", [
        "supplier-settlement-email:" + r.id + ":SETTLED:supplier",
      ])
    ).rowCount,
    1,
  );
  status = "FAILED";
  await assert.rejects(
    () => reconcileSettlement(db, r.id, provider),
    (e) => e.code === "PAYOUT_MISMATCH",
  );
  await assert.rejects(
    () =>
      db.query("UPDATE supplier_settlements SET status='FAILED' WHERE id=$1", [
        r.id,
      ]),
    /immutable/,
  );
});
test("mismatched authoritative amount and destination cannot settle a payout", async () => {
  const r = await ready("mismatch");
  const provider = {
    assertConfigured() {},
    async lookup(id) {
      return {
        id: "bank-mismatch",
        externalId: id,
        recipientRef: r.recipient_ref,
        amountMinor: 1,
        currency: "KWD",
        status: "SUCCEEDED",
      };
    },
  };
  await submitSettlement(db, owner, r.id, provider);
  await assert.rejects(
    () => reconcileSettlement(db, r.id, provider),
    (e) => e.code === "PAYOUT_MISMATCH",
  );
  assert.equal(
    (
      await db.query("SELECT status FROM supplier_settlements WHERE id=$1", [
        r.id,
      ])
    ).rows[0].status,
    "SUBMITTING",
  );
});
test("bridge requires explicit configuration, authenticates requests and does not follow redirects", async () => {
  assert.throws(() => new SupplierPayoutBridge({ env: {} }).assertConfigured());
  assert.throws(() =>
    new SupplierPayoutBridge({
      env: { NODE_ENV: "production", SUPPLIER_PAYOUT_ENVIRONMENT: "sandbox" },
    }).assertConfigured(),
  );
  const env = {
    SUPPLIER_PAYOUT_PROVIDER: "bridge",
    SUPPLIER_PAYOUT_BASE_URL: "https://payout.example.test/v1",
    SUPPLIER_PAYOUT_API_KEY: "test-only",
    SUPPLIER_PAYOUT_WEBHOOK_SECRET: "s".repeat(32),
  };
  let call;
  const bridge = new SupplierPayoutBridge({
    env,
    fetchImpl: async (url, options) => {
      call = { url, options };
      return { ok: true, json: async () => ({ id: "accepted" }) };
    },
  });
  await bridge.create({
    id: "local",
    recipient_ref: "beneficiary",
    amount_minor: 10501,
    currency: "KWD",
  });
  assert.equal(call.options.headers["Idempotency-Key"], "local");
  assert.equal(call.options.redirect, "error");
  assert.equal(JSON.parse(call.options.body).amountMinor, 10501);
  const event = {
    eventId: "event",
    externalId: randomUUID(),
    timestamp: Date.now(),
  };
  const signature = createHmac("sha256", env.SUPPLIER_PAYOUT_WEBHOOK_SECRET)
    .update(payoutSignatureInput(event))
    .digest("hex");
  assert.equal(
    verifyPayoutWebhook(event, signature, env.SUPPLIER_PAYOUT_WEBHOOK_SECRET),
    true,
  );
  assert.equal(
    verifyPayoutWebhook(
      { ...event, externalId: randomUUID() },
      signature,
      env.SUPPLIER_PAYOUT_WEBHOOK_SECRET,
    ),
    false,
  );
  assert.equal(
    verifyPayoutWebhook(
      event,
      signature,
      env.SUPPLIER_PAYOUT_WEBHOOK_SECRET,
      event.timestamp + 300001,
    ),
    false,
  );
});
test("API scopes supplier history and signed webhook duplicates enqueue one verification, never a payment mutation", async () => {
  const app = Fastify();
  app.decorate("db", db);
  app.decorate("authenticate", async (req) => {
    req.actor =
      req.headers["x-test-role"] === "supplier"
        ? {
            id: "supplier",
            role: "supplier",
            supplierId: req.headers["x-test-supplier"] || "v2",
          }
        : req.headers["x-test-role"] === "admin"
          ? owner
          : { id: "customer", role: "customer" };
  });
  await registerSettlementRoutes(app);
  try {
    assert.equal((await app.inject("/api/settlements")).statusCode, 403);
    const supplier = await app.inject({
      url: "/api/settlements",
      headers: { "x-test-role": "supplier" },
    });
    assert.equal(supplier.statusCode, 200);
    assert.equal(supplier.json().items.length, 0);
    const own = await app.inject({
      url: "/api/settlements",
      headers: { "x-test-role": "supplier", "x-test-supplier": "v1" },
    });
    assert.ok(own.json().items.length > 0);
    assert.ok(
      own
        .json()
        .items.every(
          (r) =>
            r.supplier_id === "v1" &&
            r.requested_by === undefined &&
            r.idempotency_key === undefined &&
            r.approvals.length === 0,
        ),
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/settlements/eligible",
          headers: { "x-test-role": "admin" },
        })
      ).statusCode,
      200,
    );
    const cancellable = await ready("cancel-api");
    const cancelled = await app.inject({
      method: "POST",
      url: "/api/settlements/" + cancellable.id + "/cancel",
      headers: { "x-test-role": "admin" },
      payload: { reason: "Cancelled before any bank instruction" },
    });
    assert.equal(cancelled.statusCode, 200);
    assert.equal(cancelled.json().status, "CANCELLED");
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/settlements/" + cancellable.id + "/cancel",
          headers: { "x-test-role": "admin" },
          payload: { reason: "Cancelled before any bank instruction" },
        })
      ).statusCode,
      200,
    );
    process.env.SUPPLIER_PAYOUT_WEBHOOK_SECRET = "w".repeat(32);
    const event = {
      eventId: "duplicate-event",
      externalId: randomUUID(),
      timestamp: Date.now(),
    };
    const signature = createHmac(
      "sha256",
      process.env.SUPPLIER_PAYOUT_WEBHOOK_SECRET,
    )
      .update(payoutSignatureInput(event))
      .digest("hex");
    const request = {
      method: "POST",
      url: "/api/webhooks/supplier-payouts",
      headers: { "x-payout-signature": signature },
      payload: event,
    };
    assert.equal(
      (
        await app.inject({
          ...request,
          headers: { "x-payout-signature": "wrong" },
        })
      ).statusCode,
      401,
    );
    assert.equal((await app.inject(request)).statusCode, 202);
    assert.equal((await app.inject(request)).statusCode, 202);
    assert.equal(
      (
        await db.query(
          "SELECT * FROM outbox WHERE dedupe_key='supplier-payout-webhook:duplicate-event'",
        )
      ).rowCount,
      1,
    );
  } finally {
    delete process.env.SUPPLIER_PAYOUT_WEBHOOK_SECRET;
    await app.close();
  }
});
