/**
 * Zero-dependency Office Open XML (.xlsx) workbook generator for Browser & Node.js.
 * Produces styled RTL Arabic/English spreadsheets with KWD 3-decimal formats,
 * auto-fitted columns, zebra striping, borders, frozen headers, and formula safety.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

function escapeXML(v) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeExcelText(v) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function colRef(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sanitizeSheetName(name, idx, used) {
  let base = String(name || `Sheet${idx + 1}`).replace(/[:\\/?*\[\]]/g, " ").trim() || `Sheet${idx + 1}`;
  base = base.slice(0, 31);
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` ${n++}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

const STATUS_STYLE = {
  // Success / Approved / Settled / Active
  CONFIRMED: 14, CONFIRMED_SUPPLIER: 14, SIGNED: 14, PAID: 14, COMPLETED: 14,
  CONTRACT_APPROVED: 14, APPROVED: 14, SETTLED: 14, DELIVERED: 14, PUBLISHED: 14,
  RECEIVED: 14, RESOLVED: 14, ACTIVE: 14,
  // Pending / Warning
  PENDING: 15, WAITING: 15, REQUESTED: 15, PAYMENT_PENDING: 15, CREATED: 15,
  REFUND_PENDING: 15, NEEDS_OWNER_APPROVAL: 15, NEEDS_CHANGES: 15,
  SUPPLIER_UNAVAILABLE: 15, DELAYED: 15, IN_REVIEW: 15, SUBMITTING: 15,
  // Error / Cancelled / Rejected
  FAILED: 16, PAYMENT_FAILED: 16, CANCELLED: 16, REJECTED: 16, DISPUTED: 16, BOUNCED: 16,
  // Info / In progress
  QUOTE_READY: 17, CUSTOMER_REVIEW: 17, INTERNAL_REVIEW: 17, SUPPLIER_CONFIRMATION: 17,
  CONTRACT_PENDING: 17, PREPARATION: 17, IN_PROGRESS: 17, SENT: 17, READ: 17, REFUNDED: 17,
  // Draft / Inactive
  DRAFT: 18, EXPIRED: 18, ARCHIVED: 18, INACTIVE: 18,
};

function resolveStatusStyle(raw, label, zebra) {
  const key = String(raw || "").trim();
  if (STATUS_STYLE[key]) return STATUS_STYLE[key];
  const ar = String(label || raw || "");
  if (/مؤكد|مكتمل|مدفوع|موقّع|معتمد|تم التحويل|نشط|مستلم/.test(ar)) return 14;
  if (/ملغي|ملغى|مرفوض|فشل|تعذر|إيقاف|موقوف/.test(ar)) return 16;
  if (/بانتظار|معلق|تعديل|متأخر|تحقق/.test(ar)) return 15;
  if (/مسودة|منتهي|مؤرشف/.test(ar)) return 18;
  return zebra ? 5 : 4;
}

function measureWidth(text, type) {
  const s = String(text ?? "");
  let len = 0;
  for (const ch of s) len += /[\u0600-\u06ff]/.test(ch) ? 1.25 : 1;
  if (type === "currency") len = Math.max(len, 14);
  return len;
}

function buildStylesXML() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="#,##0.000 &quot;د.ك&quot;"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
    <numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/>
  </numFmts>
  <fonts count="9">
    <font><sz val="11"/><color rgb="FF2D2424"/><name val="Tajawal"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Tajawal"/></font>
    <font><b/><sz val="10"/><color rgb="FF5A2D2D"/><name val="Tajawal"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tajawal"/></font>
    <font><b/><sz val="11"/><color rgb="FF3E2428"/><name val="Tajawal"/></font>
    <font><b/><sz val="10"/><color rgb="FF1B5E3C"/><name val="Tajawal"/></font>
    <font><b/><sz val="10"/><color rgb="FF8C5008"/><name val="Tajawal"/></font>
    <font><b/><sz val="10"/><color rgb="FF932A2A"/><name val="Tajawal"/></font>
    <font><b/><sz val="10"/><color rgb="FF1F4F73"/><name val="Tajawal"/></font>
  </fonts>
  <fills count="12">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF3E2428"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7EEE4"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF5A2D2D"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFBF7F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2DED4"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7F5EE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDF3E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFBEAEA"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEBF3FA"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFDFCFC0"/></left>
      <right style="thin"><color rgb="FFDFCFC0"/></right>
      <top style="thin"><color rgb="FFDFCFC0"/></top>
      <bottom style="thin"><color rgb="FFDFCFC0"/></bottom>
      <diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF5A2D2D"/></left>
      <right style="thin"><color rgb="FF5A2D2D"/></right>
      <top style="thin"><color rgb="FF5A2D2D"/></top>
      <bottom style="medium"><color rgb="FFC69A61"/></bottom>
      <diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFDFCFC0"/></left>
      <right style="thin"><color rgb="FFDFCFC0"/></right>
      <top style="thin"><color rgb="FF5A2D2D"/></top>
      <bottom style="double"><color rgb="FF3E2428"/></bottom>
      <diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="19">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="7" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="4" fillId="7" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="11" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function renderCell(ref, style, value, type) {
  if ((type === "currency" || type === "number") && value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
    return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  }
  const safe = safeExcelText(value);
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXML(safe)}</t></is></c>`;
}

function buildSheetXML(sheet) {
  const columns = sheet.columns || [];
  const rows = sheet.rows || [];
  const colCount = Math.max(1, columns.length);
  const lastCol = colRef(colCount - 1);
  const widths = columns.map((c, idx) => {
    let w = measureWidth(c.header, c.type) + 6;
    for (const r of rows) {
      const cell = Array.isArray(r) ? r[idx] : r?.[c.key];
      const text = cell && typeof cell === "object" && "label" in cell ? cell.label : cell;
      w = Math.max(w, measureWidth(text, c.type) + 4);
    }
    if (sheet.totals?.[idx] !== undefined && sheet.totals?.[idx] !== null) {
      w = Math.max(w, measureWidth(sheet.totals[idx], c.type) + 4);
    }
    return Math.min(54, Math.max(c.width || 13, Math.ceil(w)));
  });

  const merges = [];
  const rowXml = [];
  let rowIndex = 1;

  if (sheet.title) {
    const titleCells = [renderCell(`A${rowIndex}`, 1, sheet.title, "text")];
    for (let c = 1; c < colCount; c++) titleCells.push(`<c r="${colRef(c)}${rowIndex}" s="1"/>`);
    rowXml.push(`<row r="${rowIndex}" ht="30" customHeight="1">${titleCells.join("")}</row>`);
    if (colCount > 1) merges.push(`A${rowIndex}:${lastCol}${rowIndex}`);
    rowIndex++;
  }
  if (sheet.subtitle) {
    const subCells = [renderCell(`A${rowIndex}`, 2, sheet.subtitle, "text")];
    for (let c = 1; c < colCount; c++) subCells.push(`<c r="${colRef(c)}${rowIndex}" s="2"/>`);
    rowXml.push(`<row r="${rowIndex}" ht="22" customHeight="1">${subCells.join("")}</row>`);
    if (colCount > 1) merges.push(`A${rowIndex}:${lastCol}${rowIndex}`);
    rowIndex++;
  }

  const headerRowIndex = rowIndex;
  const headerCells = columns.map((c, idx) => renderCell(`${colRef(idx)}${rowIndex}`, 3, c.header, "text"));
  rowXml.push(`<row r="${rowIndex}" ht="26" customHeight="1">${headerCells.join("")}</row>`);
  rowIndex++;

  rows.forEach((r, rIdx) => {
    const zebra = rIdx % 2 === 1;
    const cells = columns.map((c, cIdx) => {
      const raw = Array.isArray(r) ? r[cIdx] : r?.[c.key];
      let val = raw;
      let statusCode = raw;
      if (raw && typeof raw === "object" && "label" in raw) {
        val = raw.label;
        statusCode = raw.code ?? raw.label;
      }
      let style = zebra ? 5 : 4;
      if (c.type === "currency") style = zebra ? 7 : 6;
      else if (c.type === "number") style = zebra ? 9 : 8;
      else if (c.type === "date" || c.type === "code") style = zebra ? 11 : 10;
      else if (c.type === "status") style = resolveStatusStyle(statusCode, val, zebra);
      return renderCell(`${colRef(cIdx)}${rowIndex}`, style, val, c.type);
    });
    rowXml.push(`<row r="${rowIndex}" ht="22" customHeight="1">${cells.join("")}</row>`);
    rowIndex++;
  });

  if (sheet.totals && sheet.totals.length) {
    const totalCells = columns.map((c, cIdx) => {
      const val = sheet.totals[cIdx];
      const isCurrency = c.type === "currency";
      const isNumber = c.type === "number";
      const style = isCurrency ? 13 : isNumber ? 12 : 12;
      return renderCell(`${colRef(cIdx)}${rowIndex}`, style, val ?? "", isCurrency ? "currency" : isNumber ? "number" : "text");
    });
    rowXml.push(`<row r="${rowIndex}" ht="25" customHeight="1">${totalCells.join("")}</row>`);
  }

  const colsXml = widths.map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`).join("");
  const lastDataRow = headerRowIndex + rows.length;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0" rightToLeft="1">
      <pane ySplit="${headerRowIndex}" topLeftCell="A${headerRowIndex + 1}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="21"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowXml.join("")}</sheetData>
  ${rows.length ? `<autoFilter ref="A${headerRowIndex}:${lastCol}${lastDataRow}"/>` : ""}
  ${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

function packZipStore(files) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = typeof file.content === "string" ? enc.encode(file.content) : file.content;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    localChunks.push(local, data);
    centralChunks.push(central);
    offset += local.length + data.length;
  }

  let centralSize = 0;
  for (const c of centralChunks) centralSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let cursor = 0;
  for (const chunk of localChunks) { archive.set(chunk, cursor); cursor += chunk.length; }
  for (const chunk of centralChunks) { archive.set(chunk, cursor); cursor += chunk.length; }
  archive.set(eocd, cursor);
  return archive;
}

/**
 * Build a multi-sheet .xlsx workbook as Uint8Array.
 * @param {{ sheets: Array<{ name: string, title?: string, subtitle?: string, columns: Array<{ key?: string, header: string, type?: string, width?: number }>, rows: Array<any>, totals?: Array<any> }> }} spec
 */
export function generateXlsx({ sheets }) {
  const usedNames = new Set();
  const normalized = (sheets && sheets.length ? sheets : [{ name: "البيانات", columns: [{ header: "البيان" }], rows: [] }])
    .map((s, idx) => ({ ...s, safeName: sanitizeSheetName(s.name, idx, usedNames) }));

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${normalized.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookViews><workbookView activeTab="0"/></workbookViews>
  <sheets>
    ${normalized.map((s, i) => `<sheet name="${escapeXML(s.safeName)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${normalized.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
  <Relationship Id="rId${normalized.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: buildStylesXML(),
    },
  ];

  normalized.forEach((sheet, i) => {
    files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: buildSheetXML(sheet),
    });
  });

  return packZipStore(files);
}

/**
 * Browser download helper for .xlsx workbooks.
 */
export function downloadXlsx(filename, workbookSpec) {
  const bytes = generateXlsx(workbookSpec);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
