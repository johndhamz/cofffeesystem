/**
 * Roast arithmetic. All inputs are integers (grams, seconds, centavos) so results are exact;
 * percentages are returned in basis points (1/100 of a percent) plus a formatted helper.
 * These mirror the SQL in complete_roast_batch() and are verified against it in integration tests.
 */

export interface RoastWeights {
  greenWeightG: number;
  roastedWeightG: number;
}

function assertPositiveInt(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0)
    throw new RangeError(`${name} must be a positive integer`);
}

/** Roast loss % = (green - roasted) / green * 100, rounded half-up to 2 decimals. */
export function roastLossPct({ greenWeightG, roastedWeightG }: RoastWeights): number {
  assertPositiveInt(greenWeightG, "greenWeightG");
  assertPositiveInt(roastedWeightG, "roastedWeightG");
  if (roastedWeightG > greenWeightG)
    throw new RangeError("roasted weight cannot exceed green weight");
  return roundTo2((greenWeightG - roastedWeightG) * 100, greenWeightG);
}

/** Roast yield % = roasted / green * 100. */
export function roastYieldPct({ greenWeightG, roastedWeightG }: RoastWeights): number {
  assertPositiveInt(greenWeightG, "greenWeightG");
  assertPositiveInt(roastedWeightG, "roastedWeightG");
  if (roastedWeightG > greenWeightG)
    throw new RangeError("roasted weight cannot exceed green weight");
  return roundTo2(roastedWeightG * 100, greenWeightG);
}

/** Development time (s) = total duration - first crack time. */
export function developmentSeconds(
  totalDurationSeconds: number,
  firstCrackSeconds: number,
): number {
  assertPositiveInt(totalDurationSeconds, "totalDurationSeconds");
  if (!Number.isInteger(firstCrackSeconds) || firstCrackSeconds < 0)
    throw new RangeError("firstCrackSeconds must be >= 0");
  if (firstCrackSeconds > totalDurationSeconds)
    throw new RangeError("first crack cannot occur after the roast ends");
  return totalDurationSeconds - firstCrackSeconds;
}

/** Development ratio % = development time / total duration * 100. */
export function developmentRatioPct(
  totalDurationSeconds: number,
  firstCrackSeconds: number,
): number {
  const dev = developmentSeconds(totalDurationSeconds, firstCrackSeconds);
  return roundTo2(dev * 100, totalDurationSeconds);
}

export interface ProductionCostInput {
  greenCostCentavos: number;
  lpgCentavos?: number;
  laborCentavos?: number;
  overheadCentavos?: number;
  otherCentavos?: number;
}

/** Total production cost in centavos. */
export function productionCostCentavos(input: ProductionCostInput): number {
  const parts = [
    input.greenCostCentavos,
    input.lpgCentavos ?? 0,
    input.laborCentavos ?? 0,
    input.overheadCentavos ?? 0,
    input.otherCentavos ?? 0,
  ];
  for (const p of parts)
    if (!Number.isInteger(p) || p < 0)
      throw new RangeError("costs must be non-negative integer centavos");
  return parts.reduce((a, b) => a + b, 0);
}

/**
 * Roasted cost per gram, in micro-centavos precision (6 decimals of pesos → returned as a decimal string).
 * Matches numeric(14,6) in the database: round(total / roasted_g, 6).
 */
export function roastedCostPerGram(totalCostCentavos: number, roastedWeightG: number): string {
  assertPositiveInt(roastedWeightG, "roastedWeightG");
  if (!Number.isInteger(totalCostCentavos) || totalCostCentavos < 0)
    throw new RangeError("total cost must be non-negative centavos");
  // pesos with 6 decimals = centavos * 10_000 / grams, as an integer of micro-pesos
  const microPesos = Math.round((totalCostCentavos * 10_000) / roastedWeightG);
  const whole = Math.floor(microPesos / 1_000_000);
  const frac = microPesos % 1_000_000;
  return `${whole}.${frac.toString().padStart(6, "0")}`;
}

/** Roasted cost per kilogram in centavos (rounded). */
export function roastedCostPerKgCentavos(
  totalCostCentavos: number,
  roastedWeightG: number,
): number {
  assertPositiveInt(roastedWeightG, "roastedWeightG");
  return Math.round((totalCostCentavos * 1000) / roastedWeightG);
}

/** Capacity check used for the draft warning and the completion policy. */
export function capacityStatus(
  greenWeightG: number,
  capacityG: number,
): { over: boolean; pct: number } {
  if (capacityG <= 0) return { over: false, pct: 0 };
  return { over: greenWeightG > capacityG, pct: Math.round((greenWeightG * 100) / capacityG) };
}

/** Rate of rise (°C/min) between two bean-temperature samples. Returns null when not computable. */
export function rateOfRise(
  prev: { elapsedSeconds: number; btC: number } | null,
  curr: { elapsedSeconds: number; btC: number },
): number | null {
  if (!prev) return null;
  const dt = curr.elapsedSeconds - prev.elapsedSeconds;
  if (dt <= 0) return null;
  return Math.round(((curr.btC - prev.btC) * 60 * 1000) / dt) / 1000;
}

/**
 * Parses a duration typed in minutes into whole seconds. Accepts "10" / "10.5" (minutes),
 * "10:30" (mm:ss) and "10m 30s". Returns null when the text is not a duration.
 */
export function parseMinutesToSeconds(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 60) : null;
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (text === "") return null;
  let m = /^(\d+):([0-5]?\d)$/.exec(text);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(?:(\d+(?:\.\d+)?)m(?:in)?)?(?:(\d+)s(?:ec)?)?$/.exec(text);
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0);
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 60);
  return null;
}

/** Seconds → "m:ss" for editing (the inverse of parseMinutesToSeconds). */
export function secondsToMinutesText(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "";
  return formatDuration(Math.round(seconds));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** numerator / denominator rounded half-up to 2 decimals using integer arithmetic. */
function roundTo2(numerator: number, denominator: number): number {
  // value*100 rounded, then /100
  const scaled = numerator * 100; // now in hundredths of a percent
  const q = Math.floor(scaled / denominator);
  const r = scaled - q * denominator;
  const rounded = r * 2 >= denominator ? q + 1 : q;
  return rounded / 100;
}

export const ROAST_LEVELS = [
  { value: "light", label: "Light" },
  { value: "medium_light", label: "Medium-light" },
  { value: "medium", label: "Medium" },
  { value: "medium_dark", label: "Medium-dark" },
  { value: "dark", label: "Dark" },
] as const;
export type RoastLevel = (typeof ROAST_LEVELS)[number]["value"];
export const ROAST_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  ROAST_LEVELS.map((l) => [l.value, l.label]),
);
