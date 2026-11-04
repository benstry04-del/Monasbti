import { createHmac, timingSafeEqual } from "node:crypto";
import {integrationEnvironment} from '../integration-runtime.mjs';

export function integrationError(
  message,
  statusCode = 503,
  code = "INTEGRATION_UNAVAILABLE",
) {
  return Object.assign(new Error(message), { statusCode, code });
}
// KWD uses three decimal places. No binary floating-point arithmetic in the ledger.
export function toMinor(value) {
  const s = String(value);
  if (!/^\d+(?:\.\d{1,3})?$/.test(s))
    throw integrationError("مبلغ غير صالح", 400, "INVALID_AMOUNT");
  const [whole, part = ""] = s.split(".");
  const n = BigInt(whole) * 1000n + BigInt(part.padEnd(3, "0"));
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw integrationError("المبلغ أكبر من الحد المسموح", 400);
  return Number(n);
}
export const fromMinor = (value) => (Number(value) / 1000).toFixed(3);
const fields = {
  PAYMENT_STATUS_CHANGED: [
    "Invoice.Id",
    "Invoice.Status",
    "Transaction.Status",
    "Transaction.PaymentId",
    "Invoice.ExternalIdentifier",
  ],
  REFUND_STATUS_CHANGED: [
    "Refund.Id",
    "Refund.Status",
    "Amount.ValueInBaseCurrency",
    "ReferencedInvoice.Id",
  ],
};
function path(object, dotted) {
  return dotted.split(".").reduce((v, k) => v?.[k], object) ?? "";
}
export function signatureInput(event) {
  const names = fields[event?.Event?.Name];
  if (!names)
    throw integrationError("نوع إشعار غير مدعوم", 400, "UNSUPPORTED_EVENT");
  return names.map((key) => `${key}=${path(event.Data, key)}`).join(",");
}
export function verifyMyFatoorahSignature(event, signature, secret) {
  if (!secret || typeof signature !== "string" || signature.length > 256)
    return false;
  try {
    const expected = createHmac("sha256", secret)
      .update(signatureInput(event), "utf8")
      .digest();
    const supplied = Buffer.from(signature, "base64");
    return (
      expected.length === supplied.length && timingSafeEqual(expected, supplied)
    );
  } catch {
    return false;
  }
}

export class MyFatoorahProvider {
  constructor({
    apiKey = integrationEnvironment().MYFATOORAH_API_KEY,
    environment = integrationEnvironment().MYFATOORAH_ENVIRONMENT || "sandbox",
    fetchImpl = fetch,
  } = {}) {
    this.enabled=integrationEnvironment().INTEGRATION_PAYMENTS_ENABLED !== 'false';
    if (!["sandbox", "live"].includes(environment))
      throw integrationError("تهيئة بوابة الدفع غير صالحة");
    this.apiKey = apiKey;
    this.base =
      environment === "live"
        ? "https://api.myfatoorah.com"
        : "https://apitest.myfatoorah.com";
    this.fetch = fetchImpl;
  }
  assertConfigured({forNewPayment=false}={}) {
    if(forNewPayment && !this.enabled)throw integrationError('تم إيقاف بدء دفعات جديدة؛ تظل الدفعات السابقة قيد المتابعة');
    if (process.env.NODE_ENV === "production" && this.base.includes("apitest."))
      throw integrationError(
        "لا يمكن استخدام حساب دفع اختباري في بيئة الإنتاج.",
      );
    if (!this.apiKey)
      throw integrationError(
        "بوابة الدفع تحتاج تفعيل حساب التاجر؛ لم يتم خصم أي مبلغ.",
      );
  }
  async request(method, route, data) {
    this.assertConfigured();
    if (!/^\/v[23]\/[a-zA-Z0-9/_%-]+$/.test(route))
      throw integrationError("مسار تكامل غير صالح");
    let response;
    try {
      response = await this.fetch(this.base + route, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw integrationError(
        "لم تصل نتيجة بوابة الدفع. سنراجع حالة العملية قبل السماح بمحاولة أخرى.",
        503,
        "PROVIDER_RESULT_UNCERTAIN",
      );
    }
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.IsSuccess || !json.Data)
      throw integrationError(
        "تعذر تأكيد الطلب لدى بوابة الدفع. راجع حالة العملية.",
        502,
        "PROVIDER_REJECTED",
      );
    return json.Data;
  }
  async createCheckout({ id, amountMinor, method, returnURL }) {
    if (!["CARD", "KNET", undefined].includes(method))
      throw integrationError("طريقة الدفع غير مدعومة", 400);
    const url = new URL(returnURL);
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw integrationError("بوابة الدفع تتطلب عنوان رجوع HTTPS عامًا.");
    const data = await this.request("POST", "/v3/payments", {
      ...(method ? { PaymentMethod: method } : {}),
      OperationType: "PAY",
      Order: {
        Amount: Number(fromMinor(amountMinor)),
        Currency: "KWD",
        ExternalIdentifier: id,
      },
      IntegrationUrls: { Redirection: returnURL },
    });
    if (!data.InvoiceId || !data.PaymentURL)
      throw integrationError(
        "استجابة الدفع غير مكتملة",
        502,
        "PROVIDER_RESULT_UNCERTAIN",
      );
    const paymentURL = new URL(data.PaymentURL);
    if (
      paymentURL.protocol !== "https:" ||
      !/(^|\.)myfatoorah\.com$/i.test(paymentURL.hostname)
    )
      throw integrationError("عنوان بوابة الدفع غير موثوق", 502);
    return { invoiceId: String(data.InvoiceId), paymentURL: paymentURL.href };
  }
  getPayment(paymentId) {
    return this.request("GET", `/v3/payments/${encodeURIComponent(paymentId)}`);
  }
  getInvoiceByExternalId(id) {
    return this.request(
      "GET",
      `/v3/invoices/externalIdentifier/${encodeURIComponent(id)}`,
    );
  }
  // Refund API remains v2 in the verified official MakeRefund contract.
  async refund({ invoiceId, amountMinor, id, reason }) {
    const data = await this.request("POST", "/v2/MakeRefund", {
      KeyType: "InvoiceId",
      Key: String(invoiceId),
      Amount: Number(fromMinor(amountMinor)),
      Comment: reason,
      ExternalIdentifier: id,
      ServiceChargeOnCustomer: false,
    });
    if (!data.RefundId)
      throw integrationError(
        "لم يصل مرجع الاسترداد",
        502,
        "PROVIDER_RESULT_UNCERTAIN",
      );
    return { refundId: String(data.RefundId) };
  }
}

export function paymentProvider() {
  if ((integrationEnvironment().PAYMENT_PROVIDER || "myfatoorah") !== "myfatoorah")
    throw integrationError("مزود الدفع غير مهيأ");
  return new MyFatoorahProvider();
}

export function verifyPaymentDetails(payment, details) {
  if (
    String(details?.Invoice?.Id) !== String(payment.provider_reference) ||
    String(details?.Invoice?.ExternalIdentifier) !== String(payment.id)
  )
    throw integrationError(
      "مرجع دفع غير مطابق؛ يلزم التحقق اليدوي.",
      409,
      "PAYMENT_REFERENCE_MISMATCH",
    );
  if (
    details.Amount?.BaseCurrency !== payment.currency ||
    toMinor(details.Amount?.ValueInBaseCurrency) !==
      Number(payment.amount_minor)
  )
    throw integrationError(
      "مبلغ الدفع أو العملة غير مطابقين.",
      409,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  if (
    details.Invoice.Status === "PAID" &&
    details.Transaction?.Status === "SUCCESS"
  )
    return "PAID";
  if (details.Invoice.Status === "PAID") return "PENDING";
  if (["FAILED", "CANCELED"].includes(details.Transaction?.Status))
    return "FAILED";
  return "PENDING";
}
