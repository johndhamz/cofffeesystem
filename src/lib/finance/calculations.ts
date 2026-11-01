/**
 * Management-reporting arithmetic in integer centavos. Mirrors the SQL report functions.
 * Revenue is recognised on fulfilment; payments are not revenue.
 */

function assertInt(v: number, name: string) {
  if (!Number.isInteger(v)) throw new RangeError(`${name} must be integer centavos`);
}

export function grossProfitCentavos(netSalesCentavos: number, cogsCentavos: number): number {
  assertInt(netSalesCentavos, "netSales");
  assertInt(cogsCentavos, "cogs");
  return netSalesCentavos - cogsCentavos;
}

/** Gross margin % (2 decimals), null when there are no sales. */
export function grossMarginPct(netSalesCentavos: number, cogsCentavos: number): number | null {
  if (netSalesCentavos <= 0) return null;
  return Math.round(((netSalesCentavos - cogsCentavos) * 10000) / netSalesCentavos) / 100;
}

export function operatingResultCentavos(
  netSalesCentavos: number,
  cogsCentavos: number,
  operatingExpensesCentavos: number,
): number {
  assertInt(operatingExpensesCentavos, "opex");
  return grossProfitCentavos(netSalesCentavos, cogsCentavos) - operatingExpensesCentavos;
}

export interface SalesLineInput {
  units: number;
  returnedUnits: number;
  restockedUnits: number;
  unitPriceCentavos: number;
  unitCostMicroPesos: number; // cost per unit in micro-pesos (6 decimals) as stored
  lineDiscountCentavos: number; // discount on the whole ordered line
  orderedUnits: number;
}

/** Net revenue for a fulfilled line: sold units × price − proportional line discount (order discount handled separately). */
export function lineNetRevenueCentavos(l: SalesLineInput): number {
  const net = l.units - l.returnedUnits;
  if (net < 0) throw new RangeError("returned units exceed sold units");
  const discountShare =
    l.orderedUnits > 0 ? Math.round((l.lineDiscountCentavos * net) / l.orderedUnits) : 0;
  return net * l.unitPriceCentavos - discountShare;
}

/** COGS for a line: cost of units that stayed sold (restocked returns are credited back). */
export function lineCogsCentavos(l: SalesLineInput): number {
  const kept = l.units - l.restockedUnits;
  return Math.round((kept * l.unitCostMicroPesos) / 10_000);
}

export type CostTreatment =
  | "inventory_acquisition"
  | "roast_production"
  | "packaging_production"
  | "selling"
  | "administrative"
  | "other_operating"
  | "capital";

export const COST_TREATMENTS: {
  value: CostTreatment;
  label: string;
  operating: boolean;
  hint: string;
}[] = [
  {
    value: "inventory_acquisition",
    label: "Inventory acquisition",
    operating: false,
    hint: "Green coffee / materials purchases — already in inventory cost",
  },
  {
    value: "roast_production",
    label: "Roast production",
    operating: false,
    hint: "LPG, roasting labor — recognised through batch costs (COGS)",
  },
  {
    value: "packaging_production",
    label: "Packaging production",
    operating: false,
    hint: "Packaging labor/overhead — recognised through session costs (COGS)",
  },
  {
    value: "selling",
    label: "Selling expense",
    operating: true,
    hint: "Delivery, marketplace fees, marketing",
  },
  {
    value: "administrative",
    label: "Administrative expense",
    operating: true,
    hint: "Rent, utilities, admin salaries",
  },
  {
    value: "other_operating",
    label: "Other operating expense",
    operating: true,
    hint: "Everything else that hits the period",
  },
  {
    value: "capital",
    label: "Capital expenditure",
    operating: false,
    hint: "Equipment — an asset, not a period expense",
  },
];

/** Operating expenses count a cost exactly once: production/acquisition treatments live inside COGS. */
export function isOperatingTreatment(t: CostTreatment): boolean {
  return COST_TREATMENTS.find((c) => c.value === t)?.operating ?? false;
}

export function operatingExpensesCentavos(
  expenses: { amountCentavos: number; treatment: CostTreatment; voided?: boolean }[],
): number {
  return expenses.reduce(
    (a, e) => (e.voided || !isOperatingTreatment(e.treatment) ? a : a + e.amountCentavos),
    0,
  );
}

/** Allocation validation: Σ allocations ≤ expense. */
export function remainingAllocatableCentavos(
  expenseCentavos: number,
  allocations: number[],
): number {
  const sum = allocations.reduce((a, b) => {
    if (!Number.isInteger(b) || b <= 0)
      throw new RangeError("allocations must be positive integer centavos");
    return a + b;
  }, 0);
  if (sum > expenseCentavos) throw new RangeError("allocations exceed the expense");
  return expenseCentavos - sum;
}

/** Inventory valuation = Σ remaining cost of layers; equals Σ quantity × unit cost when layers are consistent. */
export function inventoryValuationCentavos(
  layers: { remainingQuantity: number; remainingCostCentavos: number }[],
): number {
  return layers.reduce((a, l) => {
    if (l.remainingQuantity < 0 || l.remainingCostCentavos < 0)
      throw new RangeError("negative layer");
    return a + l.remainingCostCentavos;
  }, 0);
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return (
    [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join(
      "\r\n",
    ) + "\r\n"
  );
}
