import { describe, expect, it } from "vitest";
import {
  addCentavos,
  allocateCentavos,
  formatPHP,
  fromCentavos,
  multiplyCentavos,
  toCentavos,
} from "@/lib/money";

describe("money", () => {
  it("parses decimal strings into integer centavos", () => {
    expect(toCentavos("1234.56")).toBe(123456);
    expect(toCentavos("0.1")).toBe(10);
    expect(toCentavos("1,234.5")).toBe(123450);
    expect(toCentavos("-5.25")).toBe(-525);
    expect(toCentavos("450")).toBe(45000);
  });

  it("rounds a third decimal half away from zero", () => {
    expect(toCentavos("0.005")).toBe(1);
    expect(toCentavos("0.004")).toBe(0);
    expect(toCentavos("-0.005")).toBe(-1);
    expect(toCentavos(0.1 + 0.2)).toBe(30);
  });

  it("rejects invalid input", () => {
    expect(() => toCentavos("abc")).toThrow();
    expect(() => toCentavos(Number.NaN)).toThrow();
    expect(() => fromCentavos(1.5)).toThrow();
  });

  it("formats centavos back to a 2-decimal string", () => {
    expect(fromCentavos(123456)).toBe("1234.56");
    expect(fromCentavos(5)).toBe("0.05");
    expect(fromCentavos(-525)).toBe("-5.25");
    expect(fromCentavos(0)).toBe("0.00");
  });

  it("round-trips without floating point drift", () => {
    for (const v of ["0.01", "0.07", "19.99", "1000000.10", "123.45"]) {
      expect(fromCentavos(toCentavos(v))).toBe(v);
    }
  });

  it("adds and multiplies safely", () => {
    expect(addCentavos(10, 20, 30)).toBe(60);
    expect(multiplyCentavos(1000, 1, 3)).toBe(333);
    expect(multiplyCentavos(1000, 2, 3)).toBe(667);
    expect(() => multiplyCentavos(1, 1, 0)).toThrow();
  });

  it("formats PHP with the peso sign and grouping", () => {
    expect(formatPHP(123456)).toMatch(/₱\s?1,234\.56/);
    expect(formatPHP(0)).toMatch(/₱\s?0\.00/);
    expect(formatPHP(123456, { showSymbol: false })).toBe("1,234.56");
  });

  describe("allocateCentavos (landed cost allocation)", () => {
    it("allocates proportionally and sums exactly to the total", () => {
      const parts = allocateCentavos(10000, [10000, 5000, 2500]);
      expect(parts).toEqual([5714, 2857, 1429]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
    });

    it("distributes remainder centavos by largest fractional remainder", () => {
      const parts = allocateCentavos(100, [1, 1, 1]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
      expect(parts).toEqual([34, 33, 33]);
    });

    it("handles zero total and zero weights", () => {
      expect(allocateCentavos(0, [1, 2])).toEqual([0, 0]);
      expect(allocateCentavos(500, [0, 0])).toEqual([500, 0]);
      expect(allocateCentavos(500, [])).toEqual([]);
    });

    it("never produces negative parts for positive totals", () => {
      for (let i = 1; i < 50; i++) {
        const parts = allocateCentavos(i * 7, [3, 5, 11, 13]);
        expect(parts.every((p) => p >= 0)).toBe(true);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(i * 7);
      }
    });
  });
});
