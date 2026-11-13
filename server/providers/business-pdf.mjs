import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { branding } from "../../src/branding.mjs";

let documentFont;
export function businessPDF({settings,title,reference,fields=[],lines=[],total,notes=[]}) {
  const document = new PDFDocument({ size:"A4", margin:48, info:{ Title:title, Author:branding(settings).title || "Habb Alsaad" } });
  if (!documentFont) {
    try { documentFont = readFileSync(new URL("../../dist/assets/font1.woff2",import.meta.url)); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      documentFont = readFileSync(new URL("../../public/assets/font1.woff2",import.meta.url));
    }
  }
  document.font(documentFont);
  function write(text,size=11,color="#4b2a35") {
    document.fontSize(size).fillColor(color).text(String(text ?? ""),{align:"right",lineGap:5});
  }
  write(branding(settings).title,16);
  write(title,23);
  write(reference,10);
  document.moveDown();
  for (const field of fields) write(field);
  document.moveDown();
  for (const line of lines) {
    write(line.title,13);
    write(line.quantity+" × "+Number(line.price).toFixed(3)+" KWD",10);
    document.moveDown(0.5);
  }
  write("الإجمالي  "+Number(total).toFixed(3)+" KWD",15);
  document.moveDown();
  for (const note of notes.filter(Boolean)) write(note);
  document.end();
  return document;
}
