import { currentBrand } from "./providers/documents.mjs";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { query, transaction, pool } from "./db.mjs";
import {
  paymentProvider,
  integrationError,
  toMinor,
  fromMinor,
} from "./providers/payments.mjs";
import { sendMessage } from "./providers/notifications.mjs";
import { contractHTML, documentHash } from "./providers/documents.mjs";
import { enqueue, settlePayment } from "./integrations.mjs";
import { captureServerError, flushMonitoring } from "./observability.mjs";
import { executeSupplierPayout, reconcileSettlement } from "./settlements.mjs";
import {loadIntegrationEnvironment,withIntegrationEnvironment,integrationEnvironment} from './integration-runtime.mjs';
import {config} from './config.mjs';
import {executeMessageDelivery} from './notification-delivery.mjs';
import {createSignatureEnvelope,reconcileSignature} from './signatures.mjs';

const log = (level, event, details = {}) =>
  process.stdout.write(
    JSON.stringify({ level, event, ...details, at: new Date().toISOString() }) +
      "\n",
  );
const runtimeDb={query,transaction};
export const retryDelay = (attempt) =>
  Math.min(3600000, 1000 * 2 ** Math.min(attempt, 12));

async function reconcileWebhook(eventId, provider) {
  const stored = (
    await query(
      "SELECT * FROM webhook_events WHERE provider='myfatoorah' AND event_id=$1",
      [eventId],
    )
  ).rows[0];
  if (!stored || stored.status === "COMPLETED") return;
  const event = stored.payload;
  if (event.Event.Name === "PAYMENT_STATUS_CHANGED") {
    const details = await provider.getPayment(event.Data.Transaction.PaymentId);
    await transaction(async (client) => {
      const payment = (
        await client.query(
          "SELECT * FROM payments WHERE provider='myfatoorah' AND provider_reference=$1 FOR UPDATE",
          [String(event.Data.Invoice.Id)],
        )
      ).rows[0];
      if (!payment)
        throw integrationError(
          "Unknown payment invoice. Reconcile orphaned provider invoice.",
          409,
          "UNKNOWN_PAYMENT",
        );
      await settlePayment(client, payment, details);
      await client.query(
        "UPDATE webhook_events SET status='COMPLETED',processed_at=now() WHERE provider='myfatoorah' AND event_id=$1",
        [eventId],
      );
    });
  } else if (event.Event.Name === "REFUND_STATUS_CHANGED") {
    await transaction(async (client) => {
      const refund = (
        await client.query(
          "SELECT * FROM refunds WHERE provider_ref=$1 FOR UPDATE",
          [event.Data.Refund.Id],
        )
      ).rows[0];
      if (!refund)
        throw integrationError(
          "Unknown provider refund reference",
          409,
          "UNKNOWN_REFUND",
        );
      const payment = (
        await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
          refund.payment_id,
        ])
      ).rows[0];
      if (
        String(payment.provider_reference) !==
          String(event.Data.ReferencedInvoice.Id) ||
        payment.currency !== event.Data.Amount.BaseCurrency ||
        Number(refund.amount_minor) !==
          toMinor(event.Data.Amount.ValueInBaseCurrency)
      )
        throw integrationError(
          "Refund amount, currency or invoice mismatch",
          409,
          "REFUND_MISMATCH",
        );
      if (refund.status !== "COMPLETED") {
        if (event.Data.Refund.Status === "CANCELED")
          await client.query(
            "UPDATE refunds SET status='FAILED',updated_at=now() WHERE id=$1",
            [refund.id],
          );
        else if (event.Data.Refund.Status === "REFUNDED") {
          await client.query(
            "UPDATE refunds SET status='COMPLETED',updated_at=now() WHERE id=$1",
            [refund.id],
          );
          const refunded = Number(
            (
              await client.query(
                "SELECT sum(amount_minor) AS total FROM refunds WHERE payment_id=$1 AND status='COMPLETED'",
                [payment.id],
              )
            ).rows[0].total,
          );
          await client.query(
            "UPDATE payments SET status=$2,data=data||$3::jsonb,updated_at=now() WHERE id=$1",
            [
              payment.id,
              refunded === Number(payment.amount_minor) ? "REFUNDED" : "PAID",
              JSON.stringify({
                refunded: Number(fromMinor(refunded)),
                refundStatus: "REFUNDED",
              }),
            ],
          );
          const booking = (
            await client.query(
              "SELECT * FROM bookings WHERE id=$1 FOR UPDATE",
              [payment.booking_id],
            )
          ).rows[0];
          const b = booking.data;
          if (payment.data?.amendment) {
            const amendment = [b.amendment,...(b.amendmentHistory || [])].find(a=>a && (!payment.data.amendmentId || a.id===payment.data.amendmentId));
            if (!amendment) throw integrationError("Refund amendment requires manual reconciliation",409,"MANUAL_RECONCILIATION_REQUIRED");
            amendment.paid = Number(fromMinor(Math.max(0,toMinor(amendment.paid || 0)-Number(refund.amount_minor))));
          } else
            b.paid = Math.max(
              0,
              Number(
                fromMinor(toMinor(b.paid || 0) - Number(refund.amount_minor)),
              ),
            );
          b.timeline = [
            ...(b.timeline || []),
            {
              status: "تم تأكيد الاسترداد من بوابة الدفع",
              at: new Date().toISOString(),
            },
          ];
          await client.query(
            "UPDATE bookings SET data=$2,version=version+1,updated_at=now() WHERE id=$1",
            [booking.id, JSON.stringify(b)],
          );
          await client.query(
            "INSERT INTO audit_log(action,resource_type,resource_id,after_data) VALUES('REFUND_PROVIDER_VERIFIED','refund',$1,$2)",
            [
              refund.id,
              JSON.stringify({
                amountMinor: Number(refund.amount_minor),
                providerRef: refund.provider_ref,
              }),
            ],
          );
          const user = (
            await client.query("SELECT email FROM users WHERE id=$1", [
              payment.user_id,
            ])
          ).rows[0];
          await enqueue(
            client,
            "EMAIL",
            {
              to: user.email,
              subject: ["تأكيد الاسترداد", (await currentBrand(client)).title].filter(Boolean).join(" — "),
              text: `أكّدت بوابة الدفع استرداد ${fromMinor(refund.amount_minor)} د.ك. رقم الاسترداد ${refund.id}.`,
            },
            `refund-receipt:${refund.id}`,
          );
        } else throw integrationError("Unsupported refund status", 400);
      }
      await client.query(
        "UPDATE webhook_events SET status='COMPLETED',processed_at=now() WHERE provider='myfatoorah' AND event_id=$1",
        [eventId],
      );
    });
  }
}

async function requestRefund(payload, provider) {
  const intent = await transaction(async (client) => {
    const refund = (
      await client.query("SELECT * FROM refunds WHERE id=$1 FOR UPDATE", [
        payload.refundId,
      ])
    ).rows[0];
    if (!refund) throw integrationError("Refund intent missing", 404);
    if (refund.provider_ref || refund.status === "COMPLETED") return null;
    // We never retry a money-moving call after an ambiguous response/crash.
    if (refund.status === "PROCESSING")
      throw integrationError(
        "Refund result uncertain; reconcile in merchant portal before retrying.",
        409,
        "MANUAL_RECONCILIATION_REQUIRED",
      );
    const payment = (
      await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
        refund.payment_id,
      ])
    ).rows[0];
    if (payment.status !== "PAID")
      throw integrationError("Payment cannot be refunded", 409);
    await client.query(
      "UPDATE refunds SET status='PROCESSING',updated_at=now() WHERE id=$1",
      [refund.id],
    );
    return { refund, payment };
  });
  if (!intent) return;
  const result = await provider.refund({
    id: intent.refund.id,
    invoiceId: intent.payment.provider_reference,
    amountMinor: Number(intent.refund.amount_minor),
    reason: payload.reason,
  });
  await transaction(async (client) => {
    await client.query(
      "UPDATE refunds SET provider_ref=$2,updated_at=now() WHERE id=$1",
      [intent.refund.id, result.refundId],
    );
    await client.query(
      "INSERT INTO audit_log(action,resource_type,resource_id,after_data) VALUES('REFUND_PROVIDER_SUBMITTED','refund',$1,$2)",
      [intent.refund.id, JSON.stringify({ providerRef: result.refundId })],
    );
  });
}

async function reconcileIntent(paymentId, provider) {
  const payment = (
    await query("SELECT * FROM payments WHERE id=$1", [paymentId])
  ).rows[0];
  if (!payment || !["CREATED", "PENDING", "FAILED"].includes(payment.status)) return;
  const invoice = await provider.getInvoiceByExternalId(paymentId);
  const invoiceId = invoice.Invoice?.Id || invoice.InvoiceId || invoice.Id;
  if (!invoiceId)
    throw integrationError(
      "Orphaned payment intent needs manual provider reconciliation",
      409,
    );
  const transactions =
    invoice.Transactions || invoice.InvoiceTransactions || [];
  const successful = transactions.find((t) =>
    ["SUCCESS", "Succss"].includes(t.Status || t.TransactionStatus),
  );
  const gatewayId = successful?.PaymentId;
  await query(
    "UPDATE payments SET provider_reference=$2,status='PENDING',data=data||$3::jsonb,updated_at=now() WHERE id=$1 AND status='CREATED'",
    [
      paymentId,
      String(invoiceId),
      JSON.stringify({ recoveredProviderIntent: true }),
    ],
  );
  if (gatewayId) {
    const details = await provider.getPayment(gatewayId);
    await transaction(async (c) => {
      const p = (
        await c.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [
          paymentId,
        ])
      ).rows[0];
      await settlePayment(c, p, details);
    });
  }
}

export async function executeJob(
  job,
  { provider = paymentProvider(), messageSender = sendMessage } = {},
) {
  if (["EMAIL", "SMS", "WHATSAPP"].includes(job.job_type))
    return executeMessageDelivery(runtimeDb,job,{sender:messageSender});
  if (job.job_type === 'SUPPLIER_PAYOUT_SUBMIT')
    return executeSupplierPayout({query,transaction},job.payload.settlementId);
  if(job.job_type==='SIGNATURE_CREATE')return createSignatureEnvelope(runtimeDb,job.payload.signatureId,config.encryptionKey);
  if(job.job_type==='SIGNATURE_RECONCILE'){
    await reconcileSignature(runtimeDb,job.payload.signatureId,config.encryptionKey);
    if(job.payload.eventId)await query("UPDATE webhook_events SET status='COMPLETED',processed_at=now() WHERE provider='esignature' AND event_id=$1",[job.payload.eventId]);
    return;
  }
  if (job.job_type === 'SUPPLIER_PAYOUT_RECONCILE') {
    await reconcileSettlement({query,transaction},job.payload.settlementId);
    if (job.payload.eventId) await query("UPDATE webhook_events SET status='COMPLETED',processed_at=now() WHERE provider='supplier-payout' AND event_id=$1",[job.payload.eventId]);
    return;
  }
  if (job.job_type === "PAYMENT_WEBHOOK")
    return reconcileWebhook(job.payload.eventId, provider);
  if (job.job_type === "PAYMENT_INTENT_RECONCILE")
    return reconcileIntent(job.payload.paymentId, provider);
  if (job.job_type === "REFUND_REQUEST")
    return requestRefund(job.payload, provider);
  if (job.job_type === "PAYMENT_REVIEW") {
    if (!integrationEnvironment().OPERATIONS_EMAIL)
      throw integrationError(
        "OPERATIONS_EMAIL required for payment exception alerts",
      );
    return messageSender("EMAIL", {
      to: integrationEnvironment().OPERATIONS_EMAIL,
      subject: "Payment requires reconciliation",
      text: `Payment ${job.payload.paymentId}, booking ${job.payload.bookingId}: payment received after reservation released. Resolve availability/refund from merchant operations.`,
    });
  }
  if (job.job_type === "DOCUMENT_GENERATE")
    return transaction(async (client) => {
      const contract = (
        await client.query("SELECT * FROM contracts WHERE id=$1 FOR UPDATE", [
          job.payload.contractId,
        ])
      ).rows[0];
      if (!contract) throw integrationError("Contract not found", 404);
      if (contract.data.html) return;
      const booking = (
        await client.query("SELECT * FROM bookings WHERE id=$1", [
          contract.booking_id,
        ])
      ).rows[0];
      const html = contractHTML(booking, contract);
      await client.query(
        "UPDATE contracts SET document_hash=$2,data=data||$3::jsonb WHERE id=$1",
        [contract.id, documentHash(html), JSON.stringify({ html })],
      );
    });
  throw integrationError("Unknown background job type", 400, "UNKNOWN_JOB");
}

export async function scheduleDueReminders() {
  return transaction(async (client) => {
    await client.query(
      "INSERT INTO scheduled_reminders(booking_id,user_id,due_at,kind) SELECT id,customer_id,occasion_date::timestamptz-interval '1 day','EVENT_TOMORROW' FROM bookings WHERE status IN ('CONFIRMED','PREPARATION') AND occasion_date>=current_date ON CONFLICT DO NOTHING",
    );
    const due = await client.query(
      `SELECT r.*,u.email FROM scheduled_reminders r JOIN users u ON u.id=r.user_id JOIN bookings b ON b.id=r.booking_id WHERE b.status IN ('CONFIRMED','PREPARATION','IN_PROGRESS') AND r.sent_at IS NULL AND r.due_at<=now() ORDER BY r.due_at FOR UPDATE OF r SKIP LOCKED LIMIT 100`,
    );
    for (const r of due.rows) {
      await enqueue(
        client,
        "EMAIL",
        {
          to: r.email,
          subject: ["تذكير بمناسبتك", (await currentBrand(client)).title].filter(Boolean).join(" — "),
          text: `نذكرك بمناسبتك القادمة. رقم الحجز ${r.booking_id}. تابع التفاصيل من لوحة مناسبتك.`,
        },
        `reminder:${r.id}`,
      );
      await client.query(
        "UPDATE scheduled_reminders SET sent_at=now() WHERE id=$1",
        [r.id],
      );
    }
    await client.query("DELETE FROM sessions WHERE expires_at<now()");
    // Release elapsed holds only when there is no active payment or confirmed receipt.
    await client.query(
      "UPDATE reservations r SET status='RELEASED' WHERE r.status='HELD' AND r.expires_at<now() AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.booking_id=r.booking_id AND p.status IN ('CREATED','PENDING','PAID'))",
    );
    return due.rowCount;
  });
}

export async function runOneJob(deps) {
  const job = await transaction(async (client) => {
    // Recover jobs whose worker died, but financial handlers refuse ambiguous money-moving retries.
    await client.query(
      "UPDATE outbox SET status='PENDING',locked_at=NULL WHERE status='PROCESSING' AND locked_at<now()-interval '10 minutes'",
    );
    const row = (
      await client.query(
        "SELECT * FROM outbox WHERE status='PENDING' AND available_at<=now() ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!row) return null;
    await client.query(
      "UPDATE outbox SET status='PROCESSING',attempts=attempts+1,locked_at=now() WHERE id=$1",
      [row.id],
    );
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!job) return false;
  try {
    await executeJob(job, deps);
    await query(
      "UPDATE outbox SET status='COMPLETED',locked_at=NULL,last_error=NULL WHERE id=$1 AND status='PROCESSING'",
      [job.id],
    );
    log("info", "job.completed", { jobId: job.id, type: job.job_type });
  } catch (error) {
    const permanent = [
      "MANUAL_RECONCILIATION_REQUIRED",
      "PAYMENT_AMOUNT_MISMATCH",
      "PAYMENT_REFERENCE_MISMATCH",
      "REFUND_MISMATCH",
      "UNKNOWN_JOB",
      "PAYOUT_MISMATCH",
      'DELIVERY_UNCERTAIN',
      'DELIVERY_REFERENCE_MISMATCH',
      'SIGNATURE_MISMATCH',
    ].includes(error.code);
    if (permanent || job.attempts >= 8) captureServerError(error, job.id);
    await query(
      "UPDATE outbox SET status=$2,locked_at=NULL,last_error=$3,available_at=$4 WHERE id=$1 AND status='PROCESSING'",
      [
        job.id,
        permanent || job.attempts >= 8 ? "DEAD" : "PENDING",
        `${error.code || "ERROR"}: ${String(error.message).slice(0, 500)}`,
        new Date(Date.now() + retryDelay(job.attempts)),
      ],
    );
    log("error", "job.failed", {
      jobId: job.id,
      type: job.job_type,
      code: error.code || "ERROR",
      attempt: job.attempts,
      dead: permanent || job.attempts >= 8,
    });
  }
  return true;
}

export async function startWorker() {
  let stopped = false,
    lastSchedule = 0;
  process.once("SIGTERM", () => {
    stopped = true;
  });
  process.once("SIGINT", () => {
    stopped = true;
  });
  log("info", "worker.started");
  while (!stopped) {
    try {
      const env=await loadIntegrationEnvironment(runtimeDb,config.encryptionKey);
      if (Date.now() - lastSchedule > 60000) {
        await scheduleDueReminders();
        lastSchedule = Date.now();
      }
      if (!(await withIntegrationEnvironment(env,()=>runOneJob()))) await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      captureServerError(error, "worker-loop");
      log("error", "worker.loop_failed", { code: error.code || "ERROR" });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await pool.end();
  await flushMonitoring();
  log("info", "worker.stopped");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  startWorker().catch(() => {
    log("fatal", "worker.start_failed");
    process.exitCode = 1;
  });
