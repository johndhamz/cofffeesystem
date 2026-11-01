import { z } from "zod";
import {
  dateString,
  moneyString,
  optionalTrimmed,
  optionalUuid,
  uuidSchema,
} from "@/lib/validation/common";

export const expenseSchema = z.object({
  expense_category_id: uuidSchema,
  supplier_id: optionalUuid,
  amount: moneyString,
  incurred_at: dateString,
  description: z.string().trim().min(1, "Describe the expense").max(500),
  cost_treatment: z.enum([
    "inventory_acquisition",
    "roast_production",
    "packaging_production",
    "selling",
    "administrative",
    "other_operating",
    "capital",
  ]),
  payment_method: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["cash", "bank_transfer", "gcash", "maya", "other"]).optional(),
  ),
  payment_reference: optionalTrimmed(120),
  notes: optionalTrimmed(2000),
});
export type ExpenseInput = z.output<typeof expenseSchema>;
export type ExpenseFormValues = z.input<typeof expenseSchema>;

export const allocationSchema = z.object({
  target_type: z.enum(["roast_batch", "packaging_session", "goods_receipt"]),
  target_id: uuidSchema,
  amount: moneyString,
  notes: optionalTrimmed(500),
});
export type AllocationInput = z.output<typeof allocationSchema>;

export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason").max(500),
});
