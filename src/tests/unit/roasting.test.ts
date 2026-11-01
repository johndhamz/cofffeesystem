import { describe, expect, it } from "vitest";
import {
  capacityStatus,
  developmentRatioPct,
  developmentSeconds,
  formatDuration,
  productionCostCentavos,
  rateOfRise,
  roastLossPct,
  roastYieldPct,
  roastedCostPerGram,
  roastedCostPerKgCentavos,
} from "@/lib/roasting/calculations";

describe("roast calculations", () => {
  it("computes loss and yield for the reference roast (1.5 kg → 1.26 kg)", () => {
    const w = { greenWeightG: 1500, roastedWeightG: 1260 };
    expect(roastLossPct(w)).toBe(16);
    expect(roastYieldPct(w)).toBe(84);
  });

  it("rounds half-up to two decimals without float drift", () => {
    expect(roastLossPct({ greenWeightG: 3000, roastedWeightG: 2500 })).toBe(16.67);
    expect(roastYieldPct({ greenWeightG: 3000, roastedWeightG: 2500 })).toBe(83.33);
    expect(roastLossPct({ greenWeightG: 8, roastedWeightG: 7 })).toBe(12.5);
    expect(roastLossPct({ greenWeightG: 1000, roastedWeightG: 1000 })).toBe(0);
  });

  it("rejects invalid weights", () => {
    expect(() => roastLossPct({ greenWeightG: 0, roastedWeightG: 1 })).toThrow();
    expect(() => roastLossPct({ greenWeightG: 1000, roastedWeightG: 0 })).toThrow();
    expect(() => roastLossPct({ greenWeightG: 1000, roastedWeightG: 1001 })).toThrow();
    expect(() => roastYieldPct({ greenWeightG: 1000.5, roastedWeightG: 900 })).toThrow();
  });

  it("computes development time and ratio", () => {
    expect(developmentSeconds(600, 480)).toBe(120);
    expect(developmentRatioPct(600, 480)).toBe(20);
    expect(developmentRatioPct(660, 540)).toBe(18.18);
    expect(() => developmentSeconds(600, 601)).toThrow(/after the roast ends/);
    expect(() => developmentSeconds(0, 0)).toThrow();
    expect(() => developmentSeconds(600, -1)).toThrow();
  });

  it("sums production costs and derives cost per gram / kg", () => {
    // green ₱675.00 + LPG ₱40.00 + labor ₱60.00 = ₱775.00 for 1260 g
    const total = productionCostCentavos({
      greenCostCentavos: 67500,
      lpgCentavos: 4000,
      laborCentavos: 6000,
    });
    expect(total).toBe(77500);
    expect(roastedCostPerGram(total, 1260)).toBe("0.615079");
    expect(roastedCostPerKgCentavos(total, 1260)).toBe(61508);
    expect(roastedCostPerGram(0, 1000)).toBe("0.000000");
    expect(() => productionCostCentavos({ greenCostCentavos: -1 })).toThrow();
    expect(() => roastedCostPerGram(100, 0)).toThrow();
  });

  it("flags over-capacity batches", () => {
    expect(capacityStatus(1500, 2000)).toEqual({ over: false, pct: 75 });
    expect(capacityStatus(2200, 2000)).toEqual({ over: true, pct: 110 });
    expect(capacityStatus(100, 0)).toEqual({ over: false, pct: 0 });
  });

  it("computes rate of rise between samples", () => {
    expect(rateOfRise(null, { elapsedSeconds: 0, btC: 200 })).toBeNull();
    expect(rateOfRise({ elapsedSeconds: 60, btC: 150 }, { elapsedSeconds: 90, btC: 156 })).toBe(12);
    expect(
      rateOfRise({ elapsedSeconds: 90, btC: 156 }, { elapsedSeconds: 90, btC: 160 }),
    ).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(null)).toBe("—");
  });
});
