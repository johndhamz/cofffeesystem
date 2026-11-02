import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { Errors, fromDatabaseError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { salesRepository } from "@/server/repositories/sales.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { settingsRepository } from "@/server/repositories/settings.repository";
import {
  IMPORT_COLUMNS,
  PAYMENT_METHODS,
  groupOrders,
  norm,
  parseRow,
  planOpeningStock,
  type ImportColumn,
  type OpeningLot,
  type PlannedOrder,
  type RawRow,
  type ResolvedRow,
  type RowError,
} from "@/lib/sales/history-import";

export interface ImportPreview {
  batchKey: string;
  fileName: string;
  locationId: string;
  rowCount: number;
  errors: RowError[];
  warnings: string[];
  orders: PlannedOrder[];
  opening: OpeningLot[];
  totals: { orders: number; units: number; revenue: number; paid: number };
}

const MAX_ROWS = 5000;

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined && v.result !== null)
      return cellText({ value: v.result } as ExcelJS.Cell);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  if (typeof v === "number" && cell.numFmt && /[dmy]/i.test(cell.numFmt) && v > 20000) {
    // Excel serial date not auto-converted
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  return String(v).trim();
}

/** Reads the "Sales" sheet (or the first sheet) into text rows keyed by template column. */
export async function readWorkbook(buffer: ArrayBuffer): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet("Sales") ?? wb.worksheets[0];
  if (!sheet) throw Errors.validation("The workbook has no sheets.");
  const header = sheet.getRow(1);
  const colIndex = new Map<ImportColumn, number>();
  header.eachCell((cell, n) => {
    const name = IMPORT_COLUMNS.find((c) => norm(c) === norm(cellText(cell)));
    if (name) colIndex.set(name, n);
  });
  const missing = (
    ["Date", "Channel", "Product", "Quantity", "Unit price"] as ImportColumn[]
  ).filter((c) => !colIndex.has(c));
  if (missing.length)
    throw Errors.validation(`Missing columns: ${missing.join(", ")}. Use the template.`);
  const rows: RawRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Partial<Record<ImportColumn, string>> = {};
    let any = false;
    for (const [name, idx] of colIndex) {
      const t = cellText(row.getCell(idx));
      if (t) any = true;
      values[name] = t;
    }
    if (any) rows.push({ rowNumber: r, values });
    if (rows.length > MAX_ROWS)
      throw Errors.validation(`Too many rows (limit ${MAX_ROWS}); split the file.`);
  }
  return rows;
}

export async function previewSalesImport(
  file: File,
  locationId: string | null,
): Promise<ImportPreview> {
  const ctx = await requirePermission("sales.manage");
  await requirePermission("inventory.adjust");
  if (!file || file.size === 0) throw Errors.validation("Choose an .xlsx file.");
  if (file.size > 5 * 1024 * 1024) throw Errors.validation("File is larger than 5 MB.");
  const buffer = await file.arrayBuffer();
  const batchKey = createHash("sha256").update(Buffer.from(buffer)).digest("hex").slice(0, 16);
  const raw = await readWorkbook(buffer);
  if (raw.length === 0) throw Errors.validation("The sheet has no data rows under the header.");

  const db = await createSupabaseServerClient();
  const bid = ctx.business.businessId;
  const [channels, variants, locations, settings] = await Promise.all([
    masterDataRepository(db, "sales_channels").listActive(bid),
    salesRepository(db).variantAvailability(bid),
    masterDataRepository(db, "inventory_locations").listActive(bid),
    settingsRepository(db).getByBusiness(bid),
  ]);
  const location =
    locations.find((l) => l.id === (locationId ?? settings.default_location_id)) ?? locations[0];
  if (!location) throw Errors.validation("Create an inventory location first.");

  const errors: RowError[] = [];
  const warnings = new Set<string>();
  const resolved: ResolvedRow[] = [];
  for (const r of raw) {
    const parsed = parseRow(r);
    if (!parsed.row) {
      errors.push(...parsed.errors);
      continue;
    }
    const row = parsed.row;
    const channel = channels.find((c) => norm(c.name) === norm(row.channel));
    if (!channel) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `Channel "${row.channel}" not found (Settings → Sales channels)`,
      });
      continue;
    }
    const candidates = variants.filter((v) => norm(v.product_name ?? "") === norm(row.product));
    if (candidates.length === 0) {
      errors.push({
        rowNumber: r.rowNumber,
        message: `Product "${row.product}" not found (Products)`,
      });
      continue;
    }
    const variant = row.variant
      ? candidates.find(
          (v) =>
            norm(v.variant_name ?? "") === norm(row.variant) ||
            norm(v.sku ?? "") === norm(row.variant),
        )
      : candidates.length === 1
        ? candidates[0]
        : undefined;
    if (!variant || !variant.variant_id) {
      errors.push({
        rowNumber: r.rowNumber,
        message: row.variant
          ? `Variant "${row.variant}" of "${row.product}" not found (use the variant name or SKU)`
          : `"${row.product}" has ${candidates.length} variants; fill the Variant column`,
      });
      continue;
    }
    if (row.unit_cost === undefined)
      warnings.add(
        "Some rows have no Unit cost: their opening stock is costed at ₱0, so profit on those sales will be overstated.",
      );
    resolved.push({
      ...row,
      rowNumber: r.rowNumber,
      variant_id: variant.variant_id,
      variant_label: `${variant.product_name} — ${variant.variant_name}`,
      sales_channel_id: channel.id,
    });
  }

  const orders = groupOrders(resolved);
  const opening = planOpeningStock(resolved);
  const today = new Date().toISOString().slice(0, 10);
  if (resolved.some((r) => r.date > today)) warnings.add("Some dates are in the future.");
  const totals = {
    orders: orders.length,
    units: orders.reduce((s, o) => s + o.items.reduce((t, i) => t + i.quantity, 0), 0),
    revenue: Math.round(orders.reduce((s, o) => s + o.total * 100, 0)) / 100,
    paid: Math.round(orders.reduce((s, o) => s + o.paid_amount * 100, 0)) / 100,
  };
  return {
    batchKey,
    fileName: file.name,
    locationId: location.id,
    rowCount: raw.length,
    errors,
    warnings: [...warnings],
    orders,
    opening,
    totals,
  };
}

const commitSchema = z.object({
  batchKey: z.string().regex(/^[a-f0-9]{16}$/),
  locationId: z.uuid(),
  opening: z.array(
    z.object({
      variant_id: z.uuid(),
      quantity: z.number().int().positive(),
      unit_cost: z.number().min(0),
      packaged_at: z.string(),
    }),
  ),
  orders: z.array(
    z.object({
      key: z.string().min(1),
      ordered_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sales_channel_id: z.uuid(),
      customer_name: z.string().max(120).nullable(),
      notes: z.string().max(2000).nullable(),
      payment_method: z.enum(PAYMENT_METHODS),
      payment_reference: z.string().max(120).nullable(),
      paid_amount: z.number().min(0),
      items: z
        .array(
          z.object({
            product_variant_id: z.uuid(),
            quantity: z.number().int().positive(),
            unit_price: z.number().min(0),
          }),
        )
        .min(1),
    }),
  ),
});
export type ImportCommit = z.input<typeof commitSchema>;

export interface ImportResult {
  orders_created: number;
  orders_skipped: number;
  lots_created: number;
  units: number;
  revenue: number;
}

/** Runs the whole import in one database transaction (all or nothing). */
export async function commitSalesImport(input: unknown): Promise<ImportResult> {
  const ctx = await requirePermission("sales.manage");
  await requirePermission("inventory.adjust");
  const values = validate(commitSchema, input);
  if (values.orders.length === 0) throw Errors.validation("Nothing to import.");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("import_sales_history", {
    p_business_id: ctx.business.businessId,
    p_batch_key: values.batchKey,
    p_location_id: values.locationId,
    p_opening: values.opening,
    p_orders: values.orders.map((o) => ({ ...o, items: o.items })),
  });
  if (error) throw fromDatabaseError(error);
  return data as unknown as ImportResult;
}
