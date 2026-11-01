import { describe, expect, it } from "vitest";
import {
  costPerKgCentavos,
  formatWeight,
  gramsToKg,
  kgToGrams,
  parseWeightToGrams,
} from "@/lib/units";

describe("units", () => {
  it("converts kilograms to integer grams", () => {
    expect(kgToGrams(10)).toBe(10000);
    expect(kgToGrams("10")).toBe(10000);
    expect(kgToGrams(0.25)).toBe(250);
    expect(kgToGrams("1,250.5")).toBe(1250500);
    expect(kgToGrams(0.0004)).toBe(0);
  });

  it("rejects negative or non-numeric kilograms", () => {
    expect(() => kgToGrams(-1)).toThrow();
    expect(() => kgToGrams("x")).toThrow();
  });

  it("converts grams to kilograms", () => {
    expect(gramsToKg(10000)).toBe(10);
    expect(gramsToKg(250)).toBe(0.25);
    expect(() => gramsToKg(1.5)).toThrow();
  });

  it("parses weight input in either unit", () => {
    expect(parseWeightToGrams("2.5", "kg")).toBe(2500);
    expect(parseWeightToGrams("850", "g")).toBe(850);
    expect(parseWeightToGrams(850.4, "g")).toBe(850);
  });

  it("formats weights, switching to kg at 1,000 g", () => {
    expect(formatWeight(850)).toBe("850 g");
    expect(formatWeight(1000)).toBe("1 kg");
    expect(formatWeight(10000)).toBe("10 kg");
    expect(formatWeight(10250)).toBe("10.25 kg");
    expect(formatWeight(10250, { unit: "g" })).toBe("10,250 g");
    expect(formatWeight(500, { unit: "kg" })).toBe("0.5 kg");
  });

  it("computes cost per kilogram in centavos", () => {
    // ₱4,500.00 for 10,000 g → ₱450.00 / kg
    expect(costPerKgCentavos(450000, 10000)).toBe(45000);
    expect(() => costPerKgCentavos(100, 0)).toThrow();
  });
});
