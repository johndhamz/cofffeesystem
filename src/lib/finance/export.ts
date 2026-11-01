import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toCsv } from "./calculations";
import { formatPHP, toCentavos } from "@/lib/money";
import { formatWeight } from "@/lib/units";
import type { ReportResult } from "@/server/services/reports.service";

function formatCell(value: unknown, kind?: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "money") return formatPHP(toCentavos(value as number | string)).replace("₱", "PHP ");
  if (kind === "weight") return formatWeight(Number(value));
  if (kind === "pct") return `${value}%`;
  return String(value);
}

export function reportToCsv(report: ReportResult): string {
  const headers = report.columns.map((c) => c.label);
  const rows = report.rows.map((r) =>
    report.columns.map((c) =>
      c.kind === "money" || c.kind === "pct" || c.kind === "int" || c.kind === "weight"
        ? (r[c.key] ?? "")
        : (r[c.key] ?? ""),
    ),
  );
  if (report.totals) rows.push(report.columns.map((c) => report.totals?.[c.key] ?? ""));
  const extra =
    report.key === "profitability" && report.totals
      ? [
          [],
          ["Operating expenses", report.totals.operating_expenses],
          ["Operating result", report.totals.operating_result],
          ["Refunds", report.totals.refunds],
          ["Orders", report.totals.orders],
        ]
      : [];
  return (
    `${report.title}\r\nPeriod,${report.range.from},${report.range.to}\r\n${report.note ? `Note,"${report.note.replace(/"/g, '""')}"\r\n` : ""}\r\n` +
    toCsv(headers, [...rows, ...extra])
  );
}

/** Simple landscape table PDF with pagination; fonts are standard Helvetica (no embedding needed). */
export async function reportToPdf(report: ReportResult, businessName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 842;
  const pageH = 595;
  const margin = 36;
  const rowH = 14;
  const fontSize = 8;
  const colW = (pageW - margin * 2) / report.columns.length;
  const allRows = [
    ...report.rows,
    ...(report.totals ? [{ __totals: true, ...report.totals }] : []),
  ];
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;
  const header = () => {
    page.drawText(businessName, { x: margin, y, size: 12, font: bold });
    page.drawText(`${report.title} · ${report.range.from} to ${report.range.to}`, {
      x: margin,
      y: y - 14,
      size: 9,
      font,
    });
    y -= 34;
    report.columns.forEach((c, i) => {
      const x = margin + i * colW;
      const text = c.label;
      const w = bold.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: c.align === "right" ? x + colW - w - 2 : x,
        y,
        size: fontSize,
        font: bold,
      });
    });
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= rowH;
  };
  header();
  for (const row of allRows) {
    if (y < margin + rowH) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      header();
    }
    const isTotals = "__totals" in row;
    const f = isTotals ? bold : font;
    report.columns.forEach((c, i) => {
      const x = margin + i * colW;
      let text = formatCell(row[c.key], c.kind);
      while (f.widthOfTextAtSize(text, fontSize) > colW - 4 && text.length > 3)
        text = text.slice(0, -2) + "…";
      const w = f.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: c.align === "right" ? x + colW - w - 2 : x,
        y,
        size: fontSize,
        font: f,
      });
    });
    y -= rowH;
  }
  if (report.key === "profitability" && report.totals) {
    y -= rowH;
    const lines = [
      ["Operating expenses", formatCell(report.totals.operating_expenses, "money")],
      ["Operating result", formatCell(report.totals.operating_result, "money")],
      ["Refunds issued", formatCell(report.totals.refunds, "money")],
      ["Orders", String(report.totals.orders ?? 0)],
    ];
    for (const [k, v] of lines) {
      if (y < margin + rowH) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(k, { x: margin, y, size: 9, font: bold });
      page.drawText(v, { x: margin + 200, y, size: 9, font });
      y -= rowH;
    }
  }
  if (report.note) {
    y -= rowH;
    if (y < margin + rowH) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    page.drawText(report.note, {
      x: margin,
      y,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
      maxWidth: pageW - margin * 2,
      lineHeight: 9,
    });
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(
      `Generated ${new Date().toISOString().slice(0, 10)} · page ${i + 1} of ${pages.length} · management report, not a statutory statement`,
      { x: margin, y: margin / 2, size: 7, font, color: rgb(0.5, 0.5, 0.5) },
    ),
  );
  return doc.save();
}
