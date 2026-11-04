import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { z } from "zod";
import { query, transaction } from "./db.mjs";
import {
  paymentProvider,
  verifyMyFatoorahSignature,
  verifyPaymentDetails,
  toMinor,
  fromMinor,
  integrationError,
} from "./providers/payments.mjs";
import { contractHTML, escapeHTML, brandSnapshot, documentBrandHTML } from "./providers/documents.mjs";
import { installmentMinors, totals } from "../src/money.mjs";
import {integrationEnvironment} from './integration-runtime.mjs';

const uuid = z.string().uuid();
const keySchema = z
  .string()
  .min(16)
  .max(160)
  .regex(/^[\w.:-]+$/);
async function currentSettings(db) {
  const row = (await db.query("SELECT data FROM app_settings WHERE id=true")).rows[0]?.data;
  return row?.settings || row;
}
const json = (value) => JSON.stringify(value);
const isAdmin = (actor) => actor && ["admin", "staff"].includes(actor.role);
function requireActor(actor) {
  if (!actor)
    throw integrationError("سجل الدخول للمتابعة", 401, "UNAUTHENTICATED");
}
function requireOwner(actor) {
  requireActor(actor);
  if (actor.role !== "admin")
    throw integrationError(
      "يتطلب الإجراء حساب المالك",
      403,
      "OWNER_REQUIRED",
    );
}
function idempotency(request) {
  return keySchema.parse(
    request.headers["idempotency-key"] || request.headers["x-idempotency-key"],
  );
}
const paymentView = (row) => ({
  id: row.id,
  orderId: row.booking_id,
  status: row.status,
  amount: Number(fromMinor(row.amount_minor)),
  currency: row.currency,
  milestone: row.milestone,
  paymentURL: row.data?.paymentURL || null,
  at: row.created_at,
  method: row.data?.method || row.provider,
  amendment: !!row.data?.amendment,
  receipt: row.data?.receipt || null,
});

async function bookingAccess(
  client,
  actor,
  bookingId,
  { supplier = false, lock = false } = {},
) {
  requireActor(actor);
  const result = await client.query(
    `SELECT * FROM bookings WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
    [bookingId],
  );
  const booking = result.rows[0];
  if (!booking) throw integrationError("الطلب غير موجود", 404);
  if (!isAdmin(actor) && booking.customer_id !== actor.id) {
    if (!supplier || actor.role !== "supplier")
      throw integrationError("غير مخول لهذا الطلب", 403);
    const owns = await client.query(
      "SELECT 1 FROM order_lines WHERE booking_id=$1 AND supplier_id=$2 LIMIT 1",
      [bookingId, actor.supplierId],
    );
    if (!owns.rowCount) throw integrationError("غير مخول لهذا الطلب", 403);
  }
  return booking;
}
async function audit(
  client,
  actor,
  action,
  type,
  id,
  before,
  after,
  ip = null,
) {
  await client.query(
    "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,before_data,after_data,ip) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      actor?.id || null,
      action,
      type,
      String(id),
      before ? json(before) : null,
      after ? json(after) : null,
      ip,
    ],
  );
}
export async function enqueue(
  client,
  jobType,
  payload,
  dedupeKey,
  availableAt = new Date(),
) {
  await client.query(
    "INSERT INTO outbox(job_type,payload,dedupe_key,available_at) VALUES($1,$2,$3,$4) ON CONFLICT(dedupe_key) DO NOTHING",
    [jobType, json(payload), dedupeKey, availableAt],
  );
}

export async function createCheckout(
  actor,
  payload,
  key,
  {
    provider = paymentProvider(),
    origin = process.env.APP_ORIGIN,
    ip = null,
  } = {},
) {
  requireActor(actor);
  if (actor.role !== "customer")
    throw integrationError("الدفع متاح لصاحب الحجز", 403);
  provider.assertConfigured({forNewPayment:true});
  let callbackOrigin;
  try {
    callbackOrigin = new URL(origin);
  } catch {
    throw integrationError("تهيئة عنوان رجوع بوابة الدفع مطلوبة");
  }
  if (
    callbackOrigin.protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(callbackOrigin.hostname)
  )
    throw integrationError("يتطلب تفعيل الدفع عنوان تطبيق HTTPS عامًا.");
  const input = z
    .object({
      bookingId: z.string().min(1).max(80),
      milestone: z.number().int().min(0).max(2).default(0),
      amendment: z.boolean().default(false),
      method: z.enum(["KNET", "CARD"]).optional(),
    })
    .strict()
    .parse(payload);
  keySchema.parse(key);
  const intent = await transaction(async (client) => {
    const booking = await bookingAccess(client, actor, input.bookingId, {
      lock: true,
    });
    const previous = await client.query(
      "SELECT * FROM payments WHERE idempotency_key=$1",
      [`${actor.id}:${key}`],
    );
    if (previous.rowCount) {
      const old = previous.rows[0];
      if (
        old.booking_id !== input.bookingId ||
        old.milestone !== input.milestone ||
        !!old.data?.amendment !== input.amendment ||
        old.data?.method !== (input.method || "HOSTED")
      )
        throw integrationError("مفتاح العملية استُخدم لطلب مختلف", 409);
      return { row: old, replay: true };
    }
    const b = booking.data,
      c = b.contract;
    if (c?.status !== "SIGNED")
      throw integrationError("يلزم توقيع العقد قبل الدفع", 409);
    if (["CANCELLED", "EXPIRED", "DISPUTED"].includes(booking.status))
      throw integrationError("حالة الحجز لا تسمح بالدفع", 409);
    const all = await client.query(
      "SELECT * FROM payments WHERE booking_id=$1 FOR UPDATE",
      [booking.id],
    );
    const matchesAmendment = p => !input.amendment ||
      !p.data?.amendmentId || p.data.amendmentId === b.amendment?.id;
    // A failed transaction does not prove that the hosted invoice was cancelled.
    // Reuse its URL: opening another invoice could permit two physical charges.
    const failedInvoice = all.rows.find(p => p.milestone === input.milestone &&
      !!p.data?.amendment === input.amendment && matchesAmendment(p) && p.status === "FAILED");
    if (failedInvoice) {
      if (!failedInvoice.data?.paymentURL)
        throw integrationError("يلزم التحقق من فاتورة المزود السابقة قبل إعادة المحاولة", 409);
      return { row: failedInvoice, replay: true };
    }
    if (
      all.rows.some(
        (p) =>
          p.milestone === input.milestone &&
          !!p.data?.amendment === input.amendment &&
          matchesAmendment(p) &&
          ["CREATED", "PENDING", "PAID", "REFUND_PENDING"].includes(p.status),
      )
    )
      throw integrationError("هذه الدفعة مسددة أو توجد عملية قيد التحقق", 409);
    if (input.amendment && b.amendment?.status !== "SIGNED")
      throw integrationError("يلزم توقيع الملحق", 409);
    const percentages = c.paymentSchedule;
    if (
      !Array.isArray(percentages) ||
      percentages.length !== 3 ||
      percentages.some((n) => !Number.isFinite(n) || n < 0) ||
      percentages.reduce((a, v) => a + v, 0) !== 100
    )
      throw integrationError("جدول الدفعات غير صالح؛ راجع الإدارة", 409);
    if (input.milestone > 0 && !input.amendment) {
      if (
        !all.rows.some(
          (p) =>
            p.milestone === input.milestone - 1 &&
            p.status === "PAID" &&
            !p.data?.amendment,
        )
      )
        throw integrationError("يجب سداد الدفعة السابقة أولًا", 409);
      const due =
        new Date(booking.occasion_date).getTime() -
        (input.milestone === 1 ? 30 : 7) * 86400000;
      const settingData =
        (await client.query("SELECT data FROM app_settings WHERE id=true"))
          .rows[0]?.data || {};
      const settings = settingData.settings || settingData;
      if (!settings.earlyPayment && Date.now() < due)
        throw integrationError("الدفعة غير مستحقة بعد", 409);
    }
    if (input.milestone === 0 && !input.amendment) {
      const holds = await client.query(
        "SELECT * FROM reservations WHERE booking_id=$1 AND status IN ('HELD','CONFIRMED') AND (status='CONFIRMED' OR expires_at>now())",
        [booking.id],
      );
      if (holds.rowCount < new Set((b.lines || []).map((l) => l.id.split(":").at(-1))).size)
        throw integrationError(
          "انتهت مهلة حجز التوفر. يرجى مراجعة الإدارة لإعادة تأكيد التوفر قبل الدفع.",
          409,
          "AVAILABILITY_HOLD_EXPIRED",
        );
    }
    let amountMinor;
    if (input.amendment)
      amountMinor = toMinor(b.amendment.financials?.total ?? totals(b.amendment.lines || []).total);
    else {
      amountMinor = installmentMinors(c.total, percentages)[input.milestone];
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
      throw integrationError("مبلغ الدفعة غير صالح", 400);
    const id = randomUUID(),
      data = {
        amendment: input.amendment,
        ...(input.amendment ? {amendmentId:b.amendment.id} : {}),
        method: input.method || "HOSTED",
        requestStartedAt: new Date().toISOString(),
      };
    const row = (
      await client.query(
        "INSERT INTO payments(id,booking_id,user_id,provider,amount_minor,milestone,status,data,idempotency_key) VALUES($1,$2,$3,'myfatoorah',$4,$5,'CREATED',$6,$7) RETURNING *",
        [
          id,
          booking.id,
          actor.id,
          amountMinor,
          input.milestone,
          json(data),
          `${actor.id}:${key}`,
        ],
      )
    ).rows[0];
    await audit(
      client,
      actor,
      "PAYMENT_INTENT_CREATED",
      "payment",
      id,
      null,
      { bookingId: booking.id, amountMinor },
      ip,
    );
    await enqueue(
      client,
      "PAYMENT_INTENT_RECONCILE",
      { paymentId: id },
      `intent-reconcile:${id}`,
      new Date(Date.now() + 60000),
    );
    return { row, replay: false };
  });
  if (intent.replay) return paymentView(intent.row);
  const row = intent.row;
  try {
    const result = await provider.createCheckout({
      id: row.id,
      amountMinor: Number(row.amount_minor),
      method: input.method,
      returnURL: new URL(`/payment-result?paymentRecord=${row.id}`, origin)
        .href,
    });
    const updated = await transaction(async (client) => {
      const p = (
        await client.query(
          "UPDATE payments SET provider_reference=$2,status='PENDING',data=data||$3::jsonb,updated_at=now() WHERE id=$1 RETURNING *",
          [row.id, result.invoiceId, json({ paymentURL: result.paymentURL })],
        )
      ).rows[0];
      await client.query(
        "UPDATE bookings SET status=CASE WHEN COALESCE((data->>'paid')::numeric,0)=0 THEN 'PAYMENT_PENDING' ELSE status END,data=jsonb_set(data,'{status}',to_jsonb(CASE WHEN COALESCE((data->>'paid')::numeric,0)=0 THEN 'PAYMENT_PENDING'::text ELSE status END)),updated_at=now(),version=version+1 WHERE id=$1",
        [row.booking_id],
      );
      await client.query(
        "INSERT INTO workspaces(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=workspaces.data||EXCLUDED.data",
        [actor.id, json({ lastPayment: row.id, activeOrder: row.booking_id })],
      );
      return p;
    });
    return paymentView(updated);
  } catch (error) {
    await query(
      "UPDATE payments SET data=data||$2::jsonb,updated_at=now() WHERE id=$1",
      [row.id, json({ creationUncertain: true })],
    );
    throw error;
  }
}

export async function settlePayment(client, payment, details) {
  const status = verifyPaymentDetails(payment, details);
  // A later failed transaction cannot undo a successful invoice.
  if (["PAID", "REFUNDED", "REFUND_PENDING"].includes(payment.status))
    return payment;
  const booking = (
    await client.query("SELECT * FROM bookings WHERE id=$1 FOR UPDATE", [
      payment.booking_id,
    ])
  ).rows[0];
  const at = new Date().toISOString(),
    data = {
      ...payment.data,
      verifiedAt: at,
      providerPaymentId: String(details.Transaction.PaymentId),
      receipt: `RC-${payment.id}`,
    };
  await client.query(
    "UPDATE payments SET status=$2,data=$3,updated_at=now() WHERE id=$1",
    [payment.id, status, json(data)],
  );
  const b = booking.data;
  if (status === "PAID") {
    const holds = await client.query(
      "SELECT 1 FROM reservations WHERE booking_id=$1 AND status='RELEASED' LIMIT 1",
      [booking.id],
    );
    if (holds.rowCount || ["CANCELLED", "EXPIRED"].includes(booking.status)) {
      // Money received after cancellation must remain visible, never silently confirm unavailable stock.
      b.paymentReviewRequired = true;
      await enqueue(
        client,
        "PAYMENT_REVIEW",
        { bookingId: booking.id, paymentId: payment.id },
        `payment-review:${payment.id}`,
      );
    } else {
      if (data.amendment) {
        b.amendment = {
          ...b.amendment,
          paid: Number(fromMinor(payment.amount_minor)),
          status: "CONFIRMED",
        };
      } else {
        b.paid = Number(
          fromMinor(toMinor(b.paid || 0) + Number(payment.amount_minor)),
        );
        if (
          !["PREPARATION", "IN_PROGRESS", "COMPLETED"].includes(booking.status)
        )
          b.status = "CONFIRMED";
      }
      await client.query(
        "UPDATE reservations SET status='CONFIRMED',expires_at=NULL WHERE booking_id=$1 AND status='HELD'",
        [booking.id],
      );
    }
    const notification = {
      id: randomUUID(),
      title: "تم تأكيد الدفعة",
      text: `تم استلام ${fromMinor(payment.amount_minor)} د.ك`,
      link: `/bookings/${booking.id}`,
      at,
      read: false,
    };
    await client.query(
      "INSERT INTO notifications(id,user_id,data) VALUES($1,$2,$3)",
      [notification.id, booking.customer_id, json(notification)],
    );
    const user = (
      await client.query("SELECT email FROM users WHERE id=$1", [
        booking.customer_id,
      ])
    ).rows[0];
    await enqueue(
      client,
      "EMAIL",
      {
        to: user.email,
        subject: ["إيصال دفعة", brandSnapshot(await currentSettings(client)).title].filter(Boolean).join(" — "),
        text: `تأكدت دفعتك ${fromMinor(payment.amount_minor)} د.ك. رقم العملية ${payment.id}. تابع التفاصيل من حسابك.`,
      },
      `receipt:${payment.id}`,
    );
  } else if (status === "FAILED" && !(b.paid > 0)) b.status = "PAYMENT_FAILED";
  b.timeline = [
    ...(b.timeline || []),
    {
      status:
        status === "PAID"
          ? "تم التحقق من الدفعة لدى البوابة"
          : status === "FAILED"
            ? "تعذر الدفع"
            : "بانتظار تأكيد الدفع",
      at,
    },
  ];
  await client.query(
    "UPDATE bookings SET status=$2,data=$3,version=version+1,updated_at=now() WHERE id=$1",
    [booking.id, b.status || booking.status, json(b)],
  );
  await audit(
    client,
    null,
    "PAYMENT_PROVIDER_VERIFIED",
    "payment",
    payment.id,
    { status: payment.status },
    { status, amountMinor: Number(payment.amount_minor) },
  );
  return { ...payment, status, data };
}

export function detectMime(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    buffer.length >= 3 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  )
    return "image/jpeg";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function registerIntegrationRoutes(app) {
  const db = app.db || { query, transaction };
  const transact = db.transaction || transaction;
  const authed = { preHandler: app.authenticate };
  app.post("/api/payments/:id/refresh", authed, async (request) => {
    const id = uuid.parse(request.params.id),
      key = idempotency(request);
    paymentProvider().assertConfigured();
    return transact(async (client) => {
      const pay = (
        await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!pay || (!isAdmin(request.actor) && pay.user_id !== request.actor.id))
        throw integrationError("الدفعة غير موجودة", 404);
      if (["CREATED", "PENDING"].includes(pay.status))
        await enqueue(
          client,
          "PAYMENT_INTENT_RECONCILE",
          { paymentId: id },
          "refresh:" + id + ":" + key,
        );
      await audit(
        client,
        request.actor,
        "PAYMENT_RECONCILIATION_REQUESTED",
        "payment",
        id,
        null,
        { status: pay.status },
        request.ip,
      );
      return {
        queued: ["CREATED", "PENDING"].includes(pay.status),
        status: pay.status,
      };
    });
  });
  app.get("/api/documents/quote/:id", authed, async (request, reply) => {
    const b = await bookingAccess(db, request.actor, request.params.id);
    if (!b.data.quoteSnapshot && !b.data.contract)
      throw integrationError("العرض لم يعتمد بعد", 409);
    const data = b.data.contract || {
      snapshot: b.data.quoteSnapshot,
      total: b.data.financials?.total,
      status: b.status,
      clauses: "عرض سعر معتمد؛ يحفظ العقد وشروطه في وثيقة مستقلة",
    };
    return reply
      .header("Cache-Control", "private,no-store")
      .header("Content-Disposition", 'attachment; filename="quotation.html"')
      .header(
        "Content-Security-Policy",
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'",
      )
      .type("text/html; charset=utf-8")
      .send(contractHTML(b, { version: b.version, status: b.status, data }, await currentSettings(db)));
  });
  app.get("/api/documents/receipt/:id", authed, async (request, reply) => {
    const pay = (
      await db.query("SELECT * FROM payments WHERE id=$1", [
        uuid.parse(request.params.id),
      ])
    ).rows[0];
    if (!pay || (!isAdmin(request.actor) && pay.user_id !== request.actor.id))
      throw integrationError("الإيصال غير موجود", 404);
    if (!["PAID", "REFUNDED", "REFUND_PENDING"].includes(pay.status))
      throw integrationError("لا يصدر إيصال تحصيل قبل التحقق من الدفع", 409);
    const rows = [
      ["رقم العملية", pay.id],
      ["مرجع بوابة الدفع", pay.provider_reference],
      ["رقم الحجز", pay.booking_id],
      ["المبلغ د.ك", fromMinor(pay.amount_minor)],
      ["حالة الدفعة", pay.status],
      ["المسترد د.ك", pay.data.refunded || 0],
      ["التاريخ", pay.created_at],
    ];
    const row = (await db.query("SELECT data FROM app_settings WHERE id=true")).rows[0]?.data;
    const identity = brandSnapshot(row?.settings || row);
    const html =
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>إيصال دفع</title>' +
      documentBrandHTML(identity) + '<h1>' + escapeHTML([identity.title, "إيصال دفع موثّق"].filter(Boolean).join(" — ")) + '</h1>' +
      rows
        .map(([k, v]) => "<p>" + escapeHTML(k) + ": " + escapeHTML(v) + "</p>")
        .join("") +
      "</html>";
    return reply
      .header("Cache-Control", "private,no-store")
      .header("Content-Disposition", 'attachment; filename="receipt.html"')
      .header(
        "Content-Security-Policy",
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'",
      )
      .type("text/html; charset=utf-8")
      .send(html);
  });
  app.post("/api/payments/checkout", authed, async (request) =>
    createCheckout(request.actor, request.body, idempotency(request), {
      origin: app.config?.appOrigin || process.env.APP_ORIGIN,
      ip: request.ip,
    }),
  );
  app.get("/api/payments/:id", authed, async (request) => {
    const p = (
      await db.query("SELECT * FROM payments WHERE id=$1", [
        uuid.parse(request.params.id),
      ])
    ).rows[0];
    if (!p || (!isAdmin(request.actor) && p.user_id !== request.actor.id))
      throw integrationError("العملية غير موجودة", 404);
    return paymentView(p);
  });
  app.post("/api/payments/:id/reconcile", authed, async (request) => {
    const id = uuid.parse(request.params.id),
      input = z
        .object({ paymentId: z.string().regex(/^\d{5,80}$/) })
        .strict()
        .parse(request.body);
    const p = (await db.query("SELECT * FROM payments WHERE id=$1", [id]))
      .rows[0];
    if (!p || (!isAdmin(request.actor) && p.user_id !== request.actor.id))
      throw integrationError("العملية غير موجودة", 404);
    const details = await paymentProvider().getPayment(input.paymentId);
    return transact(async (client) => {
      const locked = (
        await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      return paymentView(await settlePayment(client, locked, details));
    });
  });
  app.post("/api/payments/:id/refunds", authed, async (request) => {
    requireOwner(request.actor);
    const id = uuid.parse(request.params.id),
      input = z
        .object({
          amount: z.union([z.number().positive(), z.string()]),
          reason: z.string().trim().min(3).max(1000),
        })
        .strict()
        .parse(request.body),
      amount = toMinor(input.amount),
      key = `refund:${request.actor.id}:${idempotency(request)}`;
    paymentProvider().assertConfigured();
    return transact(async (client) => {
      const pay = (
        await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!pay || pay.status !== "PAID")
        throw integrationError("العملية غير قابلة للاسترداد", 409);
      const prior = (
        await client.query("SELECT * FROM refunds WHERE idempotency_key=$1", [
          key,
        ])
      ).rows[0];
      if (prior) {
        if (prior.payment_id !== id || Number(prior.amount_minor) !== amount)
          throw integrationError("مفتاح مكرر لطلب مختلف", 409);
        return prior;
      }
      const allocated = (
        await client.query(
          "SELECT COALESCE(sum(amount_minor),0) AS total FROM refunds WHERE payment_id=$1 AND status IN ('PENDING','PROCESSING','COMPLETED')",
          [id],
        )
      ).rows[0];
      if (
        amount <= 0 ||
        amount + Number(allocated.total) > Number(pay.amount_minor)
      )
        throw integrationError("مبلغ الاسترداد يتجاوز المتاح", 409);
      const refund = (
        await client.query(
          "INSERT INTO refunds(payment_id,amount_minor,status,idempotency_key) VALUES($1,$2,'PENDING',$3) RETURNING *",
          [id, amount, key],
        )
      ).rows[0];
      await enqueue(
        client,
        "REFUND_REQUEST",
        { refundId: refund.id, reason: input.reason },
        `refund:${refund.id}`,
      );
      await audit(
        client,
        request.actor,
        "REFUND_REQUESTED",
        "refund",
        refund.id,
        null,
        { paymentId: id, amountMinor: amount, reason: input.reason },
        request.ip,
      );
      return { id: refund.id, status: refund.status };
    });
  });
  app.post(
    "/api/webhooks/myfatoorah",
    { config: { csrf: false }, bodyLimit: 262144 },
    async (request, reply) => {
      const body = request.body;
      if (
        !verifyMyFatoorahSignature(
          body,
          request.headers["myfatoorah-signature"],
          integrationEnvironment().MYFATOORAH_WEBHOOK_SECRET,
        )
      )
        throw integrationError(
          "Invalid webhook signature",
          401,
          "INVALID_WEBHOOK_SIGNATURE",
        );
      const reference = z.string().min(1).max(160).parse(body.Event.Reference);
      // Store only canonical business fields; discard any provider card data.
      const event = {
        Event: { Name: body.Event.Name, Reference: reference },
        Data:
          body.Event.Name === "PAYMENT_STATUS_CHANGED"
            ? {
                Invoice: {
                  Id: String(body.Data.Invoice.Id),
                  ExternalIdentifier: String(
                    body.Data.Invoice.ExternalIdentifier,
                  ),
                },
                Transaction: {
                  PaymentId: String(body.Data.Transaction.PaymentId),
                },
              }
            : {
                Refund: {
                  Id: String(body.Data.Refund.Id),
                  Status: body.Data.Refund.Status,
                },
                Amount: {
                  BaseCurrency: body.Data.Amount?.BaseCurrency,
                  ValueInBaseCurrency: body.Data.Amount?.ValueInBaseCurrency,
                },
                ReferencedInvoice: {
                  Id: String(body.Data.ReferencedInvoice.Id),
                },
              },
      };
      await transact(async (client) => {
        const saved = await client.query(
          "INSERT INTO webhook_events(provider,event_id,payload) VALUES('myfatoorah',$1,$2) ON CONFLICT DO NOTHING RETURNING event_id",
          [reference, json(event)],
        );
        if (saved.rowCount)
          await enqueue(
            client,
            "PAYMENT_WEBHOOK",
            { eventId: reference },
            `webhook:myfatoorah:${reference}`,
          );
      });
      return reply.code(202).send({ received: true });
    },
  );
  app.post("/api/files", authed, async (request) => {
    const bookingId = z
      .string()
      .max(80)
      .optional()
      .parse(request.query?.bookingId);
    if (bookingId)
      await bookingAccess(db, request.actor, bookingId, { supplier: true });
    const part = await request.file({
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
    });
    if (!part) throw integrationError("اختر ملفًا", 400);
    const buffer = await part.toBuffer();
    if (part.file.truncated || !buffer.length)
      throw integrationError("حجم الملف غير صالح", 400);
    const mime = detectMime(buffer);
    if (!mime || mime !== part.mimetype)
      throw integrationError(
        "الملفات المسموحة PDF أو PNG أو JPEG أو WebP فقط",
        415,
      );
    const root = resolve(
        process.env.STORAGE_DIR || process.env.UPLOAD_DIR || "./data/uploads",
      ),
      id = randomUUID(),
      storageKey = `${id}.bin`,
      path = resolve(root, storageKey);
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(path, buffer, { flag: "wx", mode: 0o600 });
    try {
      await transact(async (client) => {
        await client.query(
          "INSERT INTO files(id,owner_id,booking_id,storage_key,filename,mime,size,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            request.actor.id,
            bookingId || null,
            storageKey,
            basename(part.filename)
              .replace(/[\r\n\0]/g, "")
              .slice(0, 200),
            mime,
            buffer.length,
            createHash("sha256").update(buffer).digest("hex"),
          ],
        );
        if (bookingId) {
          const b = await bookingAccess(client, request.actor, bookingId, {
            supplier: true,
            lock: true,
          });
          b.data.attachments = [
            ...(b.data.attachments || []),
            {
              id,
              name: basename(part.filename).slice(0, 200),
              url: `/api/files/${id}`,
              at: new Date().toISOString(),
            },
          ];
          await client.query(
            "UPDATE bookings SET data=$2,updated_at=now(),version=version+1 WHERE id=$1",
            [bookingId, json(b.data)],
          );
        }
        await audit(
          client,
          request.actor,
          "FILE_UPLOADED",
          "file",
          id,
          null,
          { bookingId, mime, size: buffer.length },
          request.ip,
        );
      });
    } catch (error) {
      await unlink(path);
      throw error;
    }
    return { id, url: `/api/files/${id}`, name: basename(part.filename) };
  });
  app.get("/api/files/:id", authed, async (request, reply) => {
    const f = (
      await db.query("SELECT * FROM files WHERE id=$1", [
        uuid.parse(request.params.id),
      ])
    ).rows[0];
    if (!f) throw integrationError("الملف غير موجود", 404);
    if (f.owner_id !== request.actor.id && !isAdmin(request.actor))
      throw integrationError("غير مخول لهذا المستند الخاص", 403);
    const root = resolve(
        process.env.STORAGE_DIR || process.env.UPLOAD_DIR || "./data/uploads",
      ),
      path = resolve(root, f.storage_key);
    if (!path.startsWith(root + (process.platform === "win32" ? "\\" : "/")))
      throw integrationError("مسار غير صالح", 400);
    const buffer = await readFile(path).catch(() => {
      throw integrationError("الملف غير متاح؛ راجع الدعم", 404);
    });
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header(
        "Content-Disposition",
        `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      )
      .type(f.mime)
      .send(buffer);
  });
  app.get("/api/contracts/:bookingId", authed, async (request, reply) => {
    const b = await bookingAccess(db, request.actor, request.params.bookingId);
    const version = request.query.version
      ? z.coerce.number().int().min(1).parse(request.query.version)
      : null;
    const c = (
      await db.query(
        "SELECT * FROM contracts WHERE booking_id=$1 AND ($2::integer IS NULL OR version=$2) ORDER BY version DESC LIMIT 1",
        [b.id, version],
      )
    ).rows[0];
    if (!c) throw integrationError("العقد غير جاهز", 404);
    if(c.data.externalSignature?.fileId)return reply.redirect('/api/files/'+c.data.externalSignature.fileId);
    // Render the frozen version, never the mutable catalog.
    const html = c.data.html || contractHTML(b, c);
    return reply
      .header("Cache-Control", "private, no-store")
      .header(
        "Content-Security-Policy",
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'",
      )
      .header(
        "Content-Disposition",
        `attachment; filename="contract-${encodeURIComponent(b.id)}-v${c.version}.html"`,
      )
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
