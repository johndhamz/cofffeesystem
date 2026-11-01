import { describe, expect, it } from "vitest";
import {
  csvEscape,
  grossMarginPct,
  grossProfitCentavos,
  inventoryValuationCentavos,
  lineCogsCentavos,
  lineNetRevenueCentavos,
  operatingExpensesCentavos,
  operatingResultCentavos,
  remainingAllocatableCentavos,
  toCsv,
} from "@/lib/finance/calculations";

describe("finance calculations", () => {
  it("computes gross profit, margin and operating result", () => {
    expect(grossProfitCentavos(105_000, 44_960)).toBe(60_040);
    expect(grossMarginPct(105_000, 44_960)).toBe(57.18);
    expect(grossMarginPct(0, 0)).toBeNull();
    expect(operatingResultCentavos(105_000, 44_960, 20_000)).toBe(40_040);
    expect(() => grossProfitCentavos(1.5, 0)).toThrow();
  });

  it("recognises revenue on fulfilled units net of returns and discounts", () => {
    const line = {
      units: 3,
      returnedUnits: 0,
      restockedUnits: 0,
      unitPriceCentavos: 35_000,
      unitCostMicroPesos: 149_866_667,
      lineDiscountCentavos: 0,
      orderedUnits: 3,
    };
    expect(lineNetRevenueCentavos(line)).toBe(105_000);
    expect(lineCogsCentavos(line)).toBe(44_960);
    // one returned & restocked: revenue for 2, COGS for 2
    expect(lineNetRevenueCentavos({ ...line, returnedUnits: 1, restockedUnits: 1 })).toBe(70_000);
    expect(lineCogsCentavos({ ...line, returnedUnits: 1, restockedUnits: 1 })).toBe(29_973);
    // one returned as waste: revenue for 2, COGS still for 3
    expect(lineCogsCentavos({ ...line, returnedUnits: 1, restockedUnits: 0 })).toBe(44_960);
    // line discount ₱30 on 3 ordered, 2 kept → ₱20 share
    expect(lineNetRevenueCentavos({ ...line, returnedUnits: 1, lineDiscountCentavos: 3_000 })).toBe(
      68_000,
    );
    expect(() => lineNetRevenueCentavos({ ...line, returnedUnits: 4 })).toThrow();
  });

  it("counts each cost once: production treatments are excluded from operating expenses", () => {
    const opex = operatingExpensesCentavos([
      { amountCentavos: 4_000, treatment: "roast_production" }, // LPG already in batch cost
      { amountCentavos: 50_000, treatment: "administrative" },
      { amountCentavos: 1_500, treatment: "selling" },
      { amountCentavos: 100_000, treatment: "capital" },
      { amountCentavos: 9_999, treatment: "other_operating", voided: true },
    ]);
    expect(opex).toBe(51_500);
  });

  it("limits allocations to the expense amount", () => {
    expect(remainingAllocatableCentavos(10_000, [4_000, 3_000])).toBe(3_000);
    expect(() => remainingAllocatableCentavos(10_000, [6_000, 5_000])).toThrow(/exceed/);
    expect(() => remainingAllocatableCentavos(10_000, [0])).toThrow();
  });

  it("values inventory from remaining cost layers", () => {
    expect(
      inventoryValuationCentavos([
        { remainingQuantity: 8500, remainingCostCentavos: 382_500 },
        { remainingQuantity: 10, remainingCostCentavos: 615 },
      ]),
    ).toBe(383_115);
    expect(() =>
      inventoryValuationCentavos([{ remainingQuantity: -1, remainingCostCentavos: 0 }]),
    ).toThrow();
  });

  it("escapes CSV safely", () => {
    expect(csvEscape('Kape "Tagalog", Inc.')).toBe('"Kape ""Tagalog"", Inc."');
    expect(csvEscape(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
