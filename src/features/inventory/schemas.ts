import { z } from "zod";
import { optionalTrimmed, uuidSchema } from "@/lib/validation/common";

export const ADJUSTMENT_REASONS = [
  { value: "count_correction", label: "Physical count correction" },
  { value: "damage", label: "Damage / spoilage" },
  { value: "moisture_loss", label: "Moisture loss" },
  { value: "sample", label: "Samples / cupping" },
  { value: "donation", label: "Donation / giveaway" },
  { value: "other", label: "Other" },
] as const;

export const adjustmentLineSchema = z.object({
  inventory_item_id: uuidSchema,
  location_id: uuidSchema,
  direction: z.enum(["increase", "decrease"]),
  quantity: z.coerce
    .number()
    .int("Use whole base units")
    .positive("Quantity must be greater than zero"),
  unit_cost: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : String(v)),
    z
      .string()
      .regex(/^\d{1,9}(\.\d{1,6})?$/, "Enter a cost per unit")
      .optional(),
  ),
  notes: optionalTrimmed(500),
});

export const inventoryAdjustmentSchema = z.object({
  reason: z.enum(["count_correction", "damage", "moisture_loss", "sample", "donation", "other"]),
  notes: optionalTrimmed(2000),
  lines: z.array(adjustmentLineSchema).min(1, "Add at least one line"),
});
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;

export const lotUpdateSchema = z.object({
  moisture_pct: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(100).optional(),
  ),
  density_g_per_100ml: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive().max(200).optional(),
  ),
  notes: optionalTrimmed(2000),
  low_stock_threshold_g: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).optional(),
  ),
});

export const inventoryFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  country: z.string().trim().max(80).optional(),
  supplier: z.string().uuid().optional(),
  process: z.string().trim().max(80).optional(),
  lot: z.string().trim().max(60).optional(),
  stock: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
export type InventoryFilter = z.infer<typeof inventoryFilterSchema>;

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receipt: "Receipt",
  adjustment: "Adjustment",
  adjustment_reversal: "Adjustment reversal",
  roast_consume: "Roast (green used)",
  roast_output: "Roast output",
  pack_consume: "Packed (bulk used)",
  pack_output: "Packed output",
  sale: "Sale",
  sale_return: "Sale return",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  write_off: "Write-off",
};
