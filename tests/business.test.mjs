import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "pglite:memory";
process.env.NODE_ENV = "test";
const db = await import("../server/db.mjs");
const { migrate } = await import("../server/migrate.mjs");
const { emptyState, executeCommand, readState } =
  await import("../server/business.mjs");
await migrate();
await db.query("INSERT INTO app_settings(data) VALUES($1)", [
  { ...emptyState().settings, cancellation: "Cancellation policy configured" },
]);
for (const [id, role] of [
  ["c1", "customer"],
  ["c2", "customer"],
  ["a1", "admin"],
  ["t1", "staff"],
])
  await db.query(
    "INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$1,$3,$4)",
    [id, id + "@test.invalid", role, "test-only"],
  );
await db.query("INSERT INTO suppliers(id,name) VALUES('v1','Supplier')");
await db.query(
  "INSERT INTO catalog_services(id,supplier_id,name,data,capacity) VALUES($1,$2,$3,$4,1)",
  [
    "s1",
    "v1",
    "Hall",
    {
      id: "s1",
      supplierId: "v1",
      title: "Hall",
      price: 100,
      cost: 60,
      available: true,
    },
  ],
);
const actor = (id) => ({
  id,
  role: id === "a1" ? "admin" : id === "t1" ? "staff" : "customer",
  name: id,
});
const cmd = (id, a, p = {}, key = randomUUID()) =>
  db.transaction((c) => executeCommand(c, actor(id), "visitor", a, p, key));
after(() => db.pool.end());
test("real API returns 400 for invalid domain input and serves the SPA with security headers", async () => {
  const { createApp } = await import("../server/app.mjs");
  const app = await createApp({
    db,
    logger: false,
    registerIntegrations: false,
  });
  try {
    const session = await app.inject("/api/auth/session");
    const cookie = session.cookies
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    const r = await app.inject({
      method: "POST",
      url: "/api/commands",
      headers: {
        cookie,
        origin: app.config.appOrigin,
        "x-csrf-token": session.json().csrfToken,
        "idempotency-key": randomUUID(),
      },
      payload: { action: "PLANNER", payload: { date: "invalid" } },
    });
    assert.equal(r.statusCode, 400);
    const page = await app.inject("/auth/register");
    assert.equal(page.statusCode, 200);
    assert.match(page.headers["content-security-policy"], /frame-ancestors/);
    assert.match(page.body, /root/);
    for (let i=0;i<250;i++) {
      const asset=await app.inject('/assets/brand-fonts.css');
      assert.equal(asset.statusCode,200);
    }
    assert.equal((await app.inject('/api/auth/session')).statusCode,200);
  } finally {
    await app.close();
  }
});
let booking;
test("guest shopping cart transfers once into the authenticated customer workspace", async () => {
  const { hashPassword } = await import("../server/security.mjs");
  const password = "Guest merge real password!";
  await db.query(
    "INSERT INTO users(id,email,name,role,password_hash,verified_at) VALUES('merge-customer','merge@example.test','Merge customer','customer',$1,now())",
    [await hashPassword(password)],
  );
  const { createApp } = await import("../server/app.mjs");
  const app = await createApp({
    db,
    logger: false,
    registerIntegrations: false,
  });
  const jar = new Map();
  let csrf;
  async function req(method, url, payload) {
    const r = await app.inject({
      method,
      url,
      payload,
      headers: {
        origin: app.config.appOrigin,
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
        "x-csrf-token": csrf || "",
        "idempotency-key": randomUUID(),
      },
    });
    for (const c of r.cookies) jar.set(c.name, c.value);
    const body = r.json();
    if (body.csrfToken) csrf = body.csrfToken;
    assert.equal(r.statusCode, 200, JSON.stringify(body));
    return body;
  }
  try {
    await req("GET", "/api/auth/session");
    await req("POST", "/api/commands", {
      action: "CART_ADD",
      payload: { id: "s1", qty: 1 },
    });
    await req("POST", "/api/auth/login", {
      email: "merge@example.test",
      password,
    });
    let s = await req("GET", "/api/state");
    assert.equal(s.cart[0].qty, 1);
    await req("POST", "/api/auth/logout", {});
    await req("POST", "/api/auth/login", {
      email: "merge@example.test",
      password,
    });
    s = await req("GET", "/api/state");
    assert.equal(s.cart[0].qty, 1);
  } finally {
    await app.close();
  }
});
test("real booking transaction persists normalized rows and rejects another customer", async () => {
  await cmd("c1", "PLANNER", { date: "2031-12-12", location: "Kuwait" });
  await cmd("c1", "CART_ADD", { id: "s1", qty: 1 });
  const result = await cmd("c1", "SUBMIT");
  booking = result.orders[0].id;
  assert.match(booking, /^HB-/);
  assert.equal(
    (await db.query("SELECT * FROM order_lines WHERE booking_id=$1", [booking]))
      .rows.length,
    1,
  );
  await assert.rejects(
    () => cmd("c2", "CANCEL", { id: booking, reason: "unauthorized" }),
    (e) => e.statusCode === 403,
  );
  assert.equal(
    (await db.transaction((c) => readState(c, actor("c2"), "visitor"))).orders
      .length,
    0,
  );
});
test("capacity conflict rolls back second booking and preserves cart", async () => {
  await cmd("c2", "PLANNER", { date: "2031-12-12", location: "Kuwait" });
  await cmd("c2", "CART_ADD", { id: "s1", qty: 1 });
  await assert.rejects(
    () => cmd("c2", "SUBMIT"),
    (e) => e.statusCode === 409,
  );
  assert.equal((await db.query("SELECT * FROM bookings")).rows.length, 1);
  assert.equal(
    (await db.transaction((c) => readState(c, actor("c2"), "visitor"))).cart
      .length,
    1,
  );
});
test("idempotency and role boundary reject altered replays and impersonation", async () => {
  const key = randomUUID();
  await cmd("c1", "PLANNER", { guests: 20 }, key);
  await cmd("c1", "PLANNER", { guests: 20 }, key);
  await assert.rejects(
    () => cmd("c1", "PLANNER", { guests: 21 }, key),
    (e) => e.statusCode === 409,
  );
  await assert.rejects(
    () => cmd("c1", "LOGIN", { role: "admin" }),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    () =>
      cmd("c1", "PROFILE", { role: "admin" }).then((s) => {
        assert.equal(s.session.role, "customer");
        throw Error("checked");
      }),
    /checked/,
  );
});
test("supplier confirmation and independent approvals persist immutable signed contract", async () => {
  await cmd("a1", "SUPPLIER_RESPONSE", {
    id: booking,
    lineId: "s1",
    response: "CONFIRMED_SUPPLIER",
    cost: 60,
  });
  await cmd("t1", "APPROVE_INTERNAL", { id: booking, reason: "Review" });
  await cmd("a1", "APPROVE_INTERNAL", { id: booking, reason: "Owner review" });
  await cmd("a1", "PUBLISH", { id: booking });
  await cmd("c1", "QUOTE_ACCEPT", { id: booking });
  await cmd("c1", "SIGN", {
    id: booking,
    consent: true,
    signature: "Customer",
  });
  const ct = (
    await db.query("SELECT * FROM contracts WHERE booking_id=$1", [booking])
  ).rows[0];
  assert.equal(ct.status, "SIGNED");
  assert.equal(ct.data.metadata.assurance, "authenticated-clickwrap");
  await assert.rejects(() => cmd("a1", "PRICE", { id: booking, discount: 1 }));
});
test("issued contract is frozen HTML with a verifiable hash and database rejects tampering", async () => {
  const { createHash } = await import("node:crypto");
  const ct = (
    await db.query("SELECT * FROM contracts WHERE booking_id=$1", [booking])
  ).rows[0];
  assert.ok(ct.data.html.includes("Customer"));
  assert.equal(
    ct.document_hash,
    createHash("sha256").update(ct.data.html).digest("hex"),
  );
  await assert.rejects(
    () => db.query("UPDATE contracts SET data='{}' WHERE id=$1", [ct.id]),
    /immutable/,
  );
  await assert.rejects(
    () => db.query("DELETE FROM contracts WHERE id=$1", [ct.id]),
    /immutable/,
  );
});
test("real alternative clears approvals and requires a new supplier response", async () => {
  await db.query(
    "INSERT INTO catalog_services(id,supplier_id,name,data,capacity) VALUES('s2','v1','Alternative',$1,2)",
    [
      {
        id: "s2",
        supplierId: "v1",
        title: "Alternative",
        price: 90,
        cost: 40,
        available: true,
      },
    ],
  );
  await cmd("c2", "PLANNER", { date: "2032-12-12" });
  const s = await cmd("c2", "SUBMIT"),
    id = s.orders[0].id;
  await cmd("a1", "SUPPLIER_RESPONSE", {
    id,
    lineId: "s1",
    response: "REJECTED",
    reason: "Unavailable",
  });
  const next = await cmd("a1", "ALTERNATIVE", {
    id,
    lineId: "s1",
    serviceId: "s2",
    reason: "Available alternative",
  });
  const o = next.orders.find((o) => o.id === id);
  assert.equal(o.lines[0].id, "s2");
  assert.equal(o.lines[0].response, "WAITING");
  assert.equal(o.approvals.length, 0);
  assert.equal(
    (
      await db.query(
        "SELECT * FROM reservations WHERE booking_id=$1 AND service_id='s1'",
        [id],
      )
    ).rows[0].status,
    "RELEASED",
  );
  await assert.rejects(() => cmd("a1", "PUBLISH", { id }));
});
test("amendment needs supplier, independent reviewers and explicit authenticated consent", async () => {
  await cmd("c1", "CHANGES", { id: booking, reason: "Add a service" });
  await cmd("a1", "AMENDMENT_CREATE", { id: booking, serviceId: "s2" });
  await cmd("a1", "AMENDMENT_CONFIRM", { id: booking });
  await assert.rejects(() =>
    cmd("c1", "AMENDMENT_ACCEPT", {
      id: booking,
      consent: true,
      signature: "Customer",
    }),
  );
  await cmd("a1", "AMENDMENT_APPROVE", {
    id: booking,
    reason: "Owner approves",
  });
  await assert.rejects(() =>
    cmd("a1", "AMENDMENT_APPROVE", { id: booking, reason: "Again" }),
  );
  await cmd("t1", "AMENDMENT_APPROVE", {
    id: booking,
    reason: "Staff approves",
  });
  await assert.rejects(() => cmd("c1", "AMENDMENT_ACCEPT", { id: booking }));
  const state = await cmd("c1", "AMENDMENT_ACCEPT", {
    id: booking,
    consent: true,
    signature: "Customer",
  });
  assert.equal(state.orders[0].amendment.status, "SIGNED");
  const amendment=(await db.query("SELECT * FROM contracts WHERE booking_id=$1 AND data->>'kind'='AMENDMENT'",[booking])).rows[0];
  assert.equal(amendment.status,'SIGNED');
  assert.ok(amendment.data.html.includes('ملحق تعديل'));
  await assert.rejects(()=>db.query("UPDATE contracts SET data='{}' WHERE id=$1",[amendment.id]),/immutable/);
  await assert.rejects(()=>cmd('c1','CHANGES',{id:booking,reason:'Another amendment before payment'}));
});

test("concurrent customers cannot reserve the same last service capacity", async () => {
  for (const id of ["race1", "race2"]) {
    await db.query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$1,'customer','isolated')",[id,id+"@example.test"]);
    await cmd(id,"PLANNER",{date:"2033-04-15",location:"Kuwait"});
    await cmd(id,"CART_ADD",{id:"s1",qty:1});
  }
  const results=await Promise.allSettled([cmd("race1","SUBMIT"),cmd("race2","SUBMIT")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1,JSON.stringify(results.map(r=>r.status==='rejected'?r.reason.message:r.status)));
  assert.equal(results.filter(r=>r.status==="rejected").length,1);
  const allocation=await db.query("SELECT sum(qty)::int AS qty FROM reservations WHERE service_id='s1' AND event_date='2033-04-15' AND status='HELD'");
  assert.equal(allocation.rows[0].qty,1);
});
test("a paid amendment is archived without losing its signed version or reserved capacity",async()=>{
  // Isolated fixture: provider verification itself is covered by integration tests.
  await db.query("UPDATE bookings SET data=jsonb_set(jsonb_set(data,'{amendment,status}','\"CONFIRMED\"'),'{amendment,paid}','90') WHERE id=$1",[booking]);
  await cmd('c1','CHANGES',{id:booking,reason:'Additional service after prior paid amendment'});
  await db.query("INSERT INTO catalog_services(id,supplier_id,name,data,capacity) VALUES('s3','v1','Third',$1,2)",[{id:'s3',supplierId:'v1',title:'Third',price:50,cost:20,available:true}]);
  await cmd('a1','AMENDMENT_CREATE',{id:booking,serviceId:'s3'});
  await cmd('a1','AMENDMENT_CONFIRM',{id:booking});
  await cmd('t1','AMENDMENT_APPROVE',{id:booking,reason:'Staff reviewed'});
  await cmd('a1','AMENDMENT_APPROVE',{id:booking,reason:'Owner reviewed'});
  const s=await cmd('c1','AMENDMENT_ACCEPT',{id:booking,consent:true,signature:'Customer'});
  const o=s.orders.find(o=>o.id===booking);
  assert.equal(o.amendmentHistory.length,1);
  assert.equal(o.amendmentHistory[0].status,'CONFIRMED');
  assert.equal(o.amendmentHistory[0].financials.cost,undefined);
  assert.equal(o.amendment.financials.profit,undefined);
  assert.equal(o.financials.cost,undefined);
  assert.equal((await db.query('SELECT * FROM contracts WHERE booking_id=$1',[booking])).rowCount,3);
  const reservations=(await db.query("SELECT service_id FROM reservations WHERE booking_id=$1 AND status='CONFIRMED'",[booking])).rows;
  assert.deepEqual(reservations.map(r=>r.service_id).sort(),['s1','s2','s3']);
});
test("catalog ratings reflect only completed customer feedback, not supplier metadata",async()=>{
  await db.query("UPDATE bookings SET status='COMPLETED',data=data||$2::jsonb WHERE id=$1",[booking,{feedback:{rating:4}}]);
  const s=await db.transaction(c=>readState(c,actor("c1"),"visitor"));
  assert.equal(s.services.find(x=>x.id==='s1').rating,4);
  assert.equal(s.services.find(x=>x.id==='s1').reviews,1);
});

test("branding settings are owner-only, persist publicly and support explicit removal", async () => {
  const { branding } = await import("../src/branding.mjs");
  const before = await db.transaction(c => readState(c, null, "brand-visitor"));
  await assert.rejects(() => cmd("t1", "SETTINGS", {brand:"محاولة موظف"}), error => error.statusCode === 403);
  await assert.rejects(() => cmd("a1", "SETTINGS", {brandLogo:"data:image/svg+xml;base64,PHN2Zz4="}), error => error.statusCode === 400);
  await cmd("a1", "SETTINGS", {brand:"هوية جديدة",brandLatin:"NEW BRAND",brandLogo:null,brandEmblem:null,brandIcon:null});
  const publicState = await db.transaction(c => readState(c, null, "brand-visitor"));
  assert.deepEqual(branding(publicState.settings), {
    name:"هوية جديدة",latin:"NEW BRAND",title:"هوية جديدة | NEW BRAND",logo:null,emblem:null,icon:null,originalFilm:false,
  });
  await cmd("a1", "SETTINGS", {brand:"",brandLatin:""});
  const removed = await db.transaction(c => readState(c, null, "brand-visitor"));
  assert.equal(branding(removed.settings).title, "");
  await db.query("UPDATE app_settings SET data=$1 WHERE id=true", [before.settings]);
});
