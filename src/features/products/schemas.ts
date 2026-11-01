import { z } from "zod";
import {
  optionalMoneyString,
  optionalTrimmed,
  requiredName,
  uuidSchema,
} from "@/lib/validation/common";

export const productSchema = z.object({
  name: requiredName(),
  description: optionalTrimmed(2000),
  category: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["single_origin", "blend", "decaf", "other"]).optional(),
  ),
  is_active: z.preprocess(
    (v) => (v === undefined || v === "" ? true : v === true || v === "true" || v === "on"),
    z.boolean(),
  ),
});
export type ProductInput = z.output<typeof productSchema>;

export const variantSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(60),
  name: requiredName(),
  net_weight_g: z.coerce
    .number({ error: "Enter the net weight" })
    .int("Use whole grams")
    .positive("Net weight must be greater than zero"),
  packaging_type: z.enum(["bag", "jar", "box", "sachet", "drip_bag", "other"]),
  selling_price: optionalMoneyString,
  wholesale_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z
      .string()
      .trim()
      .regex(/^\d{1,11}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimals")
      .optional(),
  ),
  is_active: z.preprocess(
    (v) => (v === undefined || v === "" ? true : v === true || v === "true" || v === "on"),
    z.boolean(),
  ),
  materials: z
    .array(z.object({ material_id: uuidSchema, quantity_per_unit: z.coerce.number().int().min(0) }))
    .default([]),
});
export type VariantInput = z.output<typeof variantSchema>;
export type VariantFormValues = z.input<typeof variantSchema>;
