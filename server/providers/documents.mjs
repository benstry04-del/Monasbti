import { readFileSync } from "node:fs";
import { branding, logoDefaults } from "../../src/branding.mjs";
import { escapeHTML, renderUnifiedDocument } from "../../src/document-layout.mjs";
import { labels } from "../../src/domain.mjs";
import { createHash } from "node:crypto";

export { escapeHTML };

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
  return logo ? '<img src="' + escapeHTML(logo) + '" alt="" style="height:74px;max-width:150px;object-fit:contain">' : "";
}

function splitBrandParts(title) {
  if (!title) return { ar: "", en: "" };
  const parts = String(title).split("|").map((s) => s.trim()).filter(Boolean);
  return { ar: parts[0] || "", en: parts.slice(1).join(" | ") };
}

export function contractHTML(booking, contract, settings) {
  const data = contract.data || contract;
  data.terms ||= data.clauses;
  const identity = data.branding || brandSnapshot(settings);
  const company = data.company || booking.data?.contract?.company || {};
  const lines = data.snapshot || data.lines || booking.data?.lines || [];
  const rawStatus = contract.status || data.status || "";
  const docHeading =
    data.kind === "AMENDMENT"
      ? "ملحق تعديل عقد تنظيم مناسبة"
      : data.kind === "QUOTE"
        ? "عرض سعر تنظيم مناسبة"
        : "عقد تنظيم مناسبة";
  const brand = splitBrandParts(identity.title);

  return renderUnifiedDocument({
    title: `${docHeading} · ${booking.id}`,
    docType: "الوثائق التعاقدية",
    reference: `طلب ${booking.id} · v${contract.version || data.version || 1}`,
    status: rawStatus,
    statusLabel: labels[rawStatus] || rawStatus,
    brandHTML: documentBrandHTML(identity),
    brandTitle: brand.ar,
    subtitle: brand.en,
    meta: [
      { label: "العميل", value: booking.data?.customer },
      { label: "تاريخ المناسبة", value: booking.data?.occasion?.date },
      { label: "الجهة المتعاقدة", value: company.name },
      { label: "رقم التسجيل التجاري", value: company.registrationNumber },
      { label: "رقم الطلب", value: booking.id },
      { label: "إصدار الوثيقة", value: contract.version || data.version || 1 },
    ],
    tableHeaders: ["الخدمة", "الكمية", "السعر د.ك", "الإجمالي د.ك"],
    numericColumns: [1, 2, 3],
    tableRows: lines.map((l) => {
      const qty = Number(l.qty || 1);
      const unit = Number(l.price || 0);
      return [l.title, qty, unit.toFixed(3), (unit * qty).toFixed(3)];
    }),
    summaryItems: [
      { label: "الإجمالي", value: `${Number(data.total ?? 0).toFixed(3)} د.ك`, emphasize: true },
      ...((data.paymentSchedule || []).length
        ? [{ label: "جدول الدفعات", value: `${(data.paymentSchedule || []).join("% / ")}%` }]
        : []),
    ],
    sections: [
      {
        title: "الشروط والأحكام",
        body: data.terms || "تطبق الشروط المعتمدة في نسخة العرض الموقعة وجدول الدفعات المسجل.",
      },
      {
        title: "التوقيع والاعتماد الإلكتروني",
        body: `حالة التوقيع: ${labels[rawStatus] || rawStatus}\nالتوقيع: ${data.signature || "بانتظار التوقيع"}`,
      },
    ],
    docHash: contract.document_hash || "",
    footerText:
      "بصمة النسخة: تحفظ موافقة المستخدم وتاريخ التوقيع وإصدار الوثيقة في سجل التدقيق. عند الحاجة لشهادة توقيع معتمدة يُربط مزود التوقيع الخارجي.",
  });
}

export function receiptHTML({ payment, identity, rows }) {
  const brand = splitBrandParts(identity.title);
  const metaRows = rows.map(([label, value]) => ({ label, value }));
  return renderUnifiedDocument({
    title: "إيصال دفع موثّق",
    docType: "المستندات المالية",
    reference: payment.id,
    status: payment.status,
    statusLabel: labels[payment.status] || payment.status,
    brandHTML: documentBrandHTML(identity),
    brandTitle: brand.ar,
    subtitle: brand.en,
    meta: metaRows,
    tableHeaders: ["البيان", "القيمة"],
    tableRows: rows.map(([k, v]) => [k, v]),
    summaryItems: [
      { label: "المبلغ المحصّل", value: `${rows.find(([k]) => k === "المبلغ د.ك")?.[1] ?? "0.000"} د.ك`, emphasize: true },
      ...(Number(payment.data?.refunded || 0) > 0
        ? [{ label: "المسترد", value: `${payment.data.refunded} د.ك` }]
        : []),
    ],
    footerText: "وثيقة تحصيل رسمية صادرة من النظام المالي للمنصة؛ كافة المبالغ بالدينار الكويتي (د.ك).",
  });
}

const PROCUREMENT_LABELS = {
  DRAFT: "مسودة",
  SENT: "مرسل للمورد",
  RECEIVED: "مستلم",
  CANCELLED: "ملغي",
};

export function procurementHTML({ record, supplierName, identity, moneyFn }) {
  const brand = splitBrandParts(identity.title);
  const data = record.data || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const totalMinor = Number(record.amount_minor || 0);
  const paidMinor = Number(record.paid_minor || 0);

  return renderUnifiedDocument({
    title: `طلب توريد · ${record.id}`,
    docType: "المشتريات والتوريد",
    reference: record.id,
    status: record.status,
    statusLabel: PROCUREMENT_LABELS[record.status] || record.status,
    brandHTML: documentBrandHTML(identity),
    brandTitle: brand.ar,
    subtitle: brand.en,
    meta: [
      { label: "المورد", value: supplierName || "—" },
      { label: "تاريخ التسليم", value: data.date },
      { label: "الحالة", value: PROCUREMENT_LABELS[record.status] || record.status },
      { label: "مرجع الحجز", value: data.bookingId || "—" },
      { label: "مرجع الفاتورة", value: data.invoice || "—" },
      { label: "الإجمالي", value: `${moneyFn(totalMinor)} د.ك` },
    ],
    tableHeaders: ["الصنف", "الكمية", "تكلفة الوحدة (د.ك)", "الإجمالي (د.ك)"],
    numericColumns: [1, 2, 3],
    tableRows: items.map((item) => {
      const qty = Number(item.quantity || 1);
      const unitMinor = Number(item.unitCost || 0);
      return [item.name, qty, moneyFn(unitMinor), moneyFn(unitMinor * qty)];
    }),
    summaryItems: [
      { label: "إجمالي طلب التوريد", value: `${moneyFn(totalMinor)} د.ك`, emphasize: true },
      { label: "المدفوع", value: `${moneyFn(paidMinor)} د.ك` },
      { label: "المتبقي", value: `${moneyFn(Math.max(0, totalMinor - paidMinor))} د.ك` },
    ],
    sections: data.notes ? [{ title: "الملاحظات والشروط", body: data.notes }] : [],
    footerText: "مستند طلب توريد صادر عن إدارة المشتريات · جميع التكاليف بالدينار الكويتي (د.ك).",
  });
}

export const documentHash = (html) =>
  createHash("sha256").update(html).digest("hex");
// External signing implementation: SignatureBridge in ./esignature.mjs.
