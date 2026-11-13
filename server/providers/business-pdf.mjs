import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { branding, logoDefaults } from "../../src/branding.mjs";
import { labels } from "../../src/domain.mjs";

const C = {
  plum: "#3e2428",
  date: "#5a2d2d",
  gold: "#c69a61",
  sand: "#ead8c6",
  ivory: "#fbf7f2",
  cream: "#f7eee4",
  surface: "#fffdfc",
  text: "#2d2424",
  muted: "#75635e",
};

function statusToneColors(status) {
  const s = String(status || "").toUpperCase();
  if (["SIGNED", "APPROVED", "COMPLETED", "PAID", "CONFIRMED", "SETTLED", "ACTIVE"].includes(s)) {
    return { bg: "#e7f4ed", fg: "#1d5c3d", border: "#a3d3b8" };
  }
  if (["CANCELLED", "REJECTED", "DISPUTED", "FAILED"].includes(s)) {
    return { bg: "#fbeaea", fg: "#8c2828", border: "#e5aaaa" };
  }
  if (["NEEDS_OWNER_APPROVAL", "PARTIAL", "DELAYED", "PENDING", "PENDING_PAYMENT", "REQUESTED"].includes(s)) {
    return { bg: "#fdf2e2", fg: "#8c520d", border: "#ebc48b" };
  }
  if (["QUOTE_READY", "CUSTOMER_REVIEW", "REFUNDED", "PARTIAL_REFUND", "INTERNAL_REVIEW", "SUPPLIER_CONFIRMATION", "PREPARATION", "IN_PROGRESS", "SENT"].includes(s)) {
    return { bg: "#eaf1f6", fg: "#234c69", border: "#adc7da" };
  }
  return { bg: "#f1ede8", fg: "#5c514b", border: "#d5cdc6" };
}

const ARABIC_FEATURES = ["rlig", "liga", "calt"];
let regFont;
let boldFont;
let defaultLogoPng;

function loadFont(file) {
  for (const dir of ["public/assets", "dist/assets"]) {
    try {
      return readFileSync(new URL(`../../${dir}/${file}`, import.meta.url));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  return null;
}

function loadDefaultLogoPng() {
  if (defaultLogoPng !== undefined) return defaultLogoPng;
  for (const dir of ["dist/assets", "public/assets"]) {
    try {
      defaultLogoPng = readFileSync(new URL(`../../${dir}/habb-alsaad-logo-clean.png`, import.meta.url));
      return defaultLogoPng;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  defaultLogoPng = null;
  return null;
}

function resolveLogoBuffer(identity) {
  const logo = identity?.logo;
  if (!logo) return null;
  if (logo === logoDefaults.logo) return loadDefaultLogoPng();
  if (typeof logo === "string") {
    const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i.exec(logo);
    if (match) return Buffer.from(match[2], "base64");
  }
  return null;
}

const hasArabic = (s) => /[\u0600-\u06ff]/.test(String(s ?? ""));

// Fontkit lays out an entire string RTL when given OpenType `features`;
// pre-reversing multi-character ASCII/digit runs keeps dates, codes, and numbers legible LTR inside Arabic prose.
function prepText(raw) {
  const s = String(raw ?? "");
  if (!hasArabic(s)) return s;
  return s.replace(/[A-Za-z0-9][A-Za-z0-9.,:/_+-]*[A-Za-z0-9%]|[A-Za-z0-9]{2,}|[()[\]{}]/g, (tok) => {
    if (tok === "(") return ")";
    if (tok === ")") return "(";
    if (tok === "[") return "]";
    if (tok === "]") return "[";
    return tok.split("").reverse().join("");
  });
}

function txtOpts(str, extra = {}) {
  const arabic = hasArabic(str);
  return {
    align: extra.align || (arabic ? "right" : "left"),
    ...(arabic ? { features: ARABIC_FEATURES } : {}),
    ...extra,
  };
}

function parseField(raw, index) {
  if (raw && typeof raw === "object" && "label" in raw) {
    return { label: String(raw.label ?? ""), value: String(raw.value ?? "") };
  }
  const text = String(raw ?? "").trim();
  const colon = text.indexOf(":");
  if (colon > 0 && colon < text.length - 1) {
    return {
      label: text.slice(0, colon).trim(),
      value: text.slice(colon + 1).trim(),
    };
  }
  return { label: `بيان ${index + 1}`, value: text };
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toFixed(3) : "0.000";
}

function splitBrandParts(title) {
  const parts = String(title || "").split("|").map((p) => p.trim()).filter(Boolean);
  return { ar: parts[0] || "", en: parts.slice(1).join(" | ") };
}

/**
 * Generate an institutional RTL A4 Habb Alsaad PDF document stream.
 */
export function businessPDF({
  settings,
  branding: explicitBrand,
  title,
  docType = "مستند رسمي",
  reference,
  status = "",
  fields = [],
  lines = [],
  total,
  notes = [],
  footerNote = "وثيقة صادرة عن منصة هَبّ السعد · جميع المبالغ بالدينار الكويتي",
}) {
  const identity = explicitBrand || branding(settings);
  const brand = splitBrandParts(identity.title);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 44, bottom: 54, left: 40, right: 40 },
    bufferPages: true,
    info: {
      Title: title || identity.title || "Habb Alsaad Document",
      Author: identity.title || "Habb Alsaad",
    },
  });

  if (!regFont) regFont = loadFont("font0.woff2") || loadFont("font1.woff2");
  if (!boldFont) boldFont = loadFont("font2.woff2") || regFont;
  if (regFont) doc.registerFont("HabbReg", regFont);
  if (boldFont) doc.registerFont("HabbBold", boldFont);

  const useReg = () => (regFont ? doc.font("HabbReg") : doc);
  const useBold = () => (boldFont ? doc.font("HabbBold") : doc);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2; // ~515pt
  const bottomLimit = pageHeight - 72;

  function drawPageChrome() {
    doc.rect(0, 0, pageWidth, 8).fill(C.plum);
    doc.rect(0, 8, pageWidth, 2).fill(C.gold);
  }

  drawPageChrome();

  const logoBuf = resolveLogoBuffer(identity);
  let y = 24;

  // Header Card Background
  doc.roundedRect(marginX, y, contentWidth, 84, 8).fillAndStroke(C.ivory, C.sand);

  // Right side (RTL): Logo + Brand Name
  let rightTextWidth = 230;
  let rightTextX = marginX + contentWidth - 16 - rightTextWidth;
  if (logoBuf) {
    try {
      doc.image(logoBuf, marginX + contentWidth - 88, y + 12, {
        fit: [72, 60],
        align: "center",
        valign: "center",
      });
      rightTextWidth = 168;
      rightTextX = marginX + contentWidth - 96 - rightTextWidth;
    } catch {
      // Skip unsupported custom image formats gracefully.
    }
  }

  if (brand.ar || brand.en) {
    if (brand.ar) {
      useBold()
        .fontSize(15)
        .fillColor(C.plum)
        .text(prepText(brand.ar), rightTextX, y + 17, {
          width: rightTextWidth,
          ...txtOpts(brand.ar),
        });
    }
    if (brand.en) {
      useReg().fontSize(9.5).fillColor(C.muted).text(brand.en, rightTextX, y + 41, {
        width: rightTextWidth,
        align: "right",
      });
    }
  }

  // Left side (RTL): Doc Type + Title + Status Pill + Reference (kept separate to avoid mixed-script bidi shifts)
  const leftBoxW = 245;
  const leftBoxX = marginX + 16;
  useBold().fontSize(8.5).fillColor(C.gold).text(prepText(docType), leftBoxX, y + 12, {
    width: leftBoxW,
    align: "left",
    ...(hasArabic(docType) ? { features: ARABIC_FEATURES } : {}),
  });
  useBold().fontSize(15.5).fillColor(C.date).text(prepText(title || ""), leftBoxX, y + 25, {
    width: leftBoxW,
    align: "left",
    ...(hasArabic(title) ? { features: ARABIC_FEATURES } : {}),
  });

  const statusText = status ? labels[status] || status : "";
  const refStr = reference ? String(reference) : "";
  let refX = leftBoxX;
  if (statusText) {
    const tone = statusToneColors(status);
    useBold().fontSize(8.5);
    const preppedStatus = prepText(statusText);
    const pillW = Math.min(130, Math.max(54, Math.ceil(doc.widthOfString(preppedStatus, hasArabic(statusText) ? { features: ARABIC_FEATURES } : {}) + 18)));
    doc.roundedRect(leftBoxX, y + 52, pillW, 20, 10).fillAndStroke(tone.bg, tone.border);
    useBold().fontSize(8.5).fillColor(tone.fg).text(preppedStatus, leftBoxX, y + 57, {
      width: pillW,
      align: "center",
      lineBreak: false,
      ...(hasArabic(statusText) ? { features: ARABIC_FEATURES } : {}),
    });
    refX = leftBoxX + pillW + 8;
  }
  if (refStr) {
    useReg().fontSize(9).fillColor(C.muted).text(prepText(refStr), refX, y + 56, {
      width: leftBoxX + leftBoxW - refX,
      align: "left",
      lineBreak: false,
      ...(hasArabic(refStr) ? { features: ARABIC_FEATURES } : {}),
    });
  }

  y += 100;

  // Metadata Summary Cards (2-column RTL grid)
  const cleanFields = fields
    .map((f, i) => parseField(f, i))
    .filter((f) => f.value !== "" && f.value !== "undefined" && f.value !== "null");

  if (cleanFields.length) {
    const gap = 10;
    const colW = (contentWidth - gap) / 2;
    for (let i = 0; i < cleanFields.length; i += 2) {
      const pair = cleanFields.slice(i, i + 2);
      const rowHeight = Math.max(
        ...pair.map((item) => {
          useBold().fontSize(10);
          const vh = doc.heightOfString(prepText(item.value), {
            width: colW - 24,
            ...txtOpts(item.value),
          });
          return Math.max(38, vh + 24);
        }),
      );
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        drawPageChrome();
        y = 30;
      }
      pair.forEach((item, colIdx) => {
        const bx = colIdx === 0 ? marginX + colW + gap : marginX;
        doc.roundedRect(bx, y, colW, rowHeight, 6).fillAndStroke(C.ivory, C.sand);
        useReg()
          .fontSize(8.5)
          .fillColor(C.muted)
          .text(prepText(item.label), bx + 12, y + 6, {
            width: colW - 24,
            ...txtOpts(item.label),
          });
        useBold()
          .fontSize(10)
          .fillColor(C.text)
          .text(prepText(item.value), bx + 12, y + 19, {
            width: colW - 24,
            ...txtOpts(item.value),
          });
      });
      y += rowHeight + 8;
    }
    y += 6;
  }

  // Executive RTL Table
  const cols = [
    { key: "total", label: "الإجمالي (د.ك)", x: marginX, w: 105, align: "left" },
    { key: "price", label: "سعر الوحدة (د.ك)", x: marginX + 105, w: 100, align: "left" },
    { key: "qty", label: "الكمية", x: marginX + 205, w: 60, align: "center" },
    { key: "title", label: "البيان / الخدمة", x: marginX + 265, w: 250, align: "right" },
  ];

  function drawTableHeader(topY) {
    const h = 28;
    doc.rect(marginX, topY, contentWidth, h).fill(C.plum);
    doc.rect(marginX, topY + h - 2, contentWidth, 2).fill(C.gold);
    useBold().fontSize(9.5).fillColor("#fbf7f2");
    for (const col of cols) {
      doc.text(prepText(col.label), col.x + 10, topY + 8, {
        width: col.w - 20,
        align: col.align,
        features: ARABIC_FEATURES,
      });
    }
    return topY + h;
  }

  if (lines.length) {
    if (y + 58 > bottomLimit) {
      doc.addPage();
      drawPageChrome();
      y = 30;
    }
    y = drawTableHeader(y);

    lines.forEach((line, idx) => {
      const titleStr = String(line.title || line.name || "");
      const qty = Number(line.quantity ?? line.qty ?? 1);
      const unit = Number(line.price || 0);
      const lineTotal = unit * qty;

      const preppedTitle = prepText(titleStr);
      useReg().fontSize(10);
      const textH = doc.heightOfString(preppedTitle, {
        width: cols[3].w - 22,
        ...txtOpts(titleStr),
      });
      const rowH = Math.max(26, textH + 14);

      if (y + rowH > bottomLimit) {
        doc.addPage();
        drawPageChrome();
        y = drawTableHeader(30);
      }

      doc
        .rect(marginX, y, contentWidth, rowH)
        .fillAndStroke(idx % 2 === 1 ? C.ivory : C.surface, C.sand);

      doc.strokeColor(C.sand).lineWidth(0.6);
      for (let c = 1; c < cols.length; c++) {
        doc.moveTo(cols[c].x, y).lineTo(cols[c].x, y + rowH).stroke();
      }

      useReg().fontSize(10).fillColor(C.text);
      doc.text(preppedTitle, cols[3].x + 11, y + 7, {
        width: cols[3].w - 22,
        ...txtOpts(titleStr),
      });
      doc.text(String(qty), cols[2].x + 6, y + 7, {
        width: cols[2].w - 12,
        align: "center",
      });
      doc.text(fmtMoney(unit), cols[1].x + 10, y + 7, {
        width: cols[1].w - 20,
        align: "left",
      });
      useBold().fontSize(10).fillColor(C.date).text(fmtMoney(lineTotal), cols[0].x + 10, y + 7, {
        width: cols[0].w - 20,
        align: "left",
      });

      y += rowH;
    });
    y += 14;
  }

  // Financial Total Bar
  if (total !== undefined && total !== null && total !== "") {
    const boxH = 42;
    if (y + boxH > bottomLimit) {
      doc.addPage();
      drawPageChrome();
      y = 30;
    }
    doc.roundedRect(marginX, y, contentWidth, boxH, 7).fillAndStroke(C.cream, C.gold);
    doc.rect(marginX + contentWidth - 5, y, 5, boxH).fill(C.date);
    useBold().fontSize(11).fillColor(C.date).text(prepText("الإجمالي المعتمد"), marginX + 185, y + 13, {
      width: contentWidth - 205,
      align: "right",
      features: ARABIC_FEATURES,
    });
    useBold().fontSize(14).fillColor(C.plum).text(`${fmtMoney(total)} KWD`, marginX + 16, y + 11, {
      width: 170,
      align: "left",
    });
    y += boxH + 14;
  }

  // Notes / Legal Clauses Cards
  const cleanNotes = notes.map((n) => String(n ?? "").trim()).filter(Boolean);
  if (cleanNotes.length) {
    if (y + 48 > bottomLimit) {
      doc.addPage();
      drawPageChrome();
      y = 30;
    }
    useBold().fontSize(11).fillColor(C.date).text(prepText("الشروط والملاحظات"), marginX, y, {
      width: contentWidth - 4,
      align: "right",
      features: ARABIC_FEATURES,
    });
    y += 20;

    for (const note of cleanNotes) {
      const preppedNote = prepText(note);
      useReg().fontSize(9.5);
      const nh = doc.heightOfString(preppedNote, {
        width: contentWidth - 26,
        ...txtOpts(note, { lineGap: 3 }),
      });
      const cardH = Math.max(28, nh + 14);
      if (y + cardH > bottomLimit) {
        doc.addPage();
        drawPageChrome();
        y = 30;
      }
      doc.roundedRect(marginX, y, contentWidth, cardH, 6).fillAndStroke(C.ivory, C.sand);
      useReg()
        .fontSize(9.5)
        .fillColor(C.text)
        .text(preppedNote, marginX + 13, y + 7, {
          width: contentWidth - 26,
          ...txtOpts(note, { lineGap: 3 }),
        });
      y += cardH + 7;
    }
  }

  // Repeating Institutional Footer with Page X / Total (avoiding bottom-margin page break triggers)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = pageHeight - 36;
    doc.strokeColor(C.gold).lineWidth(0.8).moveTo(marginX, fy - 7).lineTo(pageWidth - marginX, fy - 7).stroke();
    useReg().fontSize(8.5).fillColor(C.muted);
    doc.text(prepText(footerNote), marginX + 95, fy, {
      width: contentWidth - 95,
      align: "right",
      lineBreak: false,
      ...(hasArabic(footerNote) ? { features: ARABIC_FEATURES } : {}),
    });
    doc.text(`${i + 1} / ${range.count}`, marginX, fy, {
      width: 90,
      align: "left",
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return doc;
}
