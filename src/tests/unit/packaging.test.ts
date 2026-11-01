import { describe, expect, it } from "vitest";
import {
  allocateSessionCost,
  materialRequirements,
  remainingRoastedG,
  requiredWeightG,
  sessionTotalCentavos,
  unitCost,
} from "@/lib/packaging/calculations";

const v250 = { variantId: "v250", quantity: 5, netWeightG: 250 };

describe("packaging calculations", () => {
  it("computes required coffee weight and remainder (1260 g → 5 × 250 g → 10 g left)", () => {
    expect(requiredWeightG([v250])).toBe(1250);
    expect(remainingRoastedG(1260, [v250])).toBe(10);
    expect(() => remainingRoastedG(1000, [v250])).toThrow(/less than required/);
    expect(() => requiredWeightG([{ ...v250, quantity: 0 }])).toThrow();
    expect(() => requiredWeightG([{ ...v250, quantity: 1.5 }])).toThrow();
  });

  it("derives material requirements from the bill of materials", () => {
    const req = materialRequirements(
      [v250, { variantId: "v500", quantity: 2, netWeightG: 500 }],
      [
        { variantId: "v250", materialId: "bag250", quantityPerUnit: 1 },
        { variantId: "v250", materialId: "label", quantityPerUnit: 1 },
        { variantId: "v500", materialId: "bag500", quantityPerUnit: 1 },
        { variantId: "v500", materialId: "label", quantityPerUnit: 2 },
      ],
    );
    expect(Object.fromEntries(req)).toEqual({ bag250: 5, label: 9, bag500: 2 });
  });

  it("allocates session cost by coffee weight with the remainder on the last line", () => {
    // ₱1,000.00 across 5×250 g (1250 g) and 1×500 g (500 g) → 71.43% / 28.57%
    const parts = allocateSessionCost(100_000, [
      v250,
      { variantId: "v500", quantity: 1, netWeightG: 500 },
    ]);
    expect(parts).toEqual([71_429, 28_571]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100_000);
    expect(allocateSessionCost(0, [v250])).toEqual([0]);
    expect(() => allocateSessionCost(-1, [v250])).toThrow();
  });

  it("computes unit cost with 6-decimal precision", () => {
    // worked example: roasted ₱775.00 for 1260 g → 1250 g used = ₱768.85; + 5 bags @ ₱8 = ₱40; + labor ₱50 → ₱858.85 / 5
    expect(unitCost(85_885, 5)).toBe("171.770000");
    expect(unitCost(100, 3)).toBe("0.333333");
    expect(() => unitCost(100, 0)).toThrow();
  });

  it("sums session cost components", () => {
    expect(
      sessionTotalCentavos({
        coffeeCostCentavos: 76_885,
        materialCostCentavos: 4_000,
        laborCentavos: 5_000,
      }),
    ).toBe(85_885);
    expect(() =>
      sessionTotalCentavos({ coffeeCostCentavos: -1, materialCostCentavos: 0 }),
    ).toThrow();
  });
});
