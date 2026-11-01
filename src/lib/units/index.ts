/**
 * Weight helpers. Inventory stores integer GRAMS. Display may use kg.
 */

export const GRAMS_PER_KILOGRAM = 1000;

export type WeightUnit = "g" | "kg";

export function kgToGrams(kg: number | string): number {
  const value = typeof kg === "string" ? Number(kg.trim().replace(/,/g, "")) : kg;
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`Invalid kilogram value: ${kg}`);
  return Math.round(value * GRAMS_PER_KILOGRAM);
}

export function gramsToKg(grams: number): number {
  if (!Number.isInteger(grams)) throw new RangeError("Grams must be an integer");
  return grams / GRAMS_PER_KILOGRAM;
}

/** Parse a user-entered weight in the given unit into integer grams. */
export function parseWeightToGrams(value: number | string, unit: WeightUnit): number {
  if (unit === "kg") return kgToGrams(value);
  const grams = typeof value === "string" ? Number(value.trim().replace(/,/g, "")) : value;
  if (!Number.isFinite(grams) || grams < 0) throw new RangeError(`Invalid gram value: ${value}`);
  return Math.round(grams);
}

/**
 * Format grams for display. Uses kg at or above 1,000 g unless `unit` is forced.
 * Examples: 850 → "850 g", 10000 → "10 kg", 10250 → "10.25 kg"
 */
export function formatWeight(
  grams: number,
  options: { unit?: WeightUnit | "auto"; maxFractionDigits?: number } = {},
): string {
  const { unit = "auto", maxFractionDigits = 3 } = options;
  const useKg = unit === "kg" || (unit === "auto" && Math.abs(grams) >= GRAMS_PER_KILOGRAM);
  if (useKg) {
    const kg = grams / GRAMS_PER_KILOGRAM;
    return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: maxFractionDigits }).format(kg)} kg`;
  }
  return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(grams)} g`;
}

/** Cost per kilogram as a decimal string, given total cost in centavos and weight in grams. */
export function costPerKgCentavos(totalCostCentavos: number, grams: number): number {
  if (grams <= 0) throw new RangeError("Weight must be positive");
  return Math.round((totalCostCentavos * GRAMS_PER_KILOGRAM) / grams);
}
