import { createHmac, timingSafeEqual } from "node:crypto";
import { integrationError } from "./payments.mjs";
import {integrationEnvironment} from '../integration-runtime.mjs';

// An explicit bridge protocol; it does not claim native integration with any bank.
export class SupplierPayoutBridge {
  constructor({ env = integrationEnvironment(), fetchImpl = fetch } = {}) {
    this.env = env;
    this.fetch = fetchImpl;
  }
  assertConfigured({forNewTransfer=false}={}) {
    if(forNewTransfer && this.env.INTEGRATION_PAYOUTS_ENABLED==='false')throw integrationError('تم إيقاف بدء تحويلات جديدة؛ تستمر متابعة التحويلات السابقة');
    let url;
    try {
      url = new URL(this.env.SUPPLIER_PAYOUT_BASE_URL);
    } catch {}
    if (
      this.env.NODE_ENV === "production" &&
      this.env.SUPPLIER_PAYOUT_ENVIRONMENT !== "live"
    )
      throw integrationError(
        "Production supplier payouts require an explicitly certified live environment",
      );
    if (
      this.env.SUPPLIER_PAYOUT_PROVIDER !== "bridge" ||
      !url ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !this.env.SUPPLIER_PAYOUT_API_KEY ||
      !this.env.SUPPLIER_PAYOUT_WEBHOOK_SECRET ||
      this.env.SUPPLIER_PAYOUT_WEBHOOK_SECRET.length < 32
    )
      throw integrationError(
        "جهة تحويل مستحقات الموردين غير مهيأة؛ لم يتم تحويل أي مبلغ",
      );
  }
  async request(method, path, body, key) {
    this.assertConfigured();
    const response = await this.fetch(
      this.env.SUPPLIER_PAYOUT_BASE_URL.replace(/\/$/, "") + path,
      {
        method,
        headers: {
          Authorization: "Bearer " + this.env.SUPPLIER_PAYOUT_API_KEY,
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    ).catch(() => {
      throw integrationError(
        "نتيجة جهة التحويل غير مؤكدة؛ يلزم الاستعلام ولا يجوز تكرار التحويل",
        503,
        "PAYOUT_UNCERTAIN",
      );
    });
    if (!response.ok)
      throw integrationError(
        "تعذر التحقق من جهة التحويل",
        502,
        "PAYOUT_PROVIDER_ERROR",
      );
    return response.json();
  }
  create(row) {
    this.assertConfigured({forNewTransfer:true});
    return this.request(
      "POST",
      "/payouts",
      {
        externalId: row.id,
        recipientRef: row.recipient_ref,
        amountMinor: Number(row.amount_minor),
        currency: row.currency,
      },
      row.id,
    );
  }
  lookup(id) {
    return this.request(
      "GET",
      "/payouts/by-external-id/" + encodeURIComponent(id),
    );
  }
}
export const payoutSignatureInput = (event) =>
  [event.eventId, event.externalId, event.timestamp].join(".");
export function verifyPayoutWebhook(
  event,
  signature,
  secret,
  now = Date.now(),
) {
  if (
    !secret ||
    secret.length < 32 ||
    typeof signature !== "string" ||
    !/^[a-f\d]{64}$/i.test(signature) ||
    !Number.isSafeInteger(event?.timestamp) ||
    Math.abs(now - event.timestamp) > 300000
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(payoutSignatureInput(event))
    .digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}
