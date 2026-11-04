import { readFileSync } from "node:fs";
import { branding, logoDefaults } from "../../src/branding.mjs";
import { createHash } from "node:crypto";
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function brandSnapshot(settings) {
  const identity = branding(settings);
  return { title: identity.title, logo: identity.logo };
}
export async function currentBrand(db) {
  const row = (await db.query("SELECT data FROM app_settings WHERE id=true")).rows[0]?.data;
  return branding(row?.settings || row);
}
let originalDocumentLogo;
export function documentBrandHTML(identity) {
  let logo = identity.logo;
  if (logo === logoDefaults.logo) {
    if (!originalDocumentLogo) {
      for (const directory of ["dist", "public"]) {
        try {
          const image = readFileSync(new URL("../../" + directory + "/brand-motion/logo/habb-logo-v1.webp", import.meta.url));
          originalDocumentLogo = "data:image/webp;base64," + image.toString("base64");
          break;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
    logo = originalDocumentLogo;
  }
  return logo ? '<img src="' + escapeHTML(logo) + '" alt="" style="height:80px;object-fit:contain">' : '';
}
export function contractHTML(booking, contract, settings) {
  const data = contract.data || contract;
  data.terms ||= data.clauses;
  const identity = data.branding || brandSnapshot(settings);
  const company = data.company || booking.data?.contract?.company || {};
  const lines = data.snapshot || data.lines || booking.data?.lines || [];
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>وثيقة المناسبة ${escapeHTML(booking.id)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:24px;color:#4b0d1d;line-height:1.9}h1{font-weight:500}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #d1a385}small{color:#6f2b33}@media print{body{margin:0}}</style>${documentBrandHTML(identity)}${identity.title ? "<h1>" + escapeHTML(identity.title) + "</h1>" : ""}<p>الجهة المتعاقدة: ${escapeHTML(company.name)} · رقم التسجيل: ${escapeHTML(company.registrationNumber)}</p><h2>${data.kind === "AMENDMENT" ? "ملحق تعديل عقد تنظيم مناسبة" : "عقد تنظيم مناسبة"}</h2><p>رقم الطلب: ${escapeHTML(booking.id)} · إصدار العقد: ${escapeHTML(contract.version || data.version || 1)}</p><p>العميل: ${escapeHTML(booking.data?.customer)} · التاريخ: ${escapeHTML(booking.data?.occasion?.date)}</p><table><thead><tr><th>الخدمة</th><th>الكمية</th><th>السعر د.ك</th></tr></thead><tbody>${lines.map((l) => `<tr><td>${escapeHTML(l.title)}</td><td>${escapeHTML(l.qty)}</td><td>${escapeHTML(Number(l.price || 0).toFixed(3))}</td></tr>`).join("")}</tbody></table><p>الإجمالي: ${escapeHTML(data.total)} د.ك</p><p>الشروط: ${escapeHTML(data.terms || "تطبق الشروط المعتمدة في نسخة العرض الموقعة وجدول الدفعات المسجل.")}</p><p>جدول الدفعات: ${escapeHTML((data.paymentSchedule || []).join("% / "))}%</p><p>حالة التوقيع: ${escapeHTML(contract.status || data.status)}</p><p>التوقيع: ${escapeHTML(data.signature || "بانتظار التوقيع")}</p><small>بصمة النسخة: ${escapeHTML(contract.document_hash || "")}. تحفظ موافقة المستخدم وتاريخ التوقيع وإصدار الوثيقة في سجل التدقيق. عند الحاجة لشهادة توقيع معتمدة يُربط مزود التوقيع الخارجي.</small></html>`;
}
export const documentHash = (html) =>
  createHash("sha256").update(html).digest("hex");
// External signing implementation: SignatureBridge in ./esignature.mjs.
