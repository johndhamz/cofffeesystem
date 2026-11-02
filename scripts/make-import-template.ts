/** Builds public/templates/sales-history-template.xlsx. Run: npm run template:sales */
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coffee Roastery OS";
  const sales = wb.addWorksheet("Sales", { views: [{ state: "frozen", ySplit: 1 }] });
  sales.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Channel", key: "channel", width: 14 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Product", key: "product", width: 24 },
    { header: "Variant", key: "variant", width: 14 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit price", key: "unit_price", width: 11 },
    { header: "Unit cost", key: "unit_cost", width: 10 },
    { header: "Paid", key: "paid", width: 8 },
    { header: "Payment method", key: "payment_method", width: 16 },
    { header: "Reference", key: "reference", width: 14 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  sales.getRow(1).font = { bold: true };
  sales.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5E9DA" } };
  const examples = [
    ["2026-09-03", "Walk-in", "", "House Blend", "250 g", 2, 350, 180, "yes", "cash", "", ""],
    ["2026-09-03", "Walk-in", "", "Benguet Washed", "250 g", 1, 420, 210, "yes", "gcash", "", ""],
    [
      "2026-09-05",
      "Wholesale",
      "Cafe Luna",
      "House Blend",
      "1 kg",
      5,
      1100,
      640,
      "no",
      "bank_transfer",
      "INV-0912",
      "30-day terms",
    ],
  ];
  examples.forEach((r) => sales.addRow(r));
  for (let r = 2; r <= 4; r++) sales.getRow(r).font = { italic: true, color: { argb: "FF6B7280" } };
  sales.getColumn("date").numFmt = "yyyy-mm-dd";
  sales.getColumn("unit_price").numFmt = "#,##0.00";
  sales.getColumn("unit_cost").numFmt = "#,##0.00";
  for (let r = 2; r <= 2000; r++) {
    sales.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"yes,no"'],
    };
    sales.getCell(`J${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"cash,bank_transfer,gcash,maya,other"'],
    };
    sales.getCell(`F${r}`).dataValidation = {
      type: "whole",
      operator: "greaterThan",
      formulae: [0],
      allowBlank: true,
    };
  }

  const help = wb.addWorksheet("Instructions");
  help.columns = [{ width: 18 }, { width: 100 }];
  const lines: [string, string][] = [
    [
      "How it works",
      "Each row is one product line sold. Rows with the same Date + Channel + Customer + Reference are combined into ONE order.",
    ],
    [
      "Date",
      "Sale date as an Excel date or text YYYY-MM-DD. Revenue and cost of goods are recorded on this date.",
    ],
    [
      "Channel",
      "Must match a sales channel name in Settings → Sales channels (e.g. Walk-in, Facebook, Shopee, Wholesale).",
    ],
    [
      "Customer",
      "Optional. Created automatically if it does not exist yet. Leave blank for anonymous walk-in sales.",
    ],
    [
      "Product / Variant",
      "Must match your Products catalog: product name plus the variant name or SKU (e.g. 250 g). Variant can be blank when the product has a single variant.",
    ],
    ["Quantity", "Whole number of units (bags) sold."],
    [
      "Unit price",
      "Selling price per unit in pesos (what the customer paid, before any order discount).",
    ],
    [
      "Unit cost",
      "Optional but recommended: what one unit cost you to make. Used to create opening stock so profit reports are right. Blank = ₱0 cost.",
    ],
    ["Paid", "yes (default) or no. 'yes' records a payment for the whole line on the sale date."],
    ["Payment method", "cash, bank_transfer, gcash, maya or other. Default cash."],
    ["Reference", "Optional receipt / invoice number. Also used to group rows into one order."],
    ["Notes", "Optional, saved on the order."],
    [
      "Before importing",
      "Create the products, variants and channels first. Delete the three grey example rows. Then Sales → Import history → Check file.",
    ],
    [
      "Safety",
      "The import shows every order before saving. Running the same file twice never duplicates orders. Imported orders cannot be edited afterwards; use a return or a reversal.",
    ],
  ];
  lines.forEach(([k, v]) => help.addRow([k, v]));
  help.getColumn(1).font = { bold: true };
  help.eachRow((row) => (row.alignment = { wrapText: true, vertical: "top" }));

  mkdirSync("public/templates", { recursive: true });
  await wb.xlsx.writeFile("public/templates/sales-history-template.xlsx");
  console.log("wrote public/templates/sales-history-template.xlsx");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
