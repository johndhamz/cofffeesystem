import { z } from "zod";
import { toCentavos } from "@/lib/money";

const pesos = (cents: number) => Math.round(cents) / 100;

/** Column headers of the Excel template (sheet "Sales"), matched case-insensitively. */
export const IMPORT_COLUMNS = [
  "Date",
  "Channel",
  "Customer",
  "Product",
  "Variant",
  "Quantity",
  "Unit price",
  "Unit cost",
  "Paid",
  "Payment method",
  "Reference",
  "Notes",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "gcash", "maya", "other"] as const;

/** One spreadsheet row as text (already read from the workbook). */
export interface RawRow {
  rowNumber: number;
  values: Partial<Record<ImportColumn, string>>;
}

const yesNo = z.preprocess(
  (v) => {
    const s = String(v ?? "")
      .trim()
      .toLowerCase();
    if (s === "" || ["yes", "y", "true", "paid", "1"].includes(s)) return true;
    if (["no", "n", "false", "unpaid", "0"].includes(s)) return false;
    return s;
  },
  z.boolean({ error: "Paid must be yes or no" }),
);

const money = z.coerce.number({ error: "must be a number" }).min(0, "cannot be negative");

export const importRowSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD (or an Excel date cell)"),
  channel: z.string().trim().min(1, "Channel is required"),
  customer: z.string().trim().max(120).optional().default(""),
  product: z.string().trim().min(1, "Product is required"),
  variant: z.string().trim().max(120).optional().default(""),
  quantity: z.coerce
    .number({ error: "Quantity must be a whole number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
  unit_price: money,
  unit_cost: z.preprocess((v) => (String(v ?? "").trim() === "" ? undefined : v), money.optional()),
  paid: yesNo.default(true),
  payment_method: z.preprocess(
    (v) => {
      const s = String(v ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
      return s === "" ? "cash" : s === "bank" ? "bank_transfer" : s;
    },
    z.enum(PAYMENT_METHODS, {
      error: "Payment method must be cash, bank_transfer, gcash, maya or other",
    }),
  ),
  reference: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});
export type ImportRow = z.output<typeof importRowSchema>;

export interface RowError {
  rowNumber: number;
  message: string;
}

/** Validates the text cells of one row into a typed row, or returns the problems found. */
export function parseRow(
  raw: RawRow,
): { row: ImportRow; errors: [] } | { row: null; errors: RowError[] } {
  const v = raw.values;
  const result = importRowSchema.safeParse({
    date: v.Date ?? "",
    channel: v.Channel ?? "",
    customer: v.Customer ?? "",
    product: v.Product ?? "",
    variant: v.Variant ?? "",
    quantity: v.Quantity ?? "",
    unit_price: v["Unit price"] ?? "",
    unit_cost: v["Unit cost"] ?? "",
    paid: v.Paid ?? "",
    payment_method: v["Payment method"] ?? "",
    reference: v.Reference ?? "",
    notes: v.Notes ?? "",
  });
  if (result.success) return { row: result.data, errors: [] };
  return {
    row: null,
    errors: result.error.issues.map((i) => ({
      rowNumber: raw.rowNumber,
      message: `${String(i.path[0] ?? "row")}: ${i.message}`,
    })),
  };
}

/** A row whose names were matched to catalog ids. */
export interface ResolvedRow extends ImportRow {
  rowNumber: number;
  variant_id: string;
  variant_label: string;
  sales_channel_id: string;
}

export interface PlannedItem {
  product_variant_id: string;
  label: string;
  quantity: number;
  unit_price: number;
}

export interface PlannedOrder {
  key: string;
  ordered_at: string;
  sales_channel_id: string;
  channel: string;
  customer_name: string | null;
  notes: string | null;
  payment_method: (typeof PAYMENT_METHODS)[number];
  payment_reference: string | null;
  paid_amount: number;
  total: number;
  items: PlannedItem[];
  rowNumbers: number[];
}

export interface OpeningLot {
  variant_id: string;
  label: string;
  quantity: number;
  unit_cost: number;
  packaged_at: string;
  cost_known: boolean;
}

/** Rows sharing date + channel + customer + reference become one order. */
export function orderKey(r: ImportRow): string {
  return [
    r.date,
    r.channel.toLowerCase(),
    r.customer.toLowerCase(),
    r.reference.toLowerCase(),
  ].join("|");
}

export function groupOrders(rows: ResolvedRow[]): PlannedOrder[] {
  const map = new Map<string, PlannedOrder>();
  for (const r of rows) {
    const k = orderKey(r);
    let o = map.get(k);
    if (!o) {
      o = {
        key: `${map.size + 1}`,
        ordered_at: r.date,
        sales_channel_id: r.sales_channel_id,
        channel: r.channel,
        customer_name: r.customer || null,
        notes: r.notes || null,
        payment_method: r.payment_method,
        payment_reference: r.reference || null,
        paid_amount: 0,
        total: 0,
        items: [],
        rowNumbers: [],
      };
      map.set(k, o);
    }
    const price = pesos(toCentavos(r.unit_price));
    const line = pesos(toCentavos(r.unit_price) * r.quantity);
    const existing = o.items.find(
      (i) => i.product_variant_id === r.variant_id && i.unit_price === price,
    );
    if (existing) existing.quantity += r.quantity;
    else
      o.items.push({
        product_variant_id: r.variant_id,
        label: r.variant_label,
        quantity: r.quantity,
        unit_price: price,
      });
    o.total = pesos(toCentavos(o.total) + toCentavos(line));
    if (r.paid) o.paid_amount = pesos(toCentavos(o.paid_amount) + toCentavos(line));
    o.rowNumbers.push(r.rowNumber);
    if (r.notes && !o.notes) o.notes = r.notes;
  }
  // deterministic keys: by date then first row
  const orders = [...map.values()].sort(
    (a, b) => a.ordered_at.localeCompare(b.ordered_at) || a.rowNumbers[0] - b.rowNumbers[0],
  );
  orders.forEach((o, i) => (o.key = `${i + 1}`));
  return orders;
}

/**
 * Opening stock to create per variant: the full quantity sold in the file, dated at the earliest
 * sale, so historical sales consume historical stock (never today's real lots). Unit cost is the
 * quantity-weighted average of the "Unit cost" cells for that variant; 0 (flagged) when none.
 */
export function planOpeningStock(rows: ResolvedRow[]): OpeningLot[] {
  const byVariant = new Map<
    string,
    { label: string; qty: number; costC: number; costQty: number; first: string }
  >();
  for (const r of rows) {
    const e = byVariant.get(r.variant_id) ?? {
      label: r.variant_label,
      qty: 0,
      costC: 0,
      costQty: 0,
      first: r.date,
    };
    e.qty += r.quantity;
    if (r.unit_cost !== undefined) {
      e.costC += toCentavos(r.unit_cost) * r.quantity;
      e.costQty += r.quantity;
    }
    if (r.date < e.first) e.first = r.date;
    byVariant.set(r.variant_id, e);
  }
  return [...byVariant.entries()]
    .map(([variant_id, e]) => ({
      variant_id,
      label: e.label,
      quantity: e.qty,
      unit_cost: e.costQty > 0 ? Math.round(e.costC / e.costQty) / 100 : 0,
      packaged_at: e.first,
      cost_known: e.costQty > 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Case/space-insensitive name matching used for channels, products and variants. */
export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
