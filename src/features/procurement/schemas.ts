import { z } from "zod";
import {
  dateString,
  optionalMoneyString,
  optionalTrimmed,
  uuidSchema,
} from "@/lib/validation/common";

export const purchaseOrderItemSchema = z.object({
  green_coffee_id: uuidSchema,
  quantity_kg: z.coerce
    .number({ error: "Enter a quantity" })
    .positive("Quantity must be greater than zero")
    .max(100_000, "Quantity is too large"),
  unit_cost: z
    .string()
    .trim()
    .regex(/^\d{1,9}(\.\d{1,4})?$/, "Enter a cost per kg with up to 4 decimals"),
});

export const purchaseOrderSchema = z.object({
  supplier_id: uuidSchema,
  ordered_at: dateString,
  notes: optionalTrimmed(2000),
  additional_costs: optionalMoneyString,
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one item"),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const receiptItemSchema = z.object({
  purchase_order_item_id: uuidSchema,
  quantity_kg: z.coerce.number().min(0, "Cannot be negative").max(100_000),
  lot_code: optionalTrimmed(60),
  moisture_pct: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(100).optional(),
  ),
  density_g_per_100ml: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive().max(200).optional(),
  ),
  lot_notes: optionalTrimmed(2000),
});

export const goodsReceiptSchema = z.object({
  purchase_order_id: uuidSchema,
  location_id: uuidSchema,
  received_at: dateString,
  additional_costs: optionalMoneyString,
  notes: optionalTrimmed(2000),
  items: z.array(receiptItemSchema).min(1),
});
export type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;

export const PO_STATUS_LABELS = {
  draft: "Draft",
  confirmed: "Confirmed",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
} as const;
