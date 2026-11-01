import { z } from "zod";
import { optionalUuid, requiredName } from "@/lib/validation/common";

export const SUPPORTED_TIMEZONES = ["Asia/Manila"] as const;
export const SUPPORTED_CURRENCIES = ["PHP"] as const;

export const businessSettingsSchema = z.object({
  business_name: requiredName(120),
  currency: z.enum(SUPPORTED_CURRENCIES),
  timezone: z.enum(SUPPORTED_TIMEZONES),
  inventory_weight_unit: z.enum(["g", "kg"]),
  costing_method: z.enum(["lot_actual", "fifo", "weighted_average"]),
  default_roaster_id: optionalUuid,
  default_location_id: optionalUuid,
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
