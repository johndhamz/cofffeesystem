import { z } from "zod";
import { parseMinutesToSeconds } from "@/lib/roasting/calculations";
import { dateString, optionalTrimmed, optionalUuid, uuidSchema } from "@/lib/validation/common";

export const ROAST_STATUS_LABELS = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  voided: "Voided",
} as const;

export const ROAST_EVENT_TYPES = [
  { value: "charge", label: "Charge" },
  { value: "turning_point", label: "Turning point" },
  { value: "dry_end", label: "Dry end" },
  { value: "first_crack_start", label: "First crack start" },
  { value: "first_crack_end", label: "First crack end" },
  { value: "second_crack_start", label: "Second crack start" },
  { value: "drop", label: "Drop" },
  { value: "cooling_end", label: "Cooling end" },
  { value: "gas_change", label: "Gas change" },
  { value: "airflow_change", label: "Airflow change" },
  { value: "drum_change", label: "Drum speed change" },
  { value: "note", label: "Note" },
] as const;

export const COST_TYPES = [
  { value: "lpg", label: "LPG / fuel" },
  { value: "labor", label: "Labor" },
  { value: "overhead", label: "Manufacturing overhead" },
  { value: "other", label: "Other" },
] as const;

const optionalDecimal = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    schema.optional(),
  );

export const roastInputSchema = z.object({
  green_lot_id: uuidSchema,
  input_weight_g: z.coerce
    .number({ error: "Enter a weight" })
    .int("Use whole grams")
    .positive("Weight must be greater than zero"),
});

export const roastBatchSchema = z.object({
  roaster_id: uuidSchema,
  roast_profile_id: optionalUuid,
  location_id: uuidSchema,
  operator_id: optionalUuid,
  roast_date: dateString,
  notes: optionalTrimmed(4000),
  inputs: z.array(roastInputSchema).min(1, "Select at least one green coffee lot"),
});
export type RoastBatchInput = z.output<typeof roastBatchSchema>;
export type RoastBatchFormValues = z.input<typeof roastBatchSchema>;

export const roastMeasurementSchema = z.object({
  elapsed_seconds: z.coerce
    .number({ error: "Enter elapsed seconds" })
    .int()
    .min(0, "Cannot be negative"),
  bt_c: optionalDecimal(z.number().min(-50).max(400, "Bean temperature out of range")),
  et_c: optionalDecimal(z.number().min(-50).max(500, "Environment temperature out of range")),
  gas_kpa: optionalDecimal(z.number().min(0, "Gas pressure cannot be negative")),
  airflow_pct: optionalDecimal(
    z.number().min(0, "Airflow must be 0–100").max(100, "Airflow must be 0–100"),
  ),
  drum_speed_pct: optionalDecimal(
    z.number().min(0, "Drum speed must be 0–100").max(100, "Drum speed must be 0–100"),
  ),
});
export type RoastMeasurementInput = z.output<typeof roastMeasurementSchema>;

export const roastEventSchema = z.object({
  event_type: z.enum(ROAST_EVENT_TYPES.map((e) => e.value) as [string, ...string[]]),
  elapsed_seconds: z.coerce.number().int().min(0),
  temperature_c: optionalDecimal(z.number().min(-50).max(500)),
  notes: optionalTrimmed(1000),
});
export type RoastEventInput = z.output<typeof roastEventSchema>;

export const roastCostSchema = z.object({
  cost_type: z.enum(["lpg", "labor", "overhead", "other"]),
  amount: z.preprocess(
    (v) =>
      v === "" || v === null || v === undefined ? "0" : typeof v === "number" ? v.toFixed(2) : v,
    z
      .string()
      .trim()
      .regex(/^\d{1,11}(\.\d{1,2})?$/, "Enter an amount with up to 2 decimals"),
  ),
  notes: optionalTrimmed(500),
});

export const roastCompletionSchema = z
  .object({
    roasted_weight_g: z.coerce
      .number({ error: "Enter the roasted weight" })
      .int("Use whole grams")
      .positive("Roasted output must be greater than zero"),
    roast_level: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(["light", "medium_light", "medium", "medium_dark", "dark"]).optional(),
    ),
    // Entered in minutes ("10:30", "10.5" or "10m 30s"); stored as whole seconds.
    total_duration_seconds: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .union([z.string(), z.number()], { error: "Enter the roast duration in minutes" })
        .transform((v, ctx) => {
          const s = parseMinutesToSeconds(v);
          if (s === null) {
            ctx.addIssue({ code: "custom", message: "Enter minutes, e.g. 10:30 or 10.5" });
            return z.NEVER;
          }
          return s;
        })
        .pipe(z.number().int().positive("Duration must be greater than zero")),
    ),
    first_crack_seconds: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .union([z.string(), z.number()])
        .transform((v, ctx) => {
          const s = parseMinutesToSeconds(v);
          if (s === null) {
            ctx.addIssue({ code: "custom", message: "Enter minutes, e.g. 8:00 or 8" });
            return z.NEVER;
          }
          return s;
        })
        .pipe(z.number().int().min(0, "Cannot be negative"))
        .optional(),
    ),
    charge_bt_c: optionalDecimal(z.number().min(-50).max(400)),
    charge_et_c: optionalDecimal(z.number().min(-50).max(500)),
    first_crack_bt_c: optionalDecimal(z.number().min(-50).max(400)),
    drop_bt_c: optionalDecimal(z.number().min(-50).max(400)),
    costs: z.array(roastCostSchema).default([]),
    notes: optionalTrimmed(4000),
  })
  .refine(
    (v) => v.first_crack_seconds === undefined || v.first_crack_seconds <= v.total_duration_seconds,
    {
      path: ["first_crack_seconds"],
      message: "First crack cannot occur after the roast ends",
    },
  );
export type RoastCompletionInput = z.output<typeof roastCompletionSchema>;
export type RoastCompletionFormValues = z.input<typeof roastCompletionSchema>;

export const voidRoastSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
});

export const roastProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  roaster_id: optionalUuid,
  target_roast_level: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["light", "medium_light", "medium", "medium_dark", "dark"]).optional(),
  ),
  target_notes: optionalTrimmed(2000),
  description: optionalTrimmed(2000),
  is_active: z.preprocess(
    (v) => (v === undefined || v === "" ? true : v === true || v === "true" || v === "on"),
    z.boolean(),
  ),
});
