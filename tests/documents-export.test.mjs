import test from "node:test";
import assert from "node:assert/strict";
import { renderUnifiedDocument } from "../src/document-layout.mjs";
import { generateXlsx } from "../src/excel-export.mjs";
import { contractHTML, receiptHTML, procurementHTML, documentHash } from "../server/providers/documents.mjs";
import { businessPDF } from "../server/providers/business-pdf.mjs";

function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function readZipEntries(bytes) {
  const buf = Buffer.from(bytes);
  const entries = new Map();
  let off = 0;
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const dataLen = buf.readUInt32LE(off + 18);
    const name = buf.toString("utf8", off + 30, off + 30 + nameLen);
    const dataStart = off + 30 + nameLen + extraLen;
    entries.set(name, buf.toString("utf8", dataStart, dataStart + dataLen));
    off = dataStart + dataLen;
  }
  return entries;
}

test("unified document design system renders RTL HTML with print styles, escaping, and deterministic hash", () => {
  const docHtml = renderUnifiedDocument({
    title: "عرض سعر تجريبي <script>alert(1)</script>",
    docType: "عروض الأسعار",
    reference: "ORD-2026-99",
    status: "SIGNED",
    statusLabel: "موقّع ومعتمد",
    brandTitle: "هَبّ السعد",
    subtitle: "HABB ALSAAD",
    meta: [
      { label: "العميل", value: "سارة <b>الكويت</b>" },
      { label: "تاريخ المناسبة", value: "2026-12-20" },
    ],
    tableHeaders: ["الخدمة", "الكمية", "السعر د.ك", "الإجمالي د.ك"],
    numericColumns: [1, 2, 3],
    tableRows: [["ضيافة ملكية", 2, "120.000", "240.000"]],
    summaryItems: [{ label: "الإجمالي", value: "240.000 د.ك", emphasize: true }],
    sections: [{ title: "الشروط", body: "بند أول" }],
    docHash: "abc123def456",
  });

  assert.match(docHtml, /<html lang="ar" dir="rtl">/);
  assert.match(docHtml, /@page\s*\{\s*size:\s*A4/);
  assert.match(docHtml, /thead\s*\{\s*display:\s*table-header-group/);
  assert.ok(!docHtml.includes("<script>"), "raw script tag must be escaped");
  assert.ok(docHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(docHtml.includes("&lt;b&gt;الكويت&lt;/b&gt;"));
  assert.ok(docHtml.includes("doc-badge--good"));
  assert.ok(docHtml.includes("موقّع ومعتمد"));
  assert.equal(documentHash(docHtml), documentHash(docHtml));
});

test("receiptHTML and procurementHTML preserve document data inside unified brand templates", () => {
  const receipt = receiptHTML({
    payment: { id: "pay-100", status: "PAID", data: { refunded: 0 } },
    identity: { title: "هَبّ السعد | HABB ALSAAD", logo: "/logo.webp" },
    rows: [
      ["رقم العملية", "pay-100"],
      ["رقم الحجز", "BK-100"],
      ["المبلغ د.ك", "350.000"],
      ["حالة الدفعة", "PAID"],
    ],
  });
  assert.match(receipt, /إيصال دفع موثّق/);
  assert.match(receipt, /350\.000/);
  assert.match(receipt, /BK-100/);

  const po = procurementHTML({
    record: {
      id: "po-100",
      status: "SENT",
      amount_minor: 425000,
      paid_minor: 100000,
      data: {
        date: "2026-11-30",
        bookingId: "BK-100",
        invoice: "INV-77",
        notes: "التوصيل صباحًا",
        items: [{ name: "بوفيه ضيافة", quantity: 2, unitCost: 212500 }],
      },
    },
    supplierName: "مطابخ التراث",
    identity: { title: "هَبّ السعد | HABB ALSAAD", logo: "/logo.webp" },
    moneyFn: (minor) => (Number(minor) / 1000).toFixed(3),
  });
  assert.match(po, /طلب توريد · po-100/);
  assert.match(po, /مطابخ التراث/);
  assert.match(po, /425\.000 د\.ك/);
  assert.match(po, /325\.000 د\.ك/);

  const contract = contractHTML(
    { id: "BK-100", data: { customer: "نورة", occasion: { date: "2026-12-24" } } },
    { version: 2, status: "SIGNED", data: { kind: "AMENDMENT", total: 500, lines: [{ title: "ديكور", qty: 1, price: 500 }] }, document_hash: "h99" },
    {},
  );
  assert.match(contract, /ملحق تعديل عقد تنظيم مناسبة/);
  assert.match(contract, /500\.000 د\.ك/);
});

test("businessPDF generates valid single-page and multi-page Arabic RTL PDF documents", async () => {
  const singleBuf = await collectStream(
    businessPDF({
      settings: {},
      docType: "RECEIPT",
      title: "إيصال دفع موثّق",
      reference: "PAY-2026-01",
      status: "PAID",
      fields: [{ label: "العميل", value: "أحمد الكندري" }],
      lines: [{ title: "باقة ضيافة", quantity: 1, price: 150 }],
      total: 150,
    }),
  );
  assert.equal(singleBuf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(singleBuf.length > 5000);

  const lines = Array.from({ length: 28 }, (_, i) => ({
    title: `خدمة تنظيم رقم ${i + 1}`,
    quantity: (i % 3) + 1,
    price: 50 + i,
  }));
  const multiBuf = await collectStream(
    businessPDF({
      settings: {},
      docType: "CONTRACT",
      title: "عقد تنظيم مناسبة",
      reference: "BK-2026-142 · V2",
      status: "SIGNED",
      fields: [
        { label: "الشركة", value: "هَبّ السعد لتنظيم المناسبات" },
        { label: "السجل التجاري", value: "CR-98765" },
      ],
      lines,
      total: lines.reduce((s, l) => s + l.quantity * l.price, 0),
      notes: ["بند التزام أساسي", "بصمة الوثيقة: abcdef123456"],
    }),
  );
  assert.equal(multiBuf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(multiBuf.length > singleBuf.length);
});

test("generateXlsx produces valid RTL multi-sheet OOXML workbook with KWD formatting and formula injection guard", () => {
  const bytes = generateXlsx({
    sheets: [
      {
        name: "سجل الطلبات",
        title: "هَبّ السعد — سجل الطلبات",
        subtitle: "تقرير معتمد",
        columns: [
          { header: "المرجع", type: "code", width: 16 },
          { header: "العميل", type: "text", width: 20 },
          { header: "التاريخ", type: "date", width: 14 },
          { header: "المبلغ (د.ك)", type: "currency", width: 18 },
          { header: "الحالة", type: "status", width: 18 },
        ],
        rows: [
          ["BK-01", "=SUM(A1:A5)", "2026-12-20", 350.5, { code: "SIGNED", label: "العقد موقّع" }],
          ["BK-02", "فهد العتيبي", "2026-12-25", 125.125, { code: "CANCELLED", label: "ملغي" }],
        ],
        totals: ["الإجمالي", "2 طلب", "", 475.625, ""],
      },
      {
        name: "التحليل",
        title: "التحليل المالي",
        columns: [
          { header: "البند", type: "text", width: 20 },
          { header: "القيمة", type: "number", width: 14 },
        ],
        rows: [["عدد العقود", 12]],
      },
    ],
  });

  assert.equal(bytes[0], 0x50); // P
  assert.equal(bytes[1], 0x4b); // K
  const entries = readZipEntries(bytes);
  assert.ok(entries.has("[Content_Types].xml"));
  assert.ok(entries.has("xl/workbook.xml"));
  assert.ok(entries.has("xl/styles.xml"));
  assert.ok(entries.has("xl/worksheets/sheet1.xml"));
  assert.ok(entries.has("xl/worksheets/sheet2.xml"));

  const wb = entries.get("xl/workbook.xml");
  assert.ok(wb.includes("سجل الطلبات"));
  assert.ok(wb.includes("التحليل"));

  const styles = entries.get("xl/styles.xml");
  assert.ok(styles.includes("#,##0.000 &quot;د.ك&quot;") || styles.includes("#,##0.000 \"د.ك\""));

  const sheet1 = entries.get("xl/worksheets/sheet1.xml");
  assert.ok(sheet1.includes('rightToLeft="1"'));
  assert.ok(sheet1.includes("autoFilter"));
  assert.ok(sheet1.includes("&apos;=SUM(A1:A5)"), "leading '=' formula must be prefixed and XML-escaped safely");
  assert.ok(!sheet1.includes(">=<"), "must not leave bare formula cell");
  assert.ok(sheet1.includes("<v>350.5</v>"));
  assert.ok(sheet1.includes("<v>475.625</v>"));
});
