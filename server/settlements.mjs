import { randomUUID } from "node:crypto";
import { z } from "zod";
import { integrationError } from "./providers/payments.mjs";
import {
  SupplierPayoutBridge,
  verifyPayoutWebhook,
} from "./providers/supplier-payouts.mjs";
import { enqueue } from "./integrations.mjs";
import {integrationEnvironment} from './integration-runtime.mjs';

const keyInput = z.string().min(16).max(150),
  idInput = z.string().uuid();
function operator(actor, owner = false) {
  if (
    !actor ||
    !["staff", "admin"].includes(actor.role) ||
    (owner && actor.role !== "admin")
  )
    throw integrationError(
      "يتطلب الإجراء حسابًا إداريًا مخولًا",
      403,
    );
}
const audit = (c, actor, action, id, data) =>
  c.query(
    "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,$2,'supplier_settlement',$3,$4)",
    [actor?.id || null, action, id, data],
  );
const view = (r) => ({ ...r, amount: Number(r.amount_minor) / 1000 });
export async function eligibleSettlements(c) {
  return (
    await c.query(`SELECT b.id AS booking_id,v.id AS supplier_id,v.name AS supplier_name,
    v.data->>'payoutRecipientId' AS recipient_ref,
    sum(l.cost_minor*l.qty)-COALESCE((SELECT sum(s.amount_minor) FROM supplier_settlements s
      WHERE s.booking_id=b.id AND s.supplier_id=v.id AND s.status NOT IN ('FAILED','CANCELLED')),0) AS remaining_minor
    FROM bookings b JOIN order_lines l ON l.booking_id=b.id JOIN suppliers v ON v.id=l.supplier_id
    WHERE b.status='COMPLETED' AND b.data->'contract'->>'status'='SIGNED' AND l.cost_minor IS NOT NULL
    GROUP BY b.id,v.id HAVING sum(l.cost_minor*l.qty)>COALESCE((SELECT sum(s.amount_minor) FROM supplier_settlements s
      WHERE s.booking_id=b.id AND s.supplier_id=v.id AND s.status NOT IN ('FAILED','CANCELLED')),0)
    ORDER BY b.created_at DESC,b.id,v.id LIMIT 100`)
  ).rows;
}
export async function requestSettlement(db, actor, input, key) {
  operator(actor);
  keyInput.parse(key);
  const p = z
    .object({
      bookingId: z.string().min(1).max(150),
      supplierId: z.string().min(1).max(150),
    })
    .strict()
    .parse(input);
  return db.transaction(async (c) => {
    const b = (
      await c.query("SELECT * FROM bookings WHERE id=$1 FOR UPDATE", [
        p.bookingId,
      ])
    ).rows[0];
    if (!b || b.status !== "COMPLETED" || b.data.contract?.status !== "SIGNED")
      throw integrationError("يلزم طلب مكتمل وعقد موقع", 409);
    const previous = (
      await c.query(
        "SELECT * FROM supplier_settlements WHERE idempotency_key=$1",
        [actor.id + ":" + key],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.booking_id !== p.bookingId ||
        previous.supplier_id !== p.supplierId
      )
        throw integrationError("مفتاح العملية مستخدم لطلب مختلف", 409);
      return view(previous);
    }
    const supplier = (
      await c.query("SELECT * FROM suppliers WHERE id=$1 FOR SHARE", [
        p.supplierId,
      ])
    ).rows[0];
    const recipient = z
      .string()
      .trim()
      .min(3)
      .max(160)
      .safeParse(supplier?.data?.payoutRecipientId);
    if (!recipient.success)
      throw integrationError(
        "أدخل مرجع مستفيد جهة التحويل في ملف المورد أولًا",
        409,
      );
    const lines = (
      await c.query(
        "SELECT id,qty,cost_minor,data FROM order_lines WHERE booking_id=$1 AND supplier_id=$2 ORDER BY id FOR UPDATE",
        [p.bookingId, p.supplierId],
      )
    ).rows;
    if (!lines.length || lines.some((l) => l.cost_minor === null))
      throw integrationError("تكاليف المورد غير مكتملة", 409);
    const cost = lines.reduce(
      (sum, l) => sum + Number(l.cost_minor) * l.qty,
      0,
    );
    const allocated = Number(
      (
        await c.query(
          "SELECT COALESCE(sum(amount_minor),0) AS n FROM supplier_settlements WHERE booking_id=$1 AND supplier_id=$2 AND status NOT IN ('FAILED','CANCELLED')",
          [p.bookingId, p.supplierId],
        )
      ).rows[0].n,
    );
    const amount = cost - allocated;
    if (
      !Number.isSafeInteger(cost) ||
      !Number.isSafeInteger(allocated) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    )
      throw integrationError("لا يوجد رصيد مستحق صالح غير محجوز للتسوية", 409);
    const row = (
      await c.query(
        `INSERT INTO supplier_settlements(booking_id,supplier_id,amount_minor,recipient_ref,status,requested_by,idempotency_key,snapshot)
      VALUES($1,$2,$3,$4,'IN_REVIEW',$5,$6,$7) RETURNING *`,
        [
          p.bookingId,
          p.supplierId,
          amount,
          recipient.data,
          actor.id,
          actor.id + ":" + key,
          {
            supplierName: supplier.name,
            lines: lines.map((l) => ({
              id: l.id,
              title: l.data.title,
              qty: l.qty,
              costMinor: Number(l.cost_minor),
            })),
            totalCostMinor: cost,
            allocatedMinor: allocated,
          },
        ],
      )
    ).rows[0];
    await audit(c, actor, "SUPPLIER_SETTLEMENT_REQUESTED", row.id, {
      amountMinor: amount,
      recipientRef: row.recipient_ref,
    });
    return view(row);
  });
}
export async function approveSettlement(db, actor, id, reason) {
  operator(actor);
  idInput.parse(id);
  z.string().trim().min(3).max(1000).parse(reason);
  return db.transaction(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM supplier_settlements WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw integrationError("التسوية غير موجودة", 404);
    const approvals = (
      await c.query(
        "SELECT * FROM supplier_settlement_approvals WHERE settlement_id=$1",
        [id],
      )
    ).rows;
    const previous = approvals.find(
      (a) => a.actor_id === actor.id && a.role === actor.role,
    );
    if (previous?.reason === reason) return { status: row.status };
    if (row.status !== "IN_REVIEW")
      throw integrationError("التسوية ليست بانتظار المراجعة", 409);
    if (approvals.some((a) => a.actor_id === actor.id || a.role === actor.role))
      throw integrationError("يلزم اعتماد مستقل لكل من الموظف والمالك", 409);
    await c.query(
      "INSERT INTO supplier_settlement_approvals(settlement_id,actor_id,role,reason) VALUES($1,$2,$3,$4)",
      [id, actor.id, actor.role, reason],
    );
    if (approvals.length === 1)
      await c.query(
        "UPDATE supplier_settlements SET status='APPROVED',updated_at=now() WHERE id=$1",
        [id],
      );
    await audit(c, actor, "SUPPLIER_SETTLEMENT_APPROVED", id, {
      role: actor.role,
      reason,
    });
    return { status: approvals.length === 1 ? "APPROVED" : "IN_REVIEW" };
  });
}
export async function submitSettlement(
  db,
  actor,
  id,
  provider = new SupplierPayoutBridge(),
) {
  operator(actor, true);
  idInput.parse(id);
  provider.assertConfigured({forNewTransfer:true});
  return db.transaction(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM supplier_settlements WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw integrationError("التسوية غير موجودة", 404);
    if (["SUBMITTING", "PENDING", "SETTLED"].includes(row.status))
      return { status: row.status };
    if (row.status !== "APPROVED")
      throw integrationError("يلزم اكتمال الموافقتين", 409);
    await c.query(
      "UPDATE supplier_settlements SET status='SUBMITTING',updated_at=now() WHERE id=$1",
      [id],
    );
    await enqueue(
      c,
      "SUPPLIER_PAYOUT_SUBMIT",
      { settlementId: id },
      "supplier-payout-submit:" + id,
    );
    await audit(c, actor, "SUPPLIER_SETTLEMENT_SUBMISSION_REQUESTED", id, {});
    return { status: "SUBMITTING" };
  });
}
export async function reconcileSettlement(
  db,
  id,
  provider = new SupplierPayoutBridge(),
) {
  const details = z
    .object({
      id: z.string().min(1).max(160),
      externalId: z.string().uuid(),
      recipientRef: z.string(),
      amountMinor: z.number().int().positive().safe(),
      currency: z.literal("KWD"),
      status: z.enum(["PROCESSING", "SUCCEEDED", "FAILED"]),
    })
    .parse(await provider.lookup(id));
  return db.transaction(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM supplier_settlements WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (
      !row ||
      row.id !== details.externalId ||
      row.recipient_ref !== details.recipientRef ||
      Number(row.amount_minor) !== details.amountMinor ||
      (row.provider_ref && row.provider_ref !== details.id)
    )
      throw integrationError(
        "بيانات التحويل لا تطابق التسوية؛ يلزم التحقيق",
        409,
        "PAYOUT_MISMATCH",
      );
    if (
      row.status === "CANCELLED" ||
      (row.status === "FAILED" && details.status !== "FAILED") ||
      (row.status === "SETTLED" && details.status === "FAILED")
    )
      throw integrationError(
        "جهة التحويل أعادت حالة تناقض دليلًا نهائيًا؛ يلزم التحقيق",
        409,
        "PAYOUT_MISMATCH",
      );
    if (["SETTLED", "FAILED"].includes(row.status)) return view(row);
    if (!["SUBMITTING", "PENDING"].includes(row.status))
      throw integrationError(
        "حالة التسوية لا تسمح بربط تحويل",
        409,
        "PAYOUT_MISMATCH",
      );
    const status = {
      PROCESSING: "PENDING",
      SUCCEEDED: "SETTLED",
      FAILED: "FAILED",
    }[details.status];
    const updated = (
      await c.query(
        "UPDATE supplier_settlements SET status=$2,provider_ref=$3,settled_at=CASE WHEN $2='SETTLED' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING *",
        [id, status, details.id],
      )
    ).rows[0];
    await audit(c, null, "SUPPLIER_PAYOUT_VERIFIED", id, {
      status,
      providerRef: details.id,
    });
    if (["SETTLED", "FAILED"].includes(status)) {
      const recipients = (
        await c.query(
          "SELECT id,email,role FROM users WHERE active=true AND ((role='supplier' AND supplier_id=$1) OR ($2='FAILED' AND role IN ('admin','staff')))",
          [row.supplier_id, status],
        )
      ).rows;
      for (const user of recipients) {
        const title =
          status === "SETTLED"
            ? "تم التحقق من تحويل مستحقاتك"
            : "تعذر تحويل مستحقات المورد نهائيًا";
        const to =
          user.role === "supplier"
            ? "/supplier/settlements"
            : "/admin/settlements";
        const amount = BigInt(row.amount_minor),
          text = `${title}. رقم التسوية ${id}. المبلغ ${amount / 1000n}.${String(amount % 1000n).padStart(3, "0")} KWD`;
        await c.query(
          "INSERT INTO notifications(id,user_id,data) VALUES($1,$2,$3)",
          [
            randomUUID(),
            user.id,
            { title, text, to, at: new Date().toISOString() },
          ],
        );
        await enqueue(
          c,
          "EMAIL",
          { to: user.email, subject: title, text },
          "supplier-settlement-email:" + id + ":" + status + ":" + user.id,
        );
      }
    }
    if (status === "PENDING")
      await enqueue(
        c,
        "SUPPLIER_PAYOUT_RECONCILE",
        { settlementId: id },
        "supplier-payout-check:" + id + ":" + Math.floor(Date.now() / 60000),
        new Date(Date.now() + 60000),
      );
    return view(updated);
  });
}
export async function executeSupplierPayout(
  db,
  id,
  provider = new SupplierPayoutBridge(),
) {
  provider.assertConfigured();
  const attempt = await db.transaction(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM supplier_settlements WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row || !["SUBMITTING", "PENDING"].includes(row.status)) return null;
    if (row.submission_started_at) return { row, first: false };
    provider.assertConfigured({forNewTransfer:true});
    await c.query(
      "UPDATE supplier_settlements SET submission_started_at=now() WHERE id=$1",
      [id],
    );
    return { row, first: true };
  });
  if (!attempt) return;
  // Persist the attempt before calling a money-moving external endpoint.
  // A crashed/uncertain attempt is only looked up, never blindly repeated.
  if (attempt.first) await provider.create(attempt.row);
  return reconcileSettlement(db, id, provider);
}
export async function registerSettlementRoutes(app) {
  const db = app.db,
    auth = { preHandler: app.authenticate };
  app.get("/api/settlements", auth, async (req) => {
    if (!["admin", "staff", "supplier"].includes(req.actor.role))
      throw integrationError("غير مخول", 403);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .default(1)
      .parse(req.query.page);
    const supplier =
      req.actor.role === "supplier" ? req.actor.supplierId : null;
    const result = await db.query(
      `SELECT s.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('role',a.role,'reason',a.reason,'actorId',a.actor_id)) FROM supplier_settlement_approvals a WHERE a.settlement_id=s.id),'[]') AS approvals
      FROM supplier_settlements s WHERE ($1::text IS NULL OR s.supplier_id=$1) ORDER BY s.created_at DESC,s.id LIMIT 25 OFFSET $2`,
      [supplier, (page - 1) * 25],
    );
    let configured = true;
    try {
      new SupplierPayoutBridge().assertConfigured();
    } catch {
      configured = false;
    }
    const totals = (
      await db.query(
        `SELECT COALESCE(sum(amount_minor) FILTER(WHERE status='SETTLED'),0) AS settled_minor,
      COALESCE(sum(amount_minor) FILTER(WHERE status IN ('IN_REVIEW','APPROVED','SUBMITTING','PENDING')),0) AS reserved_minor
      FROM supplier_settlements WHERE ($1::text IS NULL OR supplier_id=$1)`,
        [supplier],
      )
    ).rows[0];
    return {
      items: result.rows.map((r) => {
        const { idempotency_key, requested_by, ...safe } = view(r);
        if (req.actor.role === "supplier") safe.approvals = [];
        return safe;
      }),
      page,
      hasMore: result.rows.length === 25,
      configured,
      totals,
    };
  });
  app.get("/api/settlements/eligible", auth, async (req) => {
    operator(req.actor);
    return { items: await eligibleSettlements(db) };
  });
  app.post("/api/settlements", auth, (req) =>
    requestSettlement(db, req.actor, req.body, req.headers["idempotency-key"]),
  );
  app.post("/api/settlements/:id/approve", auth, (req) =>
    approveSettlement(db, req.actor, req.params.id, req.body?.reason),
  );
  app.post("/api/settlements/:id/submit", auth, (req) =>
    submitSettlement(db, req.actor, req.params.id),
  );
  app.post("/api/settlements/:id/cancel", auth, async (req) => {
    operator(req.actor, true);
    const id = idInput.parse(req.params.id);
    const reason = z.string().trim().min(3).max(1000).parse(req.body?.reason);
    return db.transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM supplier_settlements WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (row?.status === "CANCELLED") return { status: "CANCELLED" };
      if (!["IN_REVIEW", "APPROVED"].includes(row?.status))
        throw integrationError("لا يمكن إلغاء تحويل بدأ إرساله", 409);
      await c.query(
        "UPDATE supplier_settlements SET status='CANCELLED',updated_at=now() WHERE id=$1",
        [id],
      );
      await audit(c, req.actor, "SUPPLIER_SETTLEMENT_CANCELLED", id, {
        reason,
      });
      return { status: "CANCELLED" };
    });
  });
  app.post("/api/settlements/:id/refresh", auth, async (req) => {
    operator(req.actor);
    const id = idInput.parse(req.params.id);
    new SupplierPayoutBridge().assertConfigured();
    await db.transaction((c) =>
      enqueue(
        c,
        "SUPPLIER_PAYOUT_RECONCILE",
        { settlementId: id },
        "supplier-payout-refresh:" +
          id +
          ":" +
          keyInput.parse(req.headers["idempotency-key"]),
      ),
    );
    return { queued: true };
  });
  app.post(
    "/api/webhooks/supplier-payouts",
    { config: { csrf: false }, bodyLimit: 4096 },
    async (req, reply) => {
      const event = z
        .object({
          eventId: z.string().min(1).max(120),
          externalId: z.string().uuid(),
          timestamp: z.number().int(),
        })
        .strict()
        .parse(req.body);
      if (
        !verifyPayoutWebhook(
          event,
          req.headers["x-payout-signature"],
        integrationEnvironment().SUPPLIER_PAYOUT_WEBHOOK_SECRET,
        )
      )
        throw integrationError("توقيع إشعار التحويل غير صالح", 401);
      await db.transaction(async (c) => {
        const inserted = await c.query(
          "INSERT INTO webhook_events(provider,event_id,payload) VALUES('supplier-payout',$1,$2) ON CONFLICT DO NOTHING RETURNING event_id",
          [event.eventId, event],
        );
        if (!inserted.rowCount) {
          const previous = (
            await c.query(
              "SELECT payload FROM webhook_events WHERE provider='supplier-payout' AND event_id=$1",
              [event.eventId],
            )
          ).rows[0];
          if (previous.payload.externalId !== event.externalId)
            throw integrationError("مرجع الإشعار مستخدم لتحويل مختلف", 409);
        }
        if (inserted.rowCount)
          await enqueue(
            c,
            "SUPPLIER_PAYOUT_RECONCILE",
            { settlementId: event.externalId, eventId: event.eventId },
            "supplier-payout-webhook:" + event.eventId,
          );
      });
      return reply.code(202).send({ accepted: true });
    },
  );
}
