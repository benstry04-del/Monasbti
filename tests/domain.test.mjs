import test from "node:test";
import assert from "node:assert/strict";
import { seed, dispatch, pricing, markup, current } from "../src/domain.mjs";
test("later milestone payment preserves event preparation status", () => {
  let s = dispatch(signed(), "PAY", { scenario: "success" });
  s = as(s, "admin");
  s = dispatch(s, "SETTINGS", { ...s.settings, earlyPayment: true });
  s = dispatch(s, "EXECUTION", { status: "Preparing" });
  assert.equal(current(s).status, "PREPARATION");
  s = as(s, "customer");
  s = dispatch(s, "PAY", { scenario: "success", milestone: 1 });
  assert.equal(current(s).status, "PREPARATION");
});
test("package configuration matches the cart total", () => {
  let s = seed();
  const pack = s.packages[1];
  s = dispatch(s, "CART_PACKAGE", {
    id: pack.id,
    qty: 2,
    guests: pack.capacity,
  });
  assert.equal(pricing(s.cart).total, pack.price * 2);
});
test("signed contract payment schedule survives settings changes", () => {
  let s = signed();
  assert.deepEqual(current(s).contract.paymentSchedule, [30, 40, 30]);
  s = as(s, "admin");
  s = dispatch(s, "SETTINGS", { ...s.settings, deposit: 50, second: 25 });
  s = as(s, "customer");
  s = dispatch(s, "PAY", { scenario: "success" });
  assert.equal(s.payments[0].amount, current(s).contract.total * 0.3);
});
test("signed supplier response and final quote cannot rewrite contract", () => {
  let s = as(signed(), "admin");
  assert.throws(
    () =>
      dispatch(s, "SUPPLIER_RESPONSE", {
        lineId: "s1",
        response: "CONFIRMED_SUPPLIER",
        cost: 20,
      }),
    /موقع/,
  );
  assert.throws(() => dispatch(s, "PUBLISH"), /موقع/);
});
test("pending duplicate transaction is blocked", () => {
  let s = signed();
  s = dispatch(s, "PAY", { scenario: "pending" });
  assert.throws(() => dispatch(s, "PAY", { scenario: "success" }), /معلقة/);
});
test("amendment refund does not reduce original contract paid balance", () => {
  let s = dispatch(signed(), "PAY", { scenario: "success" });
  let originalPaid = current(s).paid;
  s = dispatch(s, "CHANGES", { reason: "إضافة تصوير" });
  s = as(s, "admin");
  s = dispatch(s, "AMENDMENT_CREATE", { serviceId: "s8" });
  s = dispatch(s, "AMENDMENT_CONFIRM");
  s = as(s, "customer");
  s = dispatch(s, "AMENDMENT_ACCEPT");
  s = dispatch(s, "PAY", { scenario: "success", amendment: true });
  const pid = s.lastPayment;
  s = as(s, "admin");
  s = dispatch(s, "REFUND", {
    paymentId: pid,
    amount: 100,
    reason: "استرداد من الملحق",
  });
  s = dispatch(s, "REFUND_SETTLE", { paymentId: pid });
  assert.equal(current(s).paid, originalPaid);
  assert.equal(current(s).amendment.paid, 700);
});
test("seed ledger equals order paid balances and completed state cannot reopen", () => {
  let s = seed();
  for (const o of s.orders)
    assert.equal(
      o.paid,
      s.payments
        .filter((p) => p.orderId === o.id && p.status === "PAID")
        .reduce((n, p) => n + p.amount, 0),
    );
  s = as(s, "admin");
  const completed = s.orders.find((o) => o.status === "COMPLETED");
  assert.throws(
    () => dispatch(s, "REVIEW", { id: completed.id }),
    /موقع|غير متاح/,
  );
});
function as(s, role, extra = {}) {
  return dispatch(s, "LOGIN", {
    id: role,
    role,
    name: role,
    email: role + "@demo.kw",
    supplierId: "v1",
    ...extra,
  });
}
function requested() {
  let s = as(seed(), "customer");
  s = dispatch(s, "CART_ADD", { id: "s1" });
  s = dispatch(s, "CART_ADD", { id: "s4" });
  s = dispatch(s, "SUBMIT");
  return s;
}
function approved() {
  let s = requested(),
    id = s.activeOrder;
  s = as(s, "staff");
  s = dispatch(s, "REVIEW", { id });
  for (let l of current(s).lines)
    s = dispatch(s, "SUPPLIER_RESPONSE", {
      id,
      lineId: l.id,
      response: "CONFIRMED_SUPPLIER",
      cost: l.cost,
    });
  s = dispatch(s, "APPROVE_INTERNAL", { id, reason: "تأكيد الموظف" });
  s = as(s, "admin");
  s = dispatch(s, "APPROVE_INTERNAL", { id, reason: "تأكيد المالك" });
  return dispatch(s, "PUBLISH", { id });
}
function signed() {
  let s = as(approved(), "customer");
  s = dispatch(s, "QUOTE_ACCEPT");
  return dispatch(s, "SIGN", { signature: "سارة التجريبية", consent: true });
}
test("seed counts and snapshots", () => {
  const s = seed();
  assert.equal(s.services.length, 24);
  assert.equal(s.suppliers.length, 10);
  assert.equal(s.orders.length, 12);
  assert.equal(s.packages.length, 6);
  assert.equal(s.payments.length, 10);
  assert.equal(s.notifications.length, 20);
  assert.equal(s.audit.length, 30);
  assert.equal(s.orders.filter((o) => o.contract).length, 6);
});
test("600 + markup 30 = 780, profit 180, margin 23.0769%", () => {
  assert.equal(markup(600, 30), 780);
  const p = pricing([{ cost: 600, price: 780, qty: 1 }]);
  assert.equal(p.profit, 180);
  assert.ok(Math.abs(p.margin - 23.076923) < 0.0001);
});
test("unknown cost remains null and blocks final quote", () => {
  let s = as(requested(), "admin");
  const o = current(s);
  s.orders.find((x) => x.id === o.id).lines[0].cost = null;
  assert.equal(pricing(current(s).lines).cost, null);
  assert.throws(() => dispatch(s, "PUBLISH"), /تأكيد/);
});
test("request freezes cart, supplier confirmation is shared", () => {
  let s = requested(),
    id = s.activeOrder;
  assert.equal(s.cart.length, 0);
  s = dispatch(s, "CART_ADD", { id: "s8" });
  assert.equal(current(s).lines.length, 2);
  s = as(s, "supplier");
  s = dispatch(s, "SUPPLIER_RESPONSE", {
    id,
    lineId: "s1",
    response: "CONFIRMED_SUPPLIER",
    cost: 1700,
  });
  assert.equal(current(s).lines[0].response, "CONFIRMED_SUPPLIER");
  assert.equal(s.notifications[0].title.includes(id), true);
});
test("supplier cannot confirm another vendor and customer cannot price/admin", () => {
  let s = as(requested(), "supplier");
  assert.throws(
    () =>
      dispatch(s, "SUPPLIER_RESPONSE", {
        lineId: "s4",
        response: "CONFIRMED_SUPPLIER",
      }),
    /مورد آخر/,
  );
  s = as(s, "customer");
  assert.throws(() => dispatch(s, "PRICE", { discount: 100 }), /صلاحية/);
  assert.throws(() => dispatch(s, "USER_SAVE", {}), /صلاحية/);
});
test("final quote blocked until supplier response and independent reviews", () => {
  let s = as(requested(), "staff");
  assert.throws(() => dispatch(s, "PUBLISH"), /تأكيد/);
  for (let l of current(s).lines)
    s = dispatch(s, "SUPPLIER_RESPONSE", {
      lineId: l.id,
      response: "CONFIRMED_SUPPLIER",
      cost: l.cost,
    });
  assert.throws(() => dispatch(s, "PUBLISH"), /مراجعة موظف/);
  s = dispatch(s, "APPROVE_INTERNAL", { reason: "مراجعة" });
  assert.throws(
    () => dispatch(s, "APPROVE_INTERNAL", { reason: "ثانية" }),
    /المرحلتين/,
  );
  assert.throws(() => dispatch(s, "PUBLISH"), /المالك/);
});
test("rejection and alternative restores quote readiness", () => {
  let s = as(requested(), "staff");
  s = dispatch(s, "SUPPLIER_RESPONSE", {
    lineId: "s1",
    response: "REJECTED",
    reason: "موعد غير متاح، بديل بنفس السعة",
  });
  assert.equal(current(s).status, "SUPPLIER_UNAVAILABLE");
  s = dispatch(s, "ALTERNATIVE", { lineId: "s1" });
  s = dispatch(s, "SUPPLIER_RESPONSE", {
    lineId: "s4",
    response: "CONFIRMED_SUPPLIER",
    cost: 816,
  });
  assert.equal(current(s).status, "QUOTE_READY");
});
test("low margin requires owner and logs before/after", () => {
  let s = as(requested(), "staff");
  s = dispatch(s, "PRICE", { discount: 1000 });
  assert.equal(current(s).status, "NEEDS_OWNER_APPROVAL");
  assert.equal(s.audit[0].action, "تحديث التسعير");
  assert.ok(s.audit[0].before);
  assert.ok(s.audit[0].after);
  assert.throws(() => dispatch(s, "REFUND", {}), /صلاحية/);
});
test("contract blocks payment until signed and snapshot immutable", () => {
  let s = as(approved(), "customer");
  assert.throws(() => dispatch(s, "PAY"), /توقيع/);
  s = dispatch(s, "QUOTE_ACCEPT");
  assert.throws(
    () => dispatch(s, "SIGN", { signature: "", consent: true }),
    /التوقيع/,
  );
  const old = structuredClone(current(s).contract.snapshot);
  s = dispatch(s, "SIGN", { signature: "سارة", consent: true });
  assert.equal(current(s).contract.status, "SIGNED");
  s = dispatch(s, "CART_ADD", { id: "s8" });
  assert.deepEqual(current(s).contract.snapshot, old);
  s = as(s, "admin");
  assert.throws(() => dispatch(s, "PRICE", { discount: 1 }), /موقع/);
});
test("decline -> retry success -> deposit 30%, no duplicate payment", () => {
  let s = signed();
  s = dispatch(s, "PAY", { scenario: "decline" });
  assert.equal(current(s).paid, 0);
  assert.equal(s.payments[0].status, "FAILED");
  s = dispatch(s, "PAY", { scenario: "success" });
  const total = current(s).contract.total;
  assert.equal(current(s).paid, total * 0.3);
  assert.equal(current(s).status, "CONFIRMED");
  assert.equal(s.payments[0].status, "PAID");
  assert.throws(() => dispatch(s, "PAY", { scenario: "success" }), /بالفعل/);
});
test("pending -> webhook settles only once", () => {
  let s = signed();
  s = dispatch(s, "PAY", { scenario: "pending" });
  assert.equal(current(s).paid, 0);
  let pid = s.lastPayment;
  s = dispatch(s, "WEBHOOK", { paymentId: pid });
  assert.equal(current(s).status, "CONFIRMED");
  assert.throws(() => dispatch(s, "WEBHOOK", { paymentId: pid }), /معلقة/);
});
test("future milestones blocked until due", () => {
  let s = signed();
  s.orders.find((o) => o.id === s.activeOrder).occasion.date = "2099-12-12";
  s = dispatch(s, "PAY", { scenario: "success" });
  assert.throws(() => dispatch(s, "PAY", { milestone: 1 }), /مستحقة/);
  s = as(s, "admin");
  s = dispatch(s, "SETTINGS", { ...s.settings, earlyPayment: true });
  s = as(s, "customer");
  s = dispatch(s, "PAY", { milestone: 1 });
  assert.equal(s.payments[0].milestone, 1);
});
test("refund pending -> refunded updates customer balance", () => {
  let s = dispatch(signed(), "PAY", { scenario: "success" });
  const amount = 50,
    pid = s.lastPayment,
    before = current(s).paid;
  s = as(s, "admin");
  s = dispatch(s, "REFUND", { paymentId: pid, amount, reason: "تعديل مبلغ" });
  assert.equal(s.payments[0].refundStatus, "REFUND_PENDING");
  s = dispatch(s, "REFUND_SETTLE", { paymentId: pid });
  assert.equal(s.payments[0].refunded, 50);
  assert.equal(current(s).paid, before - 50);
  assert.equal(s.payments[0].refundStatus, "REFUNDED");
});
test("signed contract amendment stays separate and pays difference", () => {
  let s = signed(),
    original = structuredClone(current(s).contract);
  s = dispatch(s, "CHANGES", { reason: "إضافة تصوير إضافي" });
  s = as(s, "admin");
  s = dispatch(s, "AMENDMENT_CREATE", { serviceId: "s8" });
  s = dispatch(s, "AMENDMENT_CONFIRM");
  s = as(s, "customer");
  s = dispatch(s, "AMENDMENT_ACCEPT");
  s = dispatch(s, "PAY", { amendment: true, scenario: "success" });
  assert.equal(current(s).amendment.status, "CONFIRMED");
  assert.deepEqual(current(s).contract, original);
  assert.ok(current(s).timeline.some((t) => t.status === "تم دفع فرق الملحق"));
});
test("expired quote rejected and can request renewal", () => {
  let s = as(approved(), "admin");
  s = dispatch(s, "EXPIRE");
  s = as(s, "customer");
  assert.throws(() => dispatch(s, "QUOTE_ACCEPT"), /صلاحية/);
  s = dispatch(s, "RENEW");
  assert.equal(current(s).status, "NEEDS_CHANGES");
});
test("catalog mutations reflect current catalog but not old snapshots", () => {
  let s = as(seed(), "admin"),
    before = structuredClone(s.orders[0].lines);
  s = dispatch(s, "CATALOG_SAVE", {
    ...s.services[0],
    title: "قاعة جديدة",
    price: 3000,
  });
  assert.equal(s.services[0].title, "قاعة جديدة");
  assert.deepEqual(s.orders[0].lines, before);
});
