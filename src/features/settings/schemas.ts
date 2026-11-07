import { z } from "zod";
import { optionalUuid, requiredName } from "@/lib/validation/common";

export const SUPPORTED_TIMEZONES = ["Asia/Manila"] as const;
export const SUPPORTED_CURRENCIES = ["PHP"] as const;

/** Non-negative decimal typed as text in the form, stored as numeric in business_settings. */
const decimalSetting = (decimals: number, max: number, fallback: number, message: string) =>
  z.preprocess(
    (v) =>
      v === undefined || v === null || v === ""
        ? fallback.toFixed(decimals)
        : typeof v === "number"
          ? v.toFixed(decimals)
          : typeof v === "string"
            ? v.trim()
            : v,
    z
      .string()
      .regex(new RegExp(`^\\d{1,6}(\\.\\d{1,${decimals}})?$`), message)
      .transform(Number)
      .pipe(z.number().min(0, message).max(max, message)),
  );

export const businessSettingsSchema = z.object({
  business_name: requiredName(120),
  currency: z.enum(SUPPORTED_CURRENCIES),
  timezone: z.enum(SUPPORTED_TIMEZONES),
  inventory_weight_unit: z.enum(["g", "kg"]),
  costing_method: z.enum(["lot_actual", "fifo", "weighted_average"]),
  default_roaster_id: optionalUuid,
  default_location_id: optionalUuid,
  require_mfa: z
    .preprocess((v) => v === true || v === "true" || v === "on", z.boolean())
    .default(false),
  lpg_price_per_kg: decimalSetting(2, 100000, 127, "Enter the LPG price per kg"),
  lpg_kg_per_hour: decimalSetting(3, 100, 0.2, "Enter LPG use in kg per hour (0 disables)"),
  lpg_profile_avg_kpa: decimalSetting(2, 1000, 1.9, "Enter the average gas pressure in kPa"),
});
export type BusinessSettingsInput = z.output<typeof businessSettingsSchema>;
export type BusinessSettingsFormValues = z.input<typeof businessSettingsSchema>;

export const BUSINESS_SETTINGS_DEFAULTS = {
  currency: "PHP",
  timezone: "Asia/Manila",
  inventory_weight_unit: "g",
  costing_method: "lot_actual",
} as const;

export const COSTING_METHOD_LABELS: Record<BusinessSettingsInput["costing_method"], string> = {
  lot_actual: "Lot-based actual cost",
  fifo: "FIFO (first in, first out)",
  weighted_average: "Weighted average",
};

/** Calibration defaults (also the column defaults in migration 0011). */
export const LPG_DEFAULTS = {
  lpg_price_per_kg: 127,
  lpg_kg_per_hour: 0.2,
  lpg_profile_avg_kpa: 1.9,
};
