/**
 * Shared Unified Document Design System for HTML & Print documents
 * Brand palette matches src/styles.css: plum #3e2428, date #5a2d2d, gold #c69a61, sand #ead8c6, ivory #fbf7f2.
 */

export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const TONE_MAP = {
  good: "doc-badge--good",
  success: "doc-badge--good",
  SIGNED: "doc-badge--good",
  CONFIRMED: "doc-badge--good",
  PAID: "doc-badge--good",
  COMPLETED: "doc-badge--good",
  RECEIVED: "doc-badge--good",
  APPROVED: "doc-badge--good",
  CONTRACT_APPROVED: "doc-badge--good",
  warn: "doc-badge--warn",
  warning: "doc-badge--warn",
  PENDING: "doc-badge--warn",
  REFUND_PENDING: "doc-badge--warn",
  NEEDS_CHANGES: "doc-badge--warn",
  NEEDS_OWNER_APPROVAL: "doc-badge--warn",
  SENT: "doc-badge--info",
  QUOTE_READY: "doc-badge--info",
  CUSTOMER_REVIEW: "doc-badge--info",
  REFUNDED: "doc-badge--info",
  bad: "doc-badge--bad",
  danger: "doc-badge--bad",
  error: "doc-badge--bad",
  CANCELLED: "doc-badge--bad",
  REJECTED: "doc-badge--bad",
  FAILED: "doc-badge--bad",
  DISPUTED: "doc-badge--bad",
  DRAFT: "doc-badge--neutral",
  inactive: "doc-badge--neutral",
};

export function resolveDocumentTone(status, explicitTone = "") {
  if (explicitTone && TONE_MAP[explicitTone]) return TONE_MAP[explicitTone];
  return TONE_MAP[status] || "doc-badge--info";
}

/**
 * Self-contained institutional CSS (compatible with strict CSP style-src 'unsafe-inline').
 */
export function unifiedDocumentCSS() {
  return `
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f6efe6;color:#2d2424;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;font-size:14px;line-height:1.75;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-page{max-width:880px;margin:28px auto;padding:0 16px}
.doc-sheet{background:#fffdfc;border:1px solid #e4d2be;border-radius:16px;overflow:hidden;box-shadow:0 14px 38px rgba(62,36,40,.08)}
.doc-ribbon{height:7px;background:linear-gradient(90deg,#3e2428,#5a2d2d 55%,#c69a61)}
.doc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:24px 28px 20px;background:linear-gradient(180deg,#fdf9f4,#fffdfc);border-bottom:2px solid #c69a61}
.doc-brand{display:flex;align-items:center;gap:16px;min-width:0}
.doc-logo img,.doc-logo svg{display:block;max-height:74px;max-width:150px;width:auto;height:auto;object-fit:contain}
.doc-brand-text h1{margin:0;font-size:21px;font-weight:700;color:#3e2428;letter-spacing:.2px}
.doc-brand-sub{margin:3px 0 0;font-size:12px;color:#856034;font-weight:500}
.doc-title-block{text-align:left;min-width:210px}
.doc-eyebrow{display:inline-block;font-size:11px;font-weight:700;color:#856034;letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px}
.doc-title{margin:0;font-size:20px;font-weight:700;color:#5a2d2d;line-height:1.35}
.doc-ref-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:8px}
.doc-ref{display:inline-block;padding:3px 10px;border-radius:999px;background:#f5e7dd;border:1px solid #dfc5b0;color:#5a2d2d;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.doc-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid transparent}
.doc-badge--good{background:#e7f5ee;color:#1b5e3c;border-color:#b7dfc9}
.doc-badge--warn{background:#fdf3e2;color:#8c5008;border-color:#efd3a3}
.doc-badge--bad{background:#fbeaea;color:#932a2a;border-color:#edc3c3}
.doc-badge--info{background:#ebf3fa;color:#1f4f73;border-color:#bdd6eb}
.doc-badge--neutral{background:#f2efec;color:#59514c;border-color:#d8d1cb}
.doc-body{padding:24px 28px 26px}
.doc-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 22px}
.doc-meta-item{background:#fbf7f2;border:1px solid #ead8c6;border-radius:10px;padding:10px 13px;min-width:0;break-inside:avoid}
.doc-meta-label{display:block;font-size:11px;color:#75635e;font-weight:600;margin-bottom:2px}
.doc-meta-value{display:block;font-size:13px;color:#2d2424;font-weight:600;overflow-wrap:anywhere}
.doc-table-wrap{margin:0 0 22px;border:1px solid #e4d2be;border-radius:12px;overflow:hidden}
table.doc-table{width:100%;border-collapse:collapse;font-size:13px}
.doc-table thead{display:table-header-group}
.doc-table thead th{background:#3e2428;color:#fbf7f2;font-weight:600;padding:11px 14px;text-align:right;border-bottom:2px solid #c69a61;white-space:nowrap}
.doc-table tbody td{padding:11px 14px;border-bottom:1px solid #efe3d5;vertical-align:top;color:#2d2424}
.doc-table tbody tr:nth-child(even) td{background:#fcf8f3}
.doc-table tbody tr:last-child td{border-bottom:0}
.doc-table tbody tr{break-inside:avoid}
.doc-table .num,.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.doc-table th.num,.doc-table td.num{text-align:left;direction:ltr}
.doc-summary{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:stretch;gap:12px;background:#f7eee4;border:1px solid #dfc5b0;border-right:4px solid #5a2d2d;border-radius:12px;padding:14px 18px;margin-bottom:20px;break-inside:avoid}
.doc-summary-item{display:flex;flex-direction:column;gap:2px;min-width:160px}
.doc-summary-item span{font-size:12px;color:#75635e;font-weight:500}
.doc-summary-item strong{font-size:16px;color:#3e2428;font-variant-numeric:tabular-nums}
.doc-summary-item.is-total strong{font-size:20px;color:#5a2d2d}
.doc-sections{display:grid;gap:14px;margin-bottom:16px}
.doc-section{background:#fbf7f2;border:1px solid #ead8c6;border-radius:12px;padding:14px 18px;break-inside:avoid}
.doc-section h3{margin:0 0 6px;font-size:14px;font-weight:700;color:#5a2d2d}
.doc-section p{margin:0;font-size:13px;color:#3c3030;white-space:pre-line;overflow-wrap:anywhere}
.doc-footer{background:#fbf7f2;border-top:1px solid #e4d2be;padding:14px 28px;font-size:11.5px;color:#6f5b55;line-height:1.7;break-inside:avoid}
.doc-hash{display:inline-block;margin-top:4px;padding:2px 8px;background:#fffdfc;border:1px solid #e4d2be;border-radius:6px;font-family:Consolas,monospace;font-size:11px;color:#3e2428;word-break:break-all}
@media (max-width:720px){
  .doc-page{margin:12px auto;padding:0 10px}
  .doc-header,.doc-body,.doc-footer{padding-inline:16px}
  .doc-title-block{text-align:right}
  .doc-ref-row{justify-content:flex-start}
  .doc-meta{grid-template-columns:1fr}
}
@media print{
  html,body{background:#fff}
  .doc-page{max-width:none;margin:0;padding:0}
  .doc-sheet{box-shadow:none;border-color:#d5c1ae;border-radius:0}
  .doc-meta{grid-template-columns:repeat(3,minmax(0,1fr))}
  .no-print{display:none !important}
}`;
}

/**
 * Render a complete institutional Arabic RTL HTML document styled for Habb Alsaad.
 */
export function renderUnifiedDocument({
  title,
  docType = "",
  reference = "",
  status = "",
  statusLabel = "",
  statusTone = "",
  brandHTML = "",
  brandTitle = "",
  subtitle = "",
  meta = [],
  tableHeaders = [],
  tableRows = [],
  numericColumns = [],
  summaryItems = [],
  sections = [],
  docHash = "",
  footerText = "",
  extraStyles = "",
}) {
  const badgeClass = resolveDocumentTone(status, statusTone);
  const badgeText = statusLabel || status;
  const hasBrand = Boolean(brandHTML || brandTitle);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>${unifiedDocumentCSS()}${extraStyles}</style>
</head>
<body>
<div class="doc-page">
  <article class="doc-sheet">
    <div class="doc-ribbon"></div>
    <header class="doc-header">
      <div class="doc-brand">
        ${brandHTML ? `<div class="doc-logo">${brandHTML}</div>` : ""}
        ${hasBrand ? `<div class="doc-brand-text">${brandTitle ? `<h1>${escapeHTML(brandTitle)}</h1>` : ""}${subtitle ? `<p class="doc-brand-sub">${escapeHTML(subtitle)}</p>` : ""}</div>` : ""}
      </div>
      <div class="doc-title-block">
        ${docType ? `<span class="doc-eyebrow">${escapeHTML(docType)}</span>` : ""}
        <h2 class="doc-title">${escapeHTML(title)}</h2>
        ${reference || badgeText ? `<div class="doc-ref-row">
          ${reference ? `<span class="doc-ref"><bdi>${escapeHTML(reference)}</bdi></span>` : ""}
          ${badgeText ? `<span class="doc-badge ${badgeClass}">${escapeHTML(badgeText)}</span>` : ""}
        </div>` : ""}
      </div>
    </header>
    <div class="doc-body">
      ${meta.length ? `<section class="doc-meta" aria-label="بيانات الوثيقة">
        ${meta.filter((m) => m && (m.value !== undefined && m.value !== null && m.value !== "")).map((m) => `<div class="doc-meta-item">
          <span class="doc-meta-label">${escapeHTML(m.label)}</span>
          <span class="doc-meta-value"><bdi>${escapeHTML(m.value)}</bdi></span>
        </div>`).join("")}
      </section>` : ""}
      ${tableHeaders.length ? `<div class="doc-table-wrap">
        <table class="doc-table">
          <thead><tr>${tableHeaders.map((h, i) => `<th class="${numericColumns.includes(i) ? "num" : ""}">${escapeHTML(h)}</th>`).join("")}</tr></thead>
          <tbody>
            ${tableRows.map((row) => `<tr>${row.map((cell, i) => `<td class="${numericColumns.includes(i) ? "num" : ""}">${numericColumns.includes(i) ? `<bdi>${escapeHTML(cell)}</bdi>` : escapeHTML(cell)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}
      ${summaryItems.length ? `<section class="doc-summary" aria-label="الملخص المالي">
        ${summaryItems.map((s) => `<div class="doc-summary-item ${s.emphasize ? "is-total" : ""}">
          <span>${escapeHTML(s.label)}</span>
          <strong><bdi>${escapeHTML(s.value)}</bdi></strong>
        </div>`).join("")}
      </section>` : ""}
      ${sections.filter((s) => s && s.body !== undefined && s.body !== null && s.body !== "").length ? `<div class="doc-sections">
        ${sections.filter((s) => s && s.body !== undefined && s.body !== null && s.body !== "").map((s) => `<section class="doc-section">
          <h3>${escapeHTML(s.title)}</h3>
          <p>${escapeHTML(s.body)}</p>
        </section>`).join("")}
      </div>` : ""}
    </div>
    ${docHash || footerText ? `<footer class="doc-footer">
      ${footerText ? `<div>${escapeHTML(footerText)}</div>` : ""}
      ${docHash ? `<div>بصمة التوثيق: <code class="doc-hash"><bdi>${escapeHTML(docHash)}</bdi></code></div>` : ""}
    </footer>` : ""}
  </article>
</div>
</body>
</html>`;
}
