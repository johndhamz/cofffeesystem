import { z } from "zod";
import {
  dateString,
  optionalMoneyString,
  optionalTrimmed,
  optionalUuid,
  uuidSchema,
} from "@/lib/validation/common";

export const PACKAGING_STATUS_LABELS = {
  draft: "Draft",
  completed: "Completed",
  voided: "Voided",
} as const;

export const packagingSessionSchema = z.object({
  location_id: uuidSchema,
  packaged_at: dateString,
  operator_id: optionalUuid,
  labor_cost: optionalMoneyString,
  overhead_cost: optionalMoneyString,
  notes: optionalTrimmed(4000),
  inputs: z
    .array(
      z.object({
        roast_batch_id: uuidSchema,
        input_weight_g: z.coerce
          .number({ error: "Enter a weight" })
          .int("Use whole grams")
          .positive("Weight must be greater than zero"),
      }),
    )
    .min(1, "Select at least one roast batch"),
  outputs: z
    .array(
      z.object({
        variant_id: uuidSchema,
        quantity: z.coerce
          .number({ error: "Enter a quantity" })
          .int("Quantity must be a whole number")
          .positive("Quantity must be greater than zero"),
        lot_code: optionalTrimmed(60),
        best_before_at: z.preprocess((v) => (v === "" ? undefined : v), dateString.optional()),
      }),
    )
    .min(1, "Add at least one product output"),
  materials: z
    .array(
      z.object({
        material_id: uuidSchema,
        quantity: z.coerce.number().int().min(0, "Cannot be negative"),
      }),
    )
    .default([]),
});
export type PackagingSessionInput = z.output<typeof packagingSessionSchema>;
export type PackagingSessionFormValues = z.input<typeof packagingSessionSchema>;

export const voidPackagingSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
});
