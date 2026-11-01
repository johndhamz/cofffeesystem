import { describe, expect, it } from "vitest";
import { validate, parseListQuery } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import {
  greenCoffeeSchema,
  roasterSchema,
  supplierSchema,
} from "@/features/settings/master-data/entities";
import { businessSettingsSchema, BUSINESS_SETTINGS_DEFAULTS } from "@/features/settings/schemas";
import { purchaseOrderSchema, goodsReceiptSchema } from "@/features/procurement/schemas";
import { inventoryAdjustmentSchema } from "@/features/inventory/schemas";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("master data validation", () => {
  it("requires a supplier name and trims it", () => {
    const result = validate(supplierSchema, { name: "  Benguet Farmers  " });
    expect(result.name).toBe("Benguet Farmers");
    expect(result.is_active).toBe(true);
    expect(result.email).toBeUndefined();
  });

  it("rejects an empty supplier name with a field error", () => {
    try {
      validate(supplierSchema, { name: "   " });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION_ERROR");
      expect((error as AppError).fieldErrors?.name?.[0]).toMatch(/required/i);
    }
  });

  it("validates supplier email format but keeps it optional", () => {
    expect(() => validate(supplierSchema, { name: "A", email: "nope" })).toThrow(AppError);
    expect(validate(supplierSchema, { name: "A", email: "" }).email).toBeUndefined();
    expect(validate(supplierSchema, { name: "A", email: "a@b.co" }).email).toBe("a@b.co");
  });

  it("keeps unknown measurements optional on green coffee", () => {
    const result = validate(greenCoffeeSchema, {
      name: "Atok Benguet Arabica Washed",
      altitude_masl: "",
    });
    expect(result.altitude_masl).toBeUndefined();
    expect(result.processing_method).toBeUndefined();
  });

  it("rejects out-of-range altitude", () => {
    expect(() => validate(greenCoffeeSchema, { name: "X", altitude_masl: "-5" })).toThrow(AppError);
    expect(() => validate(greenCoffeeSchema, { name: "X", altitude_masl: "9000" })).toThrow(
      AppError,
    );
    expect(() => validate(greenCoffeeSchema, { name: "X", altitude_masl: "1500.5" })).toThrow(
      AppError,
    );
    expect(validate(greenCoffeeSchema, { name: "X", altitude_masl: "1500" }).altitude_masl).toBe(
      1500,
    );
  });

  it("requires a positive integer roaster capacity", () => {
    expect(validate(roasterSchema, { name: "Yoshan DY-2kg", capacity_g: "2000" }).capacity_g).toBe(
      2000,
    );
    expect(() => validate(roasterSchema, { name: "Yoshan", capacity_g: "" })).toThrow(AppError);
    expect(() => validate(roasterSchema, { name: "Yoshan", capacity_g: "0" })).toThrow(AppError);
    expect(() => validate(roasterSchema, { name: "Yoshan", capacity_g: "12.5" })).toThrow(AppError);
  });
});

describe("business settings", () => {
  it("has PHP / Asia/Manila / grams / lot costing defaults", () => {
    expect(BUSINESS_SETTINGS_DEFAULTS).toEqual({
      currency: "PHP",
      timezone: "Asia/Manila",
      inventory_weight_unit: "g",
      costing_method: "lot_actual",
    });
  });

  it("treats empty select values as no default", () => {
    const result = validate(businessSettingsSchema, {
      business_name: "Kape",
      ...BUSINESS_SETTINGS_DEFAULTS,
      default_roaster_id: "",
      default_location_id: UUID,
    });
    expect(result.default_roaster_id).toBeUndefined();
    expect(result.default_location_id).toBe(UUID);
  });

  it("rejects unsupported currency or timezone", () => {
    expect(() =>
      validate(businessSettingsSchema, {
        business_name: "K",
        ...BUSINESS_SETTINGS_DEFAULTS,
        currency: "USD",
      }),
    ).toThrow(AppError);
  });
});

describe("procurement validation", () => {
  it("accepts a purchase with kg quantities and per-kg cost", () => {
    const result = validate(purchaseOrderSchema, {
      supplier_id: UUID,
      ordered_at: "2026-10-31",
      additional_costs: "",
      items: [{ green_coffee_id: UUID, quantity_kg: "10", unit_cost: "450" }],
    });
    expect(result.items[0].quantity_kg).toBe(10);
    expect(result.additional_costs).toBe("0");
  });

  it("rejects zero quantity and bad money strings", () => {
    expect(() =>
      validate(purchaseOrderSchema, {
        supplier_id: UUID,
        ordered_at: "2026-10-31",
        items: [{ green_coffee_id: UUID, quantity_kg: "0", unit_cost: "450" }],
      }),
    ).toThrow(AppError);
    expect(() =>
      validate(purchaseOrderSchema, {
        supplier_id: UUID,
        ordered_at: "2026-10-31",
        additional_costs: "12.345",
        items: [{ green_coffee_id: UUID, quantity_kg: "1", unit_cost: "450" }],
      }),
    ).toThrow(AppError);
  });

  it("requires at least one purchase item", () => {
    expect(() =>
      validate(purchaseOrderSchema, { supplier_id: UUID, ordered_at: "2026-10-31", items: [] }),
    ).toThrow(AppError);
  });

  it("validates receipt lot measurements as optional", () => {
    const result = validate(goodsReceiptSchema, {
      purchase_order_id: UUID,
      location_id: UUID,
      received_at: "2026-10-31",
      additional_costs: "100.50",
      items: [
        {
          purchase_order_item_id: UUID,
          quantity_kg: "10",
          lot_code: "",
          moisture_pct: "",
          density_g_per_100ml: "",
        },
      ],
    });
    expect(result.items[0].moisture_pct).toBeUndefined();
    expect(result.items[0].lot_code).toBeUndefined();
  });
});

describe("inventory adjustment validation", () => {
  it("requires whole-gram positive quantities", () => {
    const base = {
      reason: "damage",
      lines: [
        { inventory_item_id: UUID, location_id: UUID, direction: "decrease", quantity: "250" },
      ],
    };
    expect(validate(inventoryAdjustmentSchema, base).lines[0].quantity).toBe(250);
    expect(() =>
      validate(inventoryAdjustmentSchema, {
        ...base,
        lines: [{ ...base.lines[0], quantity: "0" }],
      }),
    ).toThrow(AppError);
    expect(() =>
      validate(inventoryAdjustmentSchema, {
        ...base,
        lines: [{ ...base.lines[0], quantity: "1.5" }],
      }),
    ).toThrow(AppError);
  });
});

describe("list query parsing", () => {
  it("applies defaults and clamps", () => {
    expect(parseListQuery({})).toMatchObject({
      page: 1,
      pageSize: 20,
      dir: "asc",
      status: "active",
    });
    expect(
      parseListQuery({ page: "3", pageSize: "50", dir: "desc", status: "all", q: "atok" }),
    ).toMatchObject({ page: 3, pageSize: 50, dir: "desc", status: "all", q: "atok" });
    expect(parseListQuery({ page: "0" }).page).toBe(1);
  });
});
