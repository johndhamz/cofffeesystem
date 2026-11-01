/**
 * Decimal-safe money helpers.
 *
 * Internally money is represented in CENTAVOS as integers (bigint-safe numbers) to avoid
 * floating point drift. The database stores numeric(14,2); conversion happens at the edge.
 */

export const DEFAULT_CURRENCY = "PHP";

export type Centavos = number;

const CENTAVOS_PER_PESO = 100;

/** Parse a decimal string / number (e.g. "1234.56") into integer centavos. Rounds half away from zero. */
export function toCentavos(value: string | number): Centavos {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Invalid money value");
    return roundHalfAwayFromZero(value * CENTAVOS_PER_PESO);
  }
  const trimmed = value.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new RangeError(`Invalid money string: ${value}`);
  const negative = trimmed.startsWith("-");
  const [whole, frac = ""] = trimmed.replace("-", "").split(".");
  const fracPadded = (frac + "000").slice(0, 3); // keep 3 digits for rounding
  const thirdDigit = Number(fracPadded[2]);
  let cents = Number(whole) * CENTAVOS_PER_PESO + Number(fracPadded.slice(0, 2));
  if (thirdDigit >= 5) cents += 1;
  return negative ? -cents : cents;
}

/** Integer centavos → decimal string with 2 places ("1234.56"). Safe to send to numeric(14,2). */
export function fromCentavos(cents: Centavos): string {
  if (!Number.isInteger(cents)) throw new RangeError("Centavos must be an integer");
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / CENTAVOS_PER_PESO);
  const frac = abs % CENTAVOS_PER_PESO;
  return `${negative ? "-" : ""}${whole}.${frac.toString().padStart(2, "0")}`;
}

export function addCentavos(...values: Centavos[]): Centavos {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Multiply centavos by a rational factor (numerator/denominator) with half-away-from-zero rounding. */
export function multiplyCentavos(cents: Centavos, numerator: number, denominator = 1): Centavos {
  if (denominator === 0) throw new RangeError("Division by zero");
  return roundHalfAwayFromZero((cents * numerator) / denominator);
}

/**
 * Allocate a total amount across weights proportionally so that the parts sum EXACTLY to the total.
 * Remainder centavos are distributed to the largest fractional remainders first (largest remainder method).
 */
export function allocateCentavos(total: Centavos, weights: number[]): Centavos[] {
  if (!Number.isInteger(total)) throw new RangeError("Total must be integer centavos");
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    // Nothing to weight by: give everything to the first part.
    return weights.map((_, i) => (i === 0 ? total : 0));
  }
  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result;
}

/** Format centavos as Philippine Peso, e.g. ₱1,234.56 */
export function formatPHP(cents: Centavos, options: { showSymbol?: boolean } = {}): string {
  const { showSymbol = true } = options;
  const decimal = Number(fromCentavos(cents));
  const formatted = new Intl.NumberFormat("en-PH", {
    style: showSymbol ? "currency" : "decimal",
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(decimal);
  return formatted;
}

/** Format a decimal string from the database (e.g. "1234.5600") as PHP. */
export function formatPHPDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return formatPHP(toCentavos(value));
}

function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}
