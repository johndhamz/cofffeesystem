import { z } from "zod";
import {
  dateString,
  moneyString,
  optionalMoneyString,
  optionalTrimmed,
  optionalUuid,
  uuidSchema,
} from "@/lib/validation/common";

export const orderItemSchema = z.object({
  product_variant_id: uuidSchema,
  quantity: z.coerce
    .number({ error: "Enter a quantity" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),
  unit_price: moneyString,
  discount_amount: optionalMoneyString,
});

export const salesOrderSchema = z.object({
  customer_id: optionalUuid,
  sales_channel_id: uuidSchema,
  price_tier: z.enum(["retail", "wholesale"]),
  ordered_at: dateString,
  due_at: z.preprocess((v) => (v === "" ? undefined : v), dateString.optional()),
  discount_amount: optionalMoneyString,
  notes: optionalTrimmed(4000),
  items: z.array(orderItemSchema).min(1, "Add at least one item"),
});
export type SalesOrderInput = z.output<typeof salesOrderSchema>;
export type SalesOrderFormValues = z.input<typeof salesOrderSchema>;

export const fulfillmentSchema = z.object({
  location_id: optionalUuid,
  fulfilled_at: dateString,
  notes: optionalTrimmed(2000),
  items: z
    .array(
      z.object({
        order_item_id: uuidSchema,
        finished_goods_lot_id: uuidSchema,
        quantity: z.coerce.number().int().min(0),
      }),
    )
    .default([]),
});
export type FulfillmentInput = z.output<typeof fulfillmentSchema>;

export const paymentSchema = z.object({
  amount: moneyString,
  payment_method: z.enum(["cash", "bank_transfer", "gcash", "maya", "other"]),
  payment_reference: optionalTrimmed(120),
  received_at: dateString,
  notes: optionalTrimmed(1000),
});
export type PaymentInput = z.output<typeof paymentSchema>;

export const refundSchema = z.object({
  payment_id: uuidSchema,
  amount: moneyString,
  reason: z.string().trim().min(3, "Give a reason").max(500),
  refund_method: z.enum(["cash", "bank_transfer", "gcash", "maya", "other"]),
});

export const returnSchema = z.object({
  location_id: optionalUuid,
  reason: z.string().trim().min(3, "Give a reason").max(500),
  received_at: dateString,
  notes: optionalTrimmed(2000),
  items: z
    .array(
      z.object({
        fulfillment_item_id: uuidSchema,
        quantity: z.coerce.number().int().min(0),
        condition: z.enum(["sealed", "opened", "damaged"]),
        disposition: z.enum(["restock", "quarantine", "waste"]),
      }),
    )
    .min(1),
});
export type ReturnInput = z.output<typeof returnSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason").max(500),
});
