import { hasPermission, actionPermission } from "../src/staff-permissions.mjs";
import { contractHTML, documentHash, brandSnapshot } from "./providers/documents.mjs";
import { totals, couponDiscount } from "../src/money.mjs";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { dispatch, pricing, categories, packageIdOf } from "../src/domain.mjs";
import {integrationEnvironment} from './integration-runtime.mjs';

export const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};
export function emptyState() {
  return {
    version: 3,
    session: null,
    services: [],
    packages: [],
    suppliers: [],
    cart: [],
    favorites: [],
    orders: [],
    payments: [],
    notifications: [],
    audit: [],
    tickets: [],
    users: [],
    accounts: [],
    categories: [...categories],
    activeOrder: null,
    offline: false,
    planner: {
      step: 0,
      type: "حفل زفاف",
      date: "",
      location: "",
      guests: 1,
      budget: 0,
      notes: "",
    },
    settings: {
      brand: "هَبّ السعد",
      threshold: 20,
      deposit: 30,
      second: 40,
      cancellation: "",
      doubleApproval: true,
      earlyPayment: false,
      locale: "ar",
      taxRate: 0,
      coupons: [],
    },
  };
}
export const permissions = {
  PLANNER: ["guest", "customer"],
  FAVORITE: ["customer"],
  CART_ADD: ["guest", "customer"],
  CART_PACKAGE: ["guest", "customer"],
  CART_REMOVE: ["guest", "customer"],
  CART_UNDO: ["guest", "customer"],
  CART_QTY: ["guest", "customer"],
  COUPON: ["customer"],
  SUBMIT: ["customer"],
  ASSISTED_SUBMIT: ["staff", "admin"],
  SELECT_ORDER: ["customer", "supplier", "staff", "admin"],
  AMENDMENT_APPROVE: ["staff", "admin"],
  PROFILE: ["customer", "supplier", "staff", "admin"],
  READ: ["customer", "supplier", "staff", "admin"],
  TICKET: ["guest", "customer", "supplier", "staff", "admin"],
  REVIEW: ["staff", "admin"],
  SUPPLIER_RESPONSE: ["supplier", "staff", "admin"],
  ALTERNATIVE: ["staff", "admin"],
  PRICE: ["staff", "admin"],
  APPROVE_INTERNAL: ["staff", "admin"],
  PUBLISH: ["staff", "admin"],
  QUOTE_ACCEPT: ["customer"],
  CHANGES: ["customer"],
  AMENDMENT_CREATE: ["staff", "admin"],
  AMENDMENT_CONFIRM: ["staff", "admin"],
  AMENDMENT_ACCEPT: ["customer"],
  SIGN: ["customer"],
  CANCEL: ["customer"],
  CANCEL_APPROVE: ["admin"],
  EXECUTION: ["supplier", "staff", "admin"],
  TASK: ["staff", "admin"],
  NOTE: ["staff", "admin"],
  CATEGORY_SAVE: ["admin"],
  CATEGORY_DELETE: ["admin"],
  CATALOG_SAVE: ["admin", "staff"],
  CATALOG_DELETE: ["admin", "staff"],
  PACKAGE_SAVE: ["admin", "staff"],
  PACKAGE_DELETE: ["admin", "staff"],
  SUPPLIER_SAVE: ["admin", "staff"],
  USER_SAVE: ["admin"],
  SETTINGS: ["admin"],
  TICKET_REPLY: ["staff", "admin"],
  FEEDBACK: ["customer"],
  RENEW: ["customer", "staff", "admin"],
  AVAILABILITY: ["staff", "admin"],
  ORDER_REVIEW_DECISION: ["admin", "staff"],
  ORDER_DETAILS: ["admin", "staff"],
  CONTRACT_REVISE: ["admin", "staff"],
};
const workspaceActions = new Set([
  "PLANNER",
  "FAVORITE",
  "CART_ADD",
  "CART_PACKAGE",
  "CART_REMOVE",
  "CART_UNDO",
  "CART_QTY",
  "COUPON",
  "SELECT_ORDER",
]);
const orderActions = new Set([
  "ORDER_REVIEW_DECISION",
  "ORDER_DETAILS",
  "CONTRACT_REVISE",
  "REVIEW",
  "SUPPLIER_RESPONSE",
  "ALTERNATIVE",
  "PRICE",
  "APPROVE_INTERNAL",
  "PUBLISH",
  "QUOTE_ACCEPT",
  "CHANGES",
  "AMENDMENT_CREATE",
  "AMENDMENT_APPROVE",
  "AMENDMENT_CONFIRM",
  "AMENDMENT_ACCEPT",
  "SIGN",
  "CANCEL",
  "CANCEL_APPROVE",
  "EXECUTION",
  "TASK",
  "NOTE",
  "FEEDBACK",
  "RENEW",
]);
export function assertPermission(actor, action, order) {
  if (actor?.role === "supplier" || !permissions[action]?.includes(actor?.role || "guest"))
    fail("ليس لديك صلاحية لهذا الإجراء", 403);
  if (actor?.role === "staff" && actor.staffRoleId &&
      action !== "PROFILE" && action !== "READ" &&
      (!actionPermission[action] || !hasPermission(actor, actionPermission[action])))
    fail("الدور لا يملك صلاحية هذا الإجراء", 403);
  if (order && actor?.role === "customer" && order.customerId !== actor.id)
    fail("الطلب غير مخوّل", 403);
  if (
    order &&
    actor?.role === "supplier" &&
    ![...order.lines, ...historicLines(order), ...(order.amendment?.lines || [])].some(
      (l) => l.supplierId === actor.supplierId,
    )
  )
    fail("الطلب غير مخوّل", 403);
}
export function validatePayload(action, p) {
  z.record(z.string(), z.unknown()).parse(p);
  if (JSON.stringify(p).length > 160000) fail("حجم الطلب أكبر من المسموح");
  function walk(v, key = "") {
    if (typeof v === "number" && !Number.isFinite(v)) fail("قيمة غير صحيحة");
    if (
      typeof v === "number" &&
      ["price", "cost", "discount", "budget", "amount"].includes(key) &&
      (v < 0 || v > 10000000)
    )
      fail("المبلغ خارج النطاق");
    if (key === "qty" && (!Number.isInteger(v) || v < 1 || v > 10000))
      fail("الكمية غير صحيحة");
    if (Array.isArray(v)) {
      if (v.length > 500) fail("عدد العناصر أكبر من المسموح");
      v.forEach((x) => walk(x));
    } else if (v && typeof v === "object")
      Object.entries(v).forEach(([k, x]) => {
        if (["__proto__", "constructor", "prototype"].includes(k))
          fail("حقل غير مسموح");
        walk(x, k);
      });
  }
  walk(p);
  if (p.id !== undefined) z.string().min(1).max(150).parse(p.id);
  if (action === "PLANNER" && p.date !== undefined && p.date !== "")
    z.iso.date().parse(p.date);
  if (action === "SUPPLIER_RESPONSE")
    z.enum(["CONFIRMED_SUPPLIER", "REJECTED"]).parse(p.response);
  if (action === "EXECUTION")
    z.enum([
      "Preparing",
      "On the way",
      "Delivered",
      "Completed",
      "Issue",
      "CONFIRMED",
    ]).parse(p.status);
  if (action === "TASK") z.number().int().min(0).max(2).parse(p.index);
  return p;
}
const profile = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  mobile: r.mobile,
  role: r.role,
  supplierId: r.supplier_id,
  active: r.active,
  mfa: !!r.mfa_secret,
});
const rows = async (c, sql, args = []) => (await c.query(sql, args)).rows;
const historicLines = o => (o.amendmentHistory || []).flatMap(a => a.lines || []);
export async function readState(
  c,
  actor,
  visitorId,
  internal = false,
  scopeId = null,
  projection = {},
) {
  const s = emptyState();
  const settings = await rows(c, "SELECT data FROM app_settings WHERE id=true");
  Object.assign(
    s.settings,
    settings[0]?.data?.settings || settings[0]?.data || {},
  );
  s.categories = settings[0]?.data?.categories || s.categories;
  if (!internal) {
    s.content = Object.fromEntries((await rows(c,
      "SELECT p.content_key,r.value FROM content_publications p JOIN content_revisions r ON r.id=p.revision_id",
    )).map(row => [row.content_key,row.value]));
  }
  s.services = projection.light && !projection.catalog ? [] : (
    await rows(
      c,
      "SELECT id,data,capacity,active FROM catalog_services WHERE active=true ORDER BY created_at,id",
    )
  ).map((r) => ({
    ...r.data,
    id: r.id,
    capacity: r.capacity,
    available: r.active,
  }));
  s.packages = projection.light && !projection.catalog ? [] : (
    await rows(c, "SELECT id,data FROM packages WHERE active=true ORDER BY id")
  ).map((r) => ({ ...r.data, id: r.id }));
  s.suppliers = projection.light && !projection.catalog ? [] : (
    await rows(c, "SELECT id,name,data,active FROM suppliers ORDER BY id")
  ).map((r) => ({ ...r.data, id: r.id, name: r.name, active: r.active }));
  if (!internal && !["admin","staff"].includes(actor?.role)) {
    const archived = new Set(s.suppliers.filter(supplier=>!supplier.active).map(supplier=>supplier.id));
    s.services = s.services.filter(service=>!archived.has(service.supplierId));
    const activeServices = new Set(s.services.map(service=>service.id));
    if (!projection.light || projection.catalog)
      s.packages = s.packages.filter(pack=>pack.serviceIds?.every(id=>activeServices.has(id)));
  }
  const wid = actor?.id || visitorId;
  const ws =
    (await rows(c, "SELECT data FROM workspaces WHERE id=$1", [wid]))[0]
      ?.data || {};
  for (const k of [
    "cart",
    "planner",
    "favorites",
    "activeOrder",
    "lastRemoved",
    "coupon",
    "lastPayment",
  ])
    if (ws[k] !== undefined) s[k] = ws[k];
  if (actor || internal) {
    s.users =
      !projection.light && (internal || ["admin", "staff"].includes(actor?.role))
        ? (
            await rows(
              c,
              internal?"SELECT id,email,name,mobile,role,supplier_id,active,mfa_secret FROM users WHERE role IN ('admin','staff') OR id=$1 OR id=$2 OR id IN(SELECT customer_id FROM bookings WHERE id=$2) OR supplier_id IN(SELECT supplier_id FROM order_lines WHERE booking_id=$2) OR id IN(SELECT user_id FROM tickets WHERE id=$2) ORDER BY created_at":"SELECT id,email,name,mobile,role,supplier_id,active,mfa_secret FROM users ORDER BY created_at",
              internal?[actor?.id || '',scopeId || ws.activeOrder || '']:[],
            )
          ).map(profile)
        : [];
    const restricted = !internal && !["admin", "staff"].includes(actor?.role);
    const selected=Array.isArray(projection.bookingIds);
    const bookingSQL = selected ? "SELECT data || jsonb_build_object('version',version,'id',id,'customerId',customer_id,'status',status) AS data FROM bookings WHERE id IN (SELECT jsonb_array_elements_text($1::jsonb)) ORDER BY created_at DESC,id" : internal
      ? "SELECT data || jsonb_build_object('version',version,'id',id,'customerId',customer_id,'status',status) AS data FROM bookings WHERE id=$1"
      : restricted
        ? actor?.role === "supplier"
          ? "SELECT b.data || jsonb_build_object('version',b.version,'id',b.id,'customerId',b.customer_id,'status',b.status) AS data FROM bookings b WHERE EXISTS(SELECT 1 FROM order_lines l WHERE l.booking_id=b.id AND l.supplier_id=$1) ORDER BY b.created_at DESC,b.id"
          : "SELECT data || jsonb_build_object('version',version,'id',id,'customerId',customer_id,'status',status) AS data FROM bookings WHERE customer_id=$1 ORDER BY created_at DESC,id"
        : "SELECT data || jsonb_build_object('version',version,'id',id,'customerId',customer_id,'status',status) AS data FROM bookings ORDER BY created_at DESC,id";
    s.orders = (
      await rows(
        c,
        bookingSQL,
        selected ? [JSON.stringify(projection.bookingIds)] : internal
          ? [scopeId || ws.activeOrder || ""]
          : restricted
            ? [actor?.role === "supplier" ? actor.supplierId : actor.id]
            : [],
      )
    ).map((r) => r.data);
    s.payments = projection.light && !projection.payments ? [] : (
      await rows(
        c,
        selected || internal ? 'SELECT * FROM payments WHERE booking_id IN (SELECT jsonb_array_elements_text($1::jsonb)) ORDER BY created_at DESC,id' : restricted
          ? "SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC"
          : "SELECT * FROM payments ORDER BY created_at DESC",
        selected || internal ? [JSON.stringify(selected?projection.bookingIds:[scopeId || ws.activeOrder || ''])] : restricted ? [actor.id] : [],
      )
    ).map((r) => ({
      ...r.data,
      id: r.id,
      orderId: r.booking_id,
      amount: Number(r.amount_minor) / 1000,
      status: r.status,
      milestone: r.milestone,
      method: r.provider,
      at: r.created_at,
      receipt: r.provider_reference || r.id,
    }));
    s.notifications = (
      await rows(
        c,
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1000",
        [actor?.id || ""],
      )
    ).map((r) => ({
      ...r.data,
      id: r.id,
      userId: r.user_id,
      read: !!r.read_at,
    }));
    s.tickets = projection.light ? [] : (
      await rows(
        c,
        internal ? 'SELECT id,user_id,data FROM tickets WHERE id=$1' : ["admin", "staff"].includes(actor?.role)
          ? "SELECT id,user_id,data FROM tickets ORDER BY created_at DESC"
          : "SELECT id,user_id,data FROM tickets WHERE user_id=$1 ORDER BY created_at DESC",
        internal ? [scopeId || ''] : ["admin", "staff"].includes(actor?.role) ? [] : [actor?.id || ""],
      )
    ).map((r) => ({ ...r.data, id: r.id, userId: r.user_id }));
    if (!projection.light && !internal && ["admin", "staff"].includes(actor?.role))
      s.audit = (
        await rows(
          c,
          "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500",
        )
      ).map((r) => ({
        id: r.id,
        actor: r.actor_id,
        action: r.action,
        entity: r.resource_id,
        before: r.before_data,
        after: r.after_data,
        at: r.created_at,
      }));
  }
  s.session = actor ? { ...actor } : null;
  if (internal) return s;
  s.settings.signatureMode=integrationEnvironment().ESIGNATURE_MODE==='bridge'?'bridge':'clickwrap';
  const signatureRows=s.orders.length?await rows(c,'SELECT r.id,r.booking_id,r.status,c.version FROM signature_requests r JOIN contracts c ON c.id=r.contract_id WHERE r.booking_id IN (SELECT jsonb_array_elements_text($1::jsonb))',[JSON.stringify(s.orders.map(o=>o.id))]):[];
  for(const o of s.orders){const signature=signatureRows.find(x=>x.booking_id===o.id && x.version===o.contract?.version);if(signature)o.externalSignature={id:signature.id,status:signature.status};}
  const owned = (o) =>
    actor?.role === "customer"
      ? o.customerId === actor.id
      : actor?.role === "supplier"
        ? [...o.lines, ...historicLines(o), ...(o.amendment?.lines || [])].some(
            (l) => l.supplierId === actor.supplierId,
          )
        : ["admin", "staff"].includes(actor?.role);
  s.orders = s.orders.filter(owned);
  s.payments = s.payments.filter((p) =>
    s.orders.some((o) => o.id === p.orderId),
  );
  s.notifications = s.notifications.filter((n) => n.userId === actor?.id);
  s.tickets = s.tickets.filter(
    (t) => ["admin", "staff"].includes(actor?.role) || t.userId === actor?.id,
  );
  if (!["admin", "staff"].includes(actor?.role)) {
    s.users = [];
    s.settings = {
      brand: s.settings.brand,
      brandLatin: s.settings.brandLatin,
      brandLogo: s.settings.brandLogo,
      brandEmblem: s.settings.brandEmblem,
      brandIcon: s.settings.brandIcon,
      locale: s.settings.locale,
      deposit: s.settings.deposit,
      second: s.settings.second,
      cancellation: s.settings.cancellation,
      taxRate: s.settings.taxRate,
      companyName: s.settings.companyName,
      contactEmail: s.settings.contactEmail,
      contactPhone: s.settings.contactPhone,
      terms: s.settings.terms,
      privacy: s.settings.privacy,
      signatureMode:s.settings.signatureMode,
    };
    const redact = (l) => {
      const { cost, markup, profit, margin, ...rest } = l;
      return { ...rest, cost: null };
    };
    s.services = s.services.map(redact);
    s.cart = s.cart.map(redact);
    s.orders = s.orders.map((o) => {
      const copy = structuredClone(o);
      const sanitizeFinance = value => {
        if (!value) return;
        for (const key of ["cost","profit","margin"]) delete value[key];
      };
      sanitizeFinance(copy.financials);
      if (actor.role === "supplier") delete copy.financials;
      delete copy.notes;
      copy.notes = [];
      delete copy.ownerApproved;
      copy.approvals = [];
      copy.timeline = (copy.timeline || []).map(({reason,...entry}) => entry);
      delete copy.createdBy;
      delete copy.source;
      const publicLine = line => {
        const { verification, ...visible } = redact(line);
        return visible;
      };
      copy.lines = copy.lines
        .filter(
          (l) => actor.role !== "supplier" || l.supplierId === actor.supplierId,
        )
        .map((l) =>
          actor.role === "supplier" ? { ...l, price: l.cost || 0 } : publicLine(l),
        );
      if (actor.role === "supplier") {
        copy.contract = null;
        delete copy.externalSignature;
        delete copy.quoteSnapshot;
        copy.discount = 0;
        copy.paid = 0;
      } else {
        if (copy.contract)
          copy.contract.snapshot = copy.contract.snapshot.map(publicLine);
        if (copy.quoteSnapshot)
          copy.quoteSnapshot = copy.quoteSnapshot.map(publicLine);
      }
      for (const a of [copy.amendment,...(copy.amendmentHistory || [])].filter(Boolean)) {
        a.lines = a.lines
          .filter(
            (l) =>
              actor.role !== "supplier" || l.supplierId === actor.supplierId,
          )
          .map(l => actor.role === "supplier" ? {...l,price:l.cost || 0} : redact(l));
        a.approvals = [];
        sanitizeFinance(a.financials);
        if (actor.role === "supplier") { delete a.financials; delete a.paid; }
      }
      if (actor.role === "supplier") copy.lines.push(...historicLines(copy),...(copy.amendment?.status === "CONFIRMED" ? copy.amendment.lines : []));
      return copy;
    });
    if (actor?.role === "supplier") s.payments = [];
    if (actor?.role === "supplier") s.suppliers = s.suppliers.filter(v=>v.id===actor.supplierId);
    if (actor?.role !== "supplier")
      s.suppliers = s.suppliers.map((v) => ({
        id: v.id,
        name: v.name,
        active: v.active,
        category: v.category,
        area: v.area,
        rating: v.rating || 0,
      }));
  }
  const ratings = s.services.length || s.suppliers.length ? await rows(c, `SELECT service_id,supplier_id,avg(rating)::numeric AS rating,count(*)::int AS reviews
    FROM (SELECT DISTINCT b.id,regexp_replace(l->>'id','^.*:','') AS service_id,
      l->>'supplierId' AS supplier_id,(b.data->'feedback'->>'rating')::int AS rating
      FROM bookings b CROSS JOIN LATERAL jsonb_array_elements(b.data->'lines') l
      WHERE b.status='COMPLETED' AND b.data->'feedback'->>'rating' ~ '^[1-5]$') q
    GROUP BY service_id,supplier_id`) : [];
  for (const service of s.services) {
    const matches = ratings.filter(r => r.service_id === service.id);
    const count = matches.reduce((sum, r) => sum + Number(r.reviews), 0);
    service.rating = count ? matches.reduce((sum,r) => sum + Number(r.rating)*Number(r.reviews),0)/count : 0;
    service.reviews = count;
  }
  const supplierStats=s.suppliers.length?await rows(c,`SELECT l.supplier_id,count(*) AS n,count(*) FILTER(WHERE l.data->>'response'='CONFIRMED_SUPPLIER') AS confirmed,count(*) FILTER(WHERE l.data->>'execution'='Completed') AS completed,count(DISTINCT l.booking_id) FILTER(WHERE l.data->>'response'='WAITING' AND b.status NOT IN ('CANCELLED','EXPIRED','COMPLETED')) AS waiting FROM order_lines l JOIN bookings b ON b.id=l.booking_id WHERE l.supplier_id IN (SELECT jsonb_array_elements_text($1::jsonb)) GROUP BY l.supplier_id`,[JSON.stringify(s.suppliers.map(v=>v.id))]):[];
  for (const v of s.suppliers) {
    const stats=supplierStats.find(r=>r.supplier_id===v.id);
    v.response=stats?.n?Math.round(Number(stats.confirmed)/Number(stats.n)*100):0;
    v.reliability=stats?.n?Math.round(Number(stats.completed)/Number(stats.n)*100):0;
    v.waitingOrders=Number(stats?.waiting || 0);
    const matches = ratings.filter(r => r.supplier_id === v.id);
    const count = matches.reduce((sum,r) => sum + Number(r.reviews),0);
    v.rating = count ? matches.reduce((sum,r) => sum + Number(r.rating)*Number(r.reviews),0)/count : 0;
  }
  s.lastPayment = s.lastPayment || s.payments[0]?.id;
  s.activeOrder = s.orders.some((o) => o.id === s.activeOrder)
    ? s.activeOrder
    : s.orders[0]?.id;
  if (!["admin", "staff"].includes(actor?.role)) {
    const visible = actor
      ? (
          await rows(c, "SELECT id FROM files WHERE owner_id=$1", [actor.id])
        ).map((x) => x.id)
      : [];
    s.orders.forEach((o) => {
      o.attachments = (o.attachments || []).filter((f) =>
        visible.includes(f.id),
      );
    });
  }
  if (actor?.staffRoleId) {
    const can = permission => hasPermission(actor, permission);
    if (!can("orders.view")) s.orders = can("contracts.view") ? s.orders.filter(order=>order.contract) : [];
    if (!can("contracts.view")) s.orders = s.orders.map(({contract,externalSignature,...order}) => ({
      ...order, contract:contract ? {status:contract.status} : null,
    }));
    if (!can("payments.view")) s.payments = [];
    else s.payments = s.payments.map(({profit,margin,cost,discount,...payment}) => payment);
    if (!can("audit.view") || !can("costs.view") || !can("profit.view") || !can("discounts.view")) s.audit = [];
    s.users = [];
    s.tickets = [];
    const sanitize = value => {
      if (Array.isArray(value)) return value.map(sanitize);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value).filter(([key]) =>
        (can("costs.view") || !/cost|markup|payoutRecipient|supplierInvoice/i.test(key)) &&
        (can("profit.view") || !/profit|margin/i.test(key)) &&
        (can("discounts.view") || !/discount|coupon/i.test(key)),
      ).map(([key,item]) => [key,sanitize(item)]));
    };
    s.orders = sanitize(s.orders);
    s.services = sanitize(s.services);
    s.suppliers = (can("suppliers.view") || can("procurement.edit") || can("expenses.edit")) ? sanitize(s.suppliers) : [];
    s.settings = sanitize(s.settings);
    delete s.settings.integrationSecrets;
    s.packages = sanitize(s.packages);
  }
  if(['admin','staff'].includes(actor?.role))s.counters={ownerApprovals:Number((await c.query("SELECT count(*) FROM bookings WHERE status='NEEDS_OWNER_APPROVAL'")).rows[0].count)};
  s.runtime = { mode: "real", ready: true };
  return s;
}
export async function reserveCapacity(
  c,
  o,
  status = "HELD",
  checkOnly = false,
) {
  const byService = new Map();
  for (const l of o.lines) {
    const id = l.id.includes(":") ? l.id.split(":").at(-1) : l.id;
    byService.set(id, (byService.get(id) || 0) + l.qty);
  }
  for (const [id, qty] of [...byService].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const service = (
      await rows(c, "SELECT c.*, COALESCE(s.active,true) AS supplier_active FROM catalog_services c LEFT JOIN suppliers s ON s.id=c.supplier_id WHERE c.id=$1 FOR UPDATE OF c", [
        id,
      ])
    )[0];
    if (!service?.active || !service.supplier_active) fail("الخدمة غير متاحة", 409);
    const override = (
      await rows(
        c,
        "SELECT * FROM service_availability WHERE service_id=$1 AND event_date=$2",
        [id, o.occasion.date],
      )
    )[0];
    const reserved = (
      await rows(
        c,
        "SELECT COALESCE(sum(qty),0) AS used FROM reservations WHERE service_id=$1 AND event_date=$2 AND booking_id<>$3 AND (status='CONFIRMED' OR (status='HELD' AND expires_at>now()))",
        [id, o.occasion.date, o.id],
      )
    )[0];
    if (
      override?.blocked ||
      Number(reserved.used) + qty > (override?.capacity ?? service.capacity)
    )
      fail("التاريخ أو الكمية لم تعد متاحة؛ اختاري موعدًا أو خدمة أخرى", 409);
    if (!checkOnly)
      await c.query(
        "INSERT INTO reservations(booking_id,service_id,event_date,qty,status,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days') ON CONFLICT(booking_id,service_id) DO UPDATE SET event_date=EXCLUDED.event_date,qty=EXCLUDED.qty,status=EXCLUDED.status,expires_at=EXCLUDED.expires_at",
        [o.id, id, o.occasion.date, qty, status],
      );
  }
}
export async function executeCommand(
  c,
  actor,
  visitorId,
  action,
  input = {},
  idempotencyKey,
  readProjection = {},
) {
  const p = validatePayload(action, structuredClone(input));
  const assisted = action === "ASSISTED_SUBMIT";
  const submission = action === "SUBMIT" || assisted;
  for (const key of [
    "price",
    "discount",
    "budget",
    "cost",
    "threshold",
    "deposit",
    "second",
    "capacity",
  ])
    if (p[key] !== undefined && p[key] !== null)
      z.number().finite().min(0).max(10000000).parse(p[key]);
  if (p.guests !== undefined)
    z.number().int().min(1).max(100000).parse(p.guests);
  if (action === "PLANNER" && p.step !== undefined)
    z.number().int().min(0).max(5).parse(p.step);
  if (action === "PACKAGE_SAVE" && p.capacity !== undefined)
    z.number().int().positive().parse(p.capacity);
  if (action === "PROFILE") {
    if (p.name !== undefined) z.string().trim().min(2).max(120).parse(p.name);
    if (p.mobile !== undefined)
      z.string()
        .min(8)
        .max(24)
        .regex(/^\+?[\d\s()-]+$/)
        .parse(p.mobile);
  }
  assertPermission(actor, action);
  const wid = actor?.id || visitorId;
  if (!wid) fail("جلسة غير صالحة", 401);
  if (!idempotencyKey || idempotencyKey.length > 150)
    fail("Idempotency-Key مطلوب");
  const structural = [
    "SETTINGS",
    "CATEGORY_SAVE",
    "CATEGORY_DELETE",
    "CATALOG_SAVE",
    "CATALOG_DELETE",
    "PACKAGE_SAVE",
    "PACKAGE_DELETE",
    "USER_SAVE",
    "SUPPLIER_SAVE",
  ].includes(action);
  await c.query(
    "SELECT id FROM app_settings WHERE id=true " +
      (structural ? "FOR UPDATE" : "FOR SHARE"),
  );
  await c.query(
    "INSERT INTO workspaces(id,data) VALUES($1,'{}') ON CONFLICT DO NOTHING",
    [wid],
  );
  await c.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [wid]);
  if (orderActions.has(action) || action === "SELECT_ORDER") {
    const workspace = (
      await rows(c, "SELECT data FROM workspaces WHERE id=$1", [wid])
    )[0]?.data;
    await c.query("SELECT id FROM bookings WHERE id=$1 FOR UPDATE", [
      p.id || workspace?.activeOrder || "",
    ]);
  }
  const hash = digest({ action, p });
  const cached = (
    await rows(
      c,
      "SELECT * FROM command_idempotency WHERE actor_id=$1 AND key=$2",
      [wid, idempotencyKey],
    )
  )[0];
  if (cached) {
    if (cached.request_hash !== hash)
      fail("مفتاح الطلب مستخدم لعملية مختلفة", 409);
    return readState(c, actor, visitorId,false,null,readProjection);
  }
  const s = await readState(c, actor, visitorId, true, p.id);
  const old = structuredClone(s);
  let o = s.orders.find((o) => o.id === (p.id || s.activeOrder));
  if (orderActions.has(action)) {
    if (!o) fail("الطلب غير موجود", 404);
    assertPermission(actor, action, o);
    if (p.expectedVersion !== undefined && p.expectedVersion !== o.version)
      fail("تم تحديث الطلب. أعد تحميله قبل المحاولة", 409);
    p.id = o.id;
  }
  if(action==='SIGN'){
    const external=(await rows(c,'SELECT id FROM signature_requests WHERE booking_id=$1 AND contract_id IN (SELECT id FROM contracts WHERE booking_id=$1 AND version=$2)',[o.id,o.contract?.version || 0])).length>0;
    if(external || integrationEnvironment().ESIGNATURE_MODE==='bridge')fail('يلزم متابعة توقيع هذا العقد عبر جهة التوقيع الخارجية',409);
  }
  if(action==='FEEDBACK'){z.number().int().min(1).max(5).parse(p.rating);if(o.status!=='COMPLETED')fail('التقييم متاح بعد اكتمال التنفيذ',409);}
  if (action === "CHANGES" && o.amendment) {
    if (o.amendment.status !== "CONFIRMED") fail("أكمل الملحق الحالي قبل طلب ملحق آخر",409);
    o.amendmentHistory ||= [];
    o.amendmentHistory.push(structuredClone(o.amendment));
  }
  if (action === "SELECT_ORDER") {
    o = s.orders.find((o) => o.id === p.id);
    if (!o) fail("الطلب غير موجود", 404);
    assertPermission(actor, action, o);
  }
  if (action === "SETTINGS") {
    for (const key of ["brand", "brandLatin"])
      if (p[key] !== undefined) p[key] = z.string().trim().max(100).regex(/^[^\x00-\x1f\x7f]*$/).parse(p[key]);
    for (const key of ["brandLogo", "brandEmblem", "brandIcon"]) {
      if (p[key] === undefined || p[key] === null) continue;
      const defaults = { brandLogo: "/assets/habb-alsaad-logo-clean.png", brandEmblem: "/assets/habb-alsaad-emblem.png", brandIcon: "/assets/habb-alsaad-icon.png" };
      if (p[key] === defaults[key]) continue;
      const value = z.string().max(140000).parse(p[key]);
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
      const bytes = match ? Buffer.from(match[2], "base64") : Buffer.alloc(0);
      const valid = match && bytes.length <= 102400 && bytes.toString("base64") === match[2] &&
        (match[1] === "png" ? bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"))
          : match[1] === "jpeg" ? bytes.subarray(0,3).equals(Buffer.from("ffd8ff","hex"))
          : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP");
      if (!valid) fail("استخدم صورة PNG أو JPEG أو WebP بحجم لا يتجاوز 100 كيلوبايت", 400);
    }
  }
  if (action === "SETTINGS" && p.coupons !== undefined)
    z.array(
      z.object({
        code: z.string().min(1).max(40),
        percent: z.number().min(0).max(100),
        active: z.boolean(),
        expiresAt: z.iso.datetime().optional(),
      }),
    )
      .max(100)
      .parse(p.coupons);
  if (action === "SUPPLIER_SAVE") {
    for (const key of Object.keys(p))
      if (!["id","name","active","area","serviceAreas","terms","notes","phone","email","category","payoutRecipientId"].includes(key)) delete p[key];
    if (p.payoutRecipientId !== undefined && actor.role !== "admin") fail("مرجع التحويل من صلاحية المالك",403);
    if (!p.id || p.name !== undefined) p.name = z.string().trim().min(2).max(160).parse(p.name);
    if (p.active !== undefined) z.boolean().parse(p.active);
    for (const field of ["area","serviceAreas","terms","notes","phone","category","payoutRecipientId"])
      if (p[field] !== undefined) p[field] = z.string().trim().max(3000).parse(p[field]);
    if (p.email) p.email = z.email().parse(p.email);
    if (p.id && !s.suppliers.some(supplier=>supplier.id===p.id)) fail("المورد غير موجود",404);
  }
  if (action === "SETTINGS" && p.workflow !== undefined)
    p.workflow = z.object({
      supplierReview: z.boolean(),
      staffReview: z.boolean(),
      approval: z.enum(["owner", "delegated"]),
    }).strict().parse(p.workflow);
  if (action === "SETTINGS" && p.taxRate !== undefined)
    z.number().min(0).max(100).parse(p.taxRate);
  if (action === "PROFILE") {
    for (const k of Object.keys(p))
      if (!["name", "mobile", "location", "locale", "contact"].includes(k))
        delete p[k];
  }
  if (action === "COUPON" && p.code === "") s.coupon = 0;
  else if (action === "COUPON") {
    const coupon = s.settings.coupons?.find(
      (x) =>
        x.code === p.code &&
        x.active &&
        (!x.expiresAt || new Date(x.expiresAt) > new Date()),
    );
    if (!coupon) fail("كود الخصم غير صالح");
    s.coupon = { code: coupon.code, percent: Number(coupon.percent) || 0 };
  }
  if (
    action === "PUBLISH" &&
    o.approvals.some(
      (a) =>
        a.quoteHash !==
        digest({
          lines: o.lines,
          discount: o.discount,
          taxRate: s.settings.taxRate || 0,
        }),
    )
  )
    fail("تغير التسعير أو الضريبة؛ أعد الموافقات", 409);
  if (action === "SUPPLIER_RESPONSE" && p.reason !== undefined)
    p.reason = z.string().trim().max(1000).parse(p.reason);
  if (action === "SUPPLIER_RESPONSE" && p.channel !== undefined)
    z.enum(["phone","whatsapp","email","other"]).parse(p.channel);
  if (action === "SUPPLIER_RESPONSE" && p.cost !== undefined &&
      !hasPermission(actor, "costs.view")) fail("التكلفة تتطلب صلاحية مالية", 403);
  if (action === "PRICE" && p.discount !== undefined && p.discount !== o.discount &&
      !hasPermission(actor, "discounts.view")) fail("الخصم يتطلب صلاحية مالية", 403);
  if (action === "PRICE" && p.lines) {
    if (
      p.lines.length !== o.lines.length ||
      p.lines.some(
        (l) =>
          !o.lines.some((x) => x.id === l.id && x.supplierId === l.supplierId),
      )
    )
      fail("بنود العرض لا تطابق الطلب");
    if (new Set(p.lines.map(line=>line.id)).size !== p.lines.length)
      fail("لا يمكن تكرار بند في الطلب",409);
    if (p.lines.some(line => {
      const existing = o.lines.find(item => item.id === line.id);
      return existing && packageIdOf(existing) && line.qty !== existing.qty;
    })) fail("تعديل عدد الباقات غير مسموح", 409);
    const existingById = new Map(o.lines.map(line=>[line.id,line]));
    const capacityChanged = p.lines.some(line=>existingById.get(line.id)?.qty !== line.qty);
    p.lines = p.lines.map((l) => ({
      ...existingById.get(l.id),
      ...(existingById.get(l.id).qty !== l.qty ? {response:"WAITING",verification:null} : {}),
      qty: l.qty,
      price: l.price,
      cost: hasPermission(actor, "costs.view") ? l.cost : o.lines.find(x => x.id === l.id).cost,
    }));
    if (capacityChanged) await reserveCapacity(c,{...o,lines:p.lines});
  }
  if (action === "ALTERNATIVE") {
    if (o.contract?.status === "SIGNED") fail("يلزم ملحق للعقد الموقع", 409);
    const replacement = s.services.find(
        (l) => l.id === p.serviceId && l.available !== false,
      ),
      line = o.lines.find((l) => l.id === p.lineId);
    if (!replacement || !line || !p.reason?.trim())
      fail("الخدمة البديلة وسبب التغيير مطلوبان");
    if (o.lines.some((x) => x !== line && x.id === replacement.id))
      fail("الخدمة البديلة موجودة بالفعل في الطلب", 409);
    Object.assign(line, {
      ...replacement,
      originalLineId: line.id,
      id: replacement.id,
      qty: line.qty,
      option: line.option,
      response: "WAITING",
    });
    o.status = "SUPPLIER_CONFIRMATION";
    o.approvals = [];
    o.contract = null;
    o.quoteSnapshot = null;
    o.ownerApproved = false;
  }
  if (assisted) {
    const details = z.object({
      customerId: z.string().min(1).max(150),
      occasion: z.object({
        type: z.string().trim().min(1).max(100), date: z.iso.date(),
        location: z.string().trim().min(1).max(200), guests: z.number().int().min(1).max(100000),
        notes: z.string().max(3000).default(""),
      }).strict(),
      items: z.array(z.object({
        id:z.string().min(1).max(150), kind:z.enum(["service","package"]),
        qty:z.number().int().min(1).max(10000).optional(), option:z.string().max(120).optional(),
      }).strict()).min(1).max(100),
      discount:z.number().min(0).optional(),
    }).strict().parse(p);
    const customer = (await rows(c, "SELECT id,name,email,role FROM users WHERE id=$1 AND role='customer' AND (active OR password_hash='!INVITED') FOR SHARE", [details.customerId]))[0];
    if (!customer) fail("حساب العميل غير متاح", 404);
    if (details.discount && !hasPermission(actor, "discounts.view"))
      fail("الخصم يتطلب صلاحية مالية", 403);
    s.session = customer;
    s.users.push(customer);
    s.planner = { ...s.planner, ...details.occasion };
    s.cart = [];
    s.coupon = 0;
    try {
      for (const item of details.items)
        s.cart = dispatch(s, item.kind === "package" ? "CART_PACKAGE" : "CART_ADD", {
          id:item.id, qty:item.qty, option:item.option, guests:details.occasion.guests,
        }).cart;
    } catch (error) {
      fail(error.message, 409);
    }
  }
  if (submission) {
    if (s.coupon?.code) {
      const latest = s.settings.coupons?.find(
        (x) =>
          x.code === s.coupon.code &&
          x.active &&
          (!x.expiresAt || new Date(x.expiresAt) > new Date()),
      );
      if (!latest) fail("انتهت صلاحية الخصم؛ أعد مراجعة السلة", 409);
      s.coupon.percent = Number(latest.percent);
    }
    if (
      s.planner.date <
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait" }).format(
        new Date(),
      )
    )
      fail("اختاري تاريخًا مستقبليًا");
    const rebuilt = new Set();
    const cart = [];
    for (const line of s.cart) {
      const packageId = packageIdOf(line);
      if (packageId) {
        if (rebuilt.has(packageId)) continue;
        rebuilt.add(packageId);
        const planner = { ...s, cart: [] };
        try {
          cart.push(...dispatch(planner, "CART_PACKAGE", {
            id: packageId, guests: line.packageGuests || s.planner.guests, option: line.option,
          }).cart);
        } catch (error) {
          fail(error.message, 409);
        }
        continue;
      }
      const service = s.services.find(x => x.id === line.id);
      if (!service) fail("الخدمة غير موجودة");
      cart.push({ ...service, qty: line.qty, option: line.option, response: "WAITING" });
    }
    s.cart = cart;
  }
  const verifyPublished = action === "SUPPLIER_RESPONSE" &&
    ["CUSTOMER_REVIEW","CONTRACT_APPROVED"].includes(o.status) &&
    p.response === "CONFIRMED_SUPPLIER";
  if (verifyPublished) {
    const line = o.lines.find(item => item.id === p.lineId);
    if (!line) fail("بند الخدمة غير موجود",404);
    if (p.cost !== undefined && p.cost !== line.cost)
      fail("تغيير التكلفة بعد النشر يتطلب إعادة التسعير",409);
    line.response = "CONFIRMED_SUPPLIER";
    line.verification = {
      actorId:actor.id, channel:p.channel || "phone",
      reason:z.string().trim().min(3).max(1000).parse(p.reason),
      at:new Date().toISOString(),
    };
  }
  if (action === "ORDER_DETAILS") {
    const details = z.object({
      id:z.string(), expectedVersion:z.number().int(), date:z.iso.date(),
      location:z.string().trim().min(2).max(200), guests:z.number().int().min(1).max(100000),
      type:z.string().trim().min(2).max(100), notes:z.string().max(3000),
    }).strict().parse(p);
    if (o.contract || o.paid > 0 || !["REQUESTED","INTERNAL_REVIEW","SUPPLIER_CONFIRMATION","QUOTE_READY",
      "NEEDS_OWNER_APPROVAL","NEEDS_CHANGES","SUPPLIER_UNAVAILABLE","CUSTOMER_REVIEW"].includes(o.status))
      fail("لا يمكن تغيير المناسبة بعد إصدار العقد",409);
    if (details.date < new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuwait"}).format(new Date()))
      fail("اختر تاريخًا مستقبليًا",409);
    const dateChanged = o.occasion.date !== details.date;
    o.occasion = {...o.occasion, type:details.type, date:details.date,
      location:details.location, guests:details.guests, notes:details.notes};
    if (dateChanged) o.lines.forEach(line => {line.response = "WAITING";});
    o.approvals = [];
    o.ownerApproved = false;
    o.quoteSnapshot = null;
    o.validUntil = null;
    o.status = "INTERNAL_REVIEW";
    o.timeline.push({status:o.status,at:new Date().toISOString()});
    await c.query("DELETE FROM scheduled_reminders WHERE booking_id=$1 AND kind='EVENT_REMINDER'",[o.id]);
  }
  if (action === "CONTRACT_REVISE") {
    const terms = z.string().trim().min(3).max(10000).parse(p.terms);
    if (!o.contract || o.contract.status !== "APPROVED" || o.paid > 0)
      fail("تعديل العقد الموقّع يتطلب ملحقًا مستقلاً",409);
    if ((await rows(c,"SELECT 1 FROM signature_requests WHERE booking_id=$1 AND status IN ('CREATED','READY','COMPLETED','MANUAL_REVIEW')",[o.id])).length)
      fail("أغلق طلب التوقيع الخارجي قبل إنشاء نسخة جديدة",409);
    const version = Number((await rows(c,"SELECT COALESCE(max(version),0)+1 AS version FROM contracts WHERE booking_id=$1",[o.id]))[0].version);
    o.contract = {...o.contract,version,terms,html:undefined,documentHash:undefined};
    o.timeline.push({status:"CONTRACT_APPROVED",at:new Date().toISOString(),reason:"صدرت نسخة جديدة من شروط العقد"});
    s.notifications.unshift({id:randomUUID(),userId:o.customerId,title:"تم تحديث نسخة عقد مناسبتكم، راجعوها قبل التوقيع",
      to:"/contract/"+o.id,read:false,at:new Date().toISOString()});
  }
  if (action === "ORDER_REVIEW_DECISION") {
    const decision = z.enum(["review", "reject", "cancel"]).parse(p.decision);
    const reason = z.string().trim().min(3).max(1000).parse(p.reason);
    if (o.contract?.status === "SIGNED" || o.paid > 0 ||
      !["REQUESTED", "INTERNAL_REVIEW", "SUPPLIER_CONFIRMATION", "SUPPLIER_UNAVAILABLE",
        "QUOTE_READY", "NEEDS_OWNER_APPROVAL", "NEEDS_CHANGES", "CUSTOMER_REVIEW"].includes(o.status))
      fail("حالة الطلب تتطلب إجراء العقد أو الإلغاء المالي", 409);
    if (decision !== "review" && actor.role !== "admin") fail("الإلغاء والرفض يتطلبان صلاحية المالك", 403);
    o.status = decision === "review" ? "INTERNAL_REVIEW" : "CANCELLED";
    o.timeline.push({ status: o.status, reason, at: new Date().toISOString() });
    o.notes.push({ text: reason, actor: actor.name, at: new Date().toISOString() });
    o.approvals = [];
    o.ownerApproved = false;
    o.quoteSnapshot = null;
    o.validUntil = null;
    s.notifications.unshift({id:randomUUID(),userId:o.customerId,title:decision === "review" ?
      "طلبكم قيد المراجعة" : decision === "reject" ? "تعذّر قبول طلبكم" : "تم إلغاء طلبكم",
      to:"/bookings/"+o.id,read:false,at:new Date().toISOString()});
  }
  if (action === "SIGN" && o.contract && p.contractVersion !== undefined &&
      p.contractVersion !== o.contract.version)
    fail("تغير إصدار العقد؛ راجع النسخة الجديدة",409);
  if (o?.contract && ["PRICE","PUBLISH","ALTERNATIVE","REVIEW"].includes(action))
    fail("صدر العقد. استخدم إجراء إصدار نسخة معدّلة أو الملحق",409);
  if (action === "SUPPLIER_RESPONSE" && o.contract && !verifyPublished)
    fail("العقد صادر. سجّل التأكيد دون تغيير البنود أو راجع إجراءات الإلغاء",409);
  if (action === "SIGN" && !o.lines.every(line => line.response === "CONFIRMED_SUPPLIER"))
    fail("يلزم تحقق الفريق من توفر جميع الخدمات قبل التوقيع", 409);
  if (action === "AMENDMENT_CREATE") {
    if (
      o.contract?.status !== "SIGNED" ||
      !s.services.some((x) => x.id === p.serviceId)
    )
      fail("يلزم عقد موقع وخدمة متاحة", 409);
    if (o.amendment?.status !== "REQUESTED")
      fail("لا يمكن استبدال ملحق منشور؛ اطلب ملحقًا جديدًا", 409);
    if ([...o.lines,...historicLines(o)].some(l=>l.id.split(":").at(-1)===p.serviceId))
      fail("الخدمة موجودة في العقد أو ملحق سابق؛ اختر خدمة إضافية مختلفة",409);
  }
  if (action === "AMENDMENT_ACCEPT" && (!p.consent || !p.signature?.trim()))
    fail("يلزم الإقرار والتوقيع على الملحق", 409);
  let next;
  if (action === "AVAILABILITY") {
    z.string().parse(p.serviceId);
    z.iso.date().parse(p.date);
    z.number().int().min(0).max(10000).parse(p.capacity);
    const svc = s.services.find((x) => x.id === p.serviceId);
    if (
      !svc ||
      (actor.role === "supplier" && svc.supplierId !== actor.supplierId)
    )
      fail("الخدمة غير مخولة", 403);
    await c.query("SELECT id FROM catalog_services WHERE id=$1 FOR UPDATE", [p.serviceId]);
    await c.query(
      "INSERT INTO service_availability(service_id,event_date,capacity,blocked) VALUES($1,$2,$3,$4) ON CONFLICT(service_id,event_date) DO UPDATE SET capacity=EXCLUDED.capacity,blocked=EXCLUDED.blocked",
      [p.serviceId, p.date, p.capacity, !!p.blocked],
    );
    next = s;
  } else if (action === "AMENDMENT_APPROVE") {
    const a = o.amendment;
    if (a?.status !== "INTERNAL_REVIEW" || !p.reason?.trim())
      fail("الملحق ليس جاهزًا للمراجعة أو ينقصه سبب الاعتماد", 409);
    a.approvals ||= [];
    if (a.approvals.some((x) => x.actorId === actor.id))
      fail("لا يمكن للمستخدم اعتماد المرحلتين", 409);
    a.approvals.push({
      actorId: actor.id,
      role: actor.role,
      reason: p.reason,
      at: new Date().toISOString(),
    });
    if (
      a.approvals.some((x) => x.role === "admin") &&
      a.approvals.some((x) => x.role === "staff")
    ) {
      a.status = "CUSTOMER_REVIEW";
      s.notifications.unshift({id:randomUUID(),userId:o.customerId,title:"ملحق طلبك جاهز للمراجعة والتوقيع",to:"/bookings/"+o.id,read:false,at:new Date().toISOString()});
    }
    next = s;
  } else if (verifyPublished || ["COUPON", "ALTERNATIVE", "ORDER_REVIEW_DECISION", "ORDER_DETAILS", "CONTRACT_REVISE"].includes(action)) next = s;
  else {
    const coupon = s.coupon;
    if (submission) s.coupon = 0;
    try {
      next = dispatch(s, assisted ? "SUBMIT" : action, p);
    } catch (error) {
      fail(error.message, 409);
    }
    if (submission) {
      const newOrder = next.orders[0],
        id = "HB-" + randomUUID();
      const previousId = newOrder.id;
      newOrder.id = id;
      newOrder.discount = coupon?.percent
        ? couponDiscount(newOrder.lines, coupon)
        : 0;
      if (assisted) {
        newOrder.createdBy = actor.id;
        newOrder.source = "ASSISTED";
        if (p.discount > pricing(newOrder.lines).subtotal) fail("الخصم خارج الحدود المسموحة", 409);
        newOrder.discount = p.discount || 0;
      }
      newOrder.financials = totals(newOrder.lines, newOrder.discount, 0, s.settings.taxRate || 0);
      next.activeOrder = id;
      next.notifications = next.notifications.map((n) => ({
        ...n,
        to: n.to?.replace(previousId, id),
      }));
      if (!s.settings.cancellation)
        fail("سياسة الإلغاء غير مهيأة؛ تواصلوا مع الإدارة", 503);
    }
  }
  if (action === "USER_SAVE") {
    if (!p.id) fail("استخدم دعوة حساب حقيقية", 409);
    const updatedUser = next.users.find((u) => u.id === p.id);
    if (!updatedUser) fail("المستخدم غير موجود", 404);
    z.enum(["customer", "staff", "admin"]).parse(updatedUser.role);
    if (
      p.id === actor.id &&
      (!updatedUser.active || updatedUser.role !== "admin")
    )
      fail("لا يمكن تعطيل حساب المالك الحالي");
    await c.query(
      "UPDATE users SET name=$2,role=$3,active=$4,staff_role_id=CASE WHEN $3='staff' THEN staff_role_id ELSE NULL END,updated_at=now() WHERE id=$1",
      [p.id, updatedUser.name, updatedUser.role, !!updatedUser.active],
    );
    await c.query("DELETE FROM sessions WHERE user_id=$1", [p.id]);
  }
  if (action === "PROFILE")
    await c.query(
      "UPDATE users SET name=COALESCE($2,name),mobile=COALESCE($3,mobile),updated_at=now() WHERE id=$1",
      [actor.id, p.name || null, p.mobile || null],
    );
  const changed = (key, id) =>
    JSON.stringify(old[key].find((x) => x.id === id)) !==
    JSON.stringify(next[key].find((x) => x.id === id));
  for (const v of next.suppliers)
    if (changed("suppliers", v.id))
      await c.query(
        "INSERT INTO suppliers(id,name,data,active) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,data=EXCLUDED.data,active=EXCLUDED.active",
        [v.id, v.name, v, v.active !== false],
      );
  for (const v of next.services)
    if (changed("services", v.id))
      await c.query(
        "INSERT INTO catalog_services(id,supplier_id,name,data,capacity,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET supplier_id=EXCLUDED.supplier_id,name=EXCLUDED.name,data=EXCLUDED.data,capacity=EXCLUDED.capacity,active=EXCLUDED.active",
        [
          v.id,
          v.supplierId || null,
          v.title,
          { ...v, rating: 0, reviews: 0 },
          v.capacity || 1,
          v.available !== false,
        ],
      );
  for (const v of old.services)
    if (!next.services.some((x) => x.id === v.id))
      await c.query("UPDATE catalog_services SET active=false WHERE id=$1", [
        v.id,
      ]);
  for (const v of next.packages)
    if (changed("packages", v.id))
      await c.query(
        "INSERT INTO packages(id,title,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,data=EXCLUDED.data",
        [v.id, v.title, v],
      );
  for (const v of old.packages)
    if (!next.packages.some((x) => x.id === v.id))
      await c.query("UPDATE packages SET active=false WHERE id=$1", [v.id]);
  if (action === "SETTINGS" || action.startsWith("CATEGORY"))
    await c.query(
      "UPDATE app_settings SET data=$1,updated_at=now() WHERE id=true",
      [{ settings: next.settings, categories: next.categories }],
    );
  for (const b of next.orders)
    if (changed("orders", b.id)) {
      if (action === "AMENDMENT_CREATE") {
        b.amendment.approvals = [];
        b.amendment.financials = totals(
          b.amendment.lines,
          0,
          0,
          s.settings.taxRate || 0,
        );
      }
      if (action === "AMENDMENT_CONFIRM")
        b.amendment.status = "INTERNAL_REVIEW";
      if (action === "AMENDMENT_ACCEPT") {
        b.amendment.signature = p.signature;
        b.amendment.signedAt = new Date().toISOString();
        b.amendment.metadata = {
          actorId: actor.id,
          consent: true,
          hash: digest(b.amendment.lines),
        };
        const version = Number((await rows(c,"SELECT COALESCE(max(version),0)+1 AS version FROM contracts WHERE booking_id=$1",[b.id]))[0].version);
        const amendment = b.amendment;
        amendment.version = version;
        const document = { ...amendment, kind:"AMENDMENT", snapshot:amendment.lines,
          total:amendment.financials.total, terms:b.contract.terms };
        document.branding = brandSnapshot(s.settings);
        document.html = contractHTML({id:b.id,data:b},{version,status:"SIGNED",data:document});
        document.documentHash = documentHash(document.html);
        await c.query("INSERT INTO contracts(id,booking_id,version,status,document_hash,data,signed_at) VALUES($1,$2,$3,'SIGNED',$4,$5,$6)",
          [b.id+":am:"+amendment.id,b.id,version,document.documentHash,document,document.signedAt]);
      }
      if (action === "APPROVE_INTERNAL") {
        b.approvals.at(-1).quoteHash = digest({
          lines: b.lines,
          discount: b.discount,
          taxRate: s.settings.taxRate || 0,
        });
      }
      if (["PUBLISH", "PRICE"].includes(action))
        b.financials = totals(b.lines, b.discount, 0, s.settings.taxRate || 0);
      if (action === "QUOTE_ACCEPT") {
        b.financials = structuredClone(
          o.financials || totals(b.lines, b.discount),
        );
        b.contract.total = b.financials.total;
        b.contract.branding = brandSnapshot(s.settings);
        b.contract.company = {
          name: s.settings.companyName || "",
          registrationNumber: s.settings.registrationNumber || "",
        };
        b.contract.terms = s.settings.terms || b.contract.clauses;
      }
      if (action === "SIGN") {
        b.contract.metadata = {
          actorId: actor.id,
          at: new Date().toISOString(),
          consent: true,
          contentHash: digest(b.contract.snapshot),
          assurance: "authenticated-clickwrap",
        };
      }
      b.version = old.orders.find((x) => x.id === b.id)
        ? Math.max(
            b.version,
            (old.orders.find((x) => x.id === b.id).version || 0) + 1,
          )
        : 1;
      await c.query(
        "INSERT INTO bookings(id,customer_id,status,occasion_date,version,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,occasion_date=EXCLUDED.occasion_date,version=EXCLUDED.version,data=EXCLUDED.data,updated_at=now()",
        [b.id, b.customerId, b.status, b.occasion.date, b.version, b],
      );
      if (
        [
          "SUBMIT",
          "ASSISTED_SUBMIT",
          "ORDER_DETAILS",
          "PUBLISH",
          "SIGN",
          "RENEW",
          "SUPPLIER_RESPONSE",
          "ALTERNATIVE",
        ].includes(action)
      )
        await reserveCapacity(
          c,
          b,
          b.contract?.status === "SIGNED" ? "CONFIRMED" : "HELD",
        );
      if (
        ["AMENDMENT_CREATE", "AMENDMENT_CONFIRM", "AMENDMENT_ACCEPT"].includes(
          action,
        )
      )
        await reserveCapacity(
          c,
          { ...b, lines: [...b.lines, ...historicLines(b), ...b.amendment.lines] },
          "CONFIRMED",
          action !== "AMENDMENT_ACCEPT",
        );
      if (b.status === "CANCELLED")
        await c.query(
          "UPDATE reservations SET status='RELEASED' WHERE booking_id=$1",
          [b.id],
        );
      if (action === "ALTERNATIVE") {
        await c.query("DELETE FROM order_lines WHERE booking_id=$1", [b.id]);
        await c.query(
          "UPDATE reservations SET status='RELEASED' WHERE booking_id=$1 AND service_id NOT IN (SELECT jsonb_array_elements_text($2::jsonb))",
          [
            b.id,
            JSON.stringify(
              b.lines.map((l) =>
                l.id.includes(":") ? l.id.split(":").at(-1) : l.id,
              ),
            ),
          ],
        );
      }
      for (const l of [...b.lines,...historicLines(b),...(b.amendment?.status === "SIGNED" || b.amendment?.status === "CONFIRMED" ? b.amendment.lines : [])])
        await c.query(
          "INSERT INTO order_lines(id,booking_id,service_id,supplier_id,qty,cost_minor,price_minor,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET supplier_id=EXCLUDED.supplier_id,qty=EXCLUDED.qty,cost_minor=EXCLUDED.cost_minor,price_minor=EXCLUDED.price_minor,data=EXCLUDED.data",
          [
            b.id + ":" + l.id,
            b.id,
            l.id.includes(":") ? l.id.split(":").at(-1) : l.id,
            l.supplierId,
            l.qty,
            l.cost === null ? null : Math.round(l.cost * 1000),
            Math.round(l.price * 1000),
            l,
          ],
        );
      if (b.contract) {
        const ct = b.contract;
        if (!ct.html || action === "SIGN") {
          ct.html = contractHTML(
            { id: b.id, data: b },
            {
              version: ct.version,
              status: ct.status,
              data: { ...ct, html: undefined },
              document_hash: "",
            },
          );
          ct.documentHash = documentHash(ct.html);
        }
        await c.query(
          "INSERT INTO contracts(id,booking_id,version,status,document_hash,data,signed_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(booking_id,version) DO UPDATE SET status=EXCLUDED.status,document_hash=EXCLUDED.document_hash,data=EXCLUDED.data,signed_at=EXCLUDED.signed_at WHERE contracts.signed_at IS NULL",
          [
            b.id + ":v" + ct.version,
            b.id,
            ct.version,
            ct.status,
            ct.documentHash,
            ct,
            ct.signedAt || null,
          ],
        );
      }
      for (const a of b.approvals)
        await c.query(
          "INSERT INTO approvals(booking_id,actor_id,role,reason,quote_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [b.id, a.actorId, a.role, a.reason, digest(b.lines)],
        );
      await c.query(
        "INSERT INTO scheduled_reminders(booking_id,user_id,due_at,kind) VALUES($1,$2,$3,'EVENT_REMINDER') ON CONFLICT DO NOTHING",
        [
          b.id,
          b.customerId,
          new Date(
            new Date(b.occasion.date).getTime() - 86400000,
          ).toISOString(),
        ],
      );
    }
  for (const n of next.notifications)
    if (!old.notifications.some((x) => x.id === n.id) && n.userId !== "guest") {
      await c.query(
        "INSERT INTO notifications(id,user_id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [n.id, n.userId, n],
      );
      const u = next.users.find((x) => x.id === n.userId);
      if (u?.email) {
        const template = (await rows(c,
          "SELECT r.value FROM content_publications p JOIN content_revisions r ON r.id=p.revision_id WHERE p.content_key='notifications.booking.body'",
        ))[0]?.value || "{العنوان} {الرابط}";
        const message = template.replaceAll("{العنوان}",n.title).replaceAll("{الرابط}",(process.env.APP_ORIGIN || "") + n.to);
        await c.query(
          "INSERT INTO outbox(job_type,payload,dedupe_key) VALUES('EMAIL',$1,$2) ON CONFLICT DO NOTHING",
          [
            {
              to: u.email,
              subject: n.title,
              text: message,
            },
            "notification:" + n.id,
          ],
        );
      }
    }
  if (action === "READ")
    await c.query(
      "UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
      [actor.id],
    );
  for (const t of next.tickets)
    if (changed("tickets", t.id))
      await c.query(
        "INSERT INTO tickets(id,user_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
        [t.id, t.userId === "guest" ? null : t.userId, t],
      );
  const ws = {};
  for (const k of [
    "cart",
    "planner",
    "favorites",
    "activeOrder",
    "lastRemoved",
    "coupon",
    "lastPayment",
  ]) {
    const source = assisted && k !== "activeOrder" ? old : next;
    if (source[k] !== undefined) ws[k] = source[k];
  }
  await c.query(
    "INSERT INTO workspaces(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
    [wid, ws],
  );
  await c.query(
    "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)",
    [
      actor?.id || null,
      action,
      orderActions.has(action) || assisted ? "booking" : "command",
      assisted ? next.activeOrder : p.id || wid,
      old.orders.find(order => order.id === o?.id) || null,
      { payload: Object.fromEntries(Object.entries(p).map(([key,value]) => [key, typeof value === "string" && value.startsWith("data:image/") ? "image updated" : value])), status: next.orders.find((x) => x.id === p.id)?.status },
    ],
  );
  await c.query(
    "INSERT INTO command_idempotency(actor_id,key,action,request_hash,response) VALUES($1,$2,$3,$4,$5)",
    [wid, idempotencyKey, action, hash, { ok: true }],
  );
  return readState(
    c,
    action === "PROFILE" ? { ...actor, ...p } : actor,
    visitorId,
    false,null,readProjection,
  );
}
