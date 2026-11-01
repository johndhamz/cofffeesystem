/**
 * Packaging arithmetic in integers (grams, units, centavos). Mirrors complete_packaging_session().
 */

export interface OutputLine {
  variantId: string;
  quantity: number;
  netWeightG: number;
}

export interface BomLine {
  variantId: string;
  materialId: string;
  quantityPerUnit: number;
}

function assertPosInt(v: number, name: string) {
  if (!Number.isInteger(v) || v <= 0) throw new RangeError(`${name} must be a positive integer`);
}

/** Total coffee weight required: Σ quantity × net weight. */
export function requiredWeightG(outputs: OutputLine[]): number {
  return outputs.reduce((a, o) => {
    assertPosInt(o.quantity, "quantity");
    assertPosInt(o.netWeightG, "netWeightG");
    return a + o.quantity * o.netWeightG;
  }, 0);
}

/** Material requirements derived from the bill of materials, summed per material. */
export function materialRequirements(outputs: OutputLine[], bom: BomLine[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of outputs) {
    for (const b of bom) {
      if (b.variantId !== o.variantId) continue;
      out.set(b.materialId, (out.get(b.materialId) ?? 0) + b.quantityPerUnit * o.quantity);
    }
  }
  return out;
}

/** Remaining roasted coffee after packaging (input − required). Throws if negative. */
export function remainingRoastedG(inputWeightG: number, outputs: OutputLine[]): number {
  const required = requiredWeightG(outputs);
  if (inputWeightG < required)
    throw new RangeError(`input ${inputWeightG} g is less than required ${required} g`);
  return inputWeightG - required;
}

/**
 * Allocate a total cost (centavos) across outputs proportionally to coffee weight.
 * The last line absorbs the rounding remainder, exactly as the database does, so Σ parts == total.
 */
export function allocateSessionCost(totalCentavos: number, outputs: OutputLine[]): number[] {
  if (!Number.isInteger(totalCentavos) || totalCentavos < 0)
    throw new RangeError("total must be non-negative centavos");
  const weights = outputs.map((o) => o.quantity * o.netWeightG);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new RangeError("outputs must have positive weight");
  const parts: number[] = [];
  let allocated = 0;
  weights.forEach((w, i) => {
    const part =
      i === weights.length - 1 ? totalCentavos - allocated : Math.round((totalCentavos * w) / sum);
    parts.push(part);
    allocated += part;
  });
  return parts;
}

/** Unit cost (pesos, 6 decimals as string) for a line. */
export function unitCost(lineCentavos: number, quantity: number): string {
  assertPosInt(quantity, "quantity");
  const micro = Math.round((lineCentavos * 10_000) / quantity);
  return `${Math.floor(micro / 1_000_000)}.${(micro % 1_000_000).toString().padStart(6, "0")}`;
}

export interface SessionCostInput {
  coffeeCostCentavos: number;
  materialCostCentavos: number;
  laborCentavos?: number;
  overheadCentavos?: number;
}

export function sessionTotalCentavos(i: SessionCostInput): number {
  const parts = [
    i.coffeeCostCentavos,
    i.materialCostCentavos,
    i.laborCentavos ?? 0,
    i.overheadCentavos ?? 0,
  ];
  for (const p of parts)
    if (!Number.isInteger(p) || p < 0)
      throw new RangeError("costs must be non-negative integer centavos");
  return parts.reduce((a, b) => a + b, 0);
}

export const PACKAGING_TYPES = [
  { value: "bag", label: "Bag" },
  { value: "jar", label: "Jar" },
  { value: "box", label: "Box" },
  { value: "sachet", label: "Sachet" },
  { value: "drip_bag", label: "Drip bag" },
  { value: "other", label: "Other" },
] as const;

export const PRODUCT_CATEGORIES = [
  { value: "single_origin", label: "Single origin" },
  { value: "blend", label: "Blend" },
  { value: "decaf", label: "Decaf" },
  { value: "other", label: "Other" },
] as const;
