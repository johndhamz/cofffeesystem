import { z } from "zod";
import { dateString } from "@/lib/validation/common";

export const REPORT_KEYS = [
  "production",
  "green-inventory",
  "finished-goods",
  "sales",
  "expenses",
  "profitability",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const reportFilterSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  origin: z.string().trim().max(80).optional(),
  product: z.string().uuid().optional(),
  customer: z.string().uuid().optional(),
  channel: z.string().uuid().optional(),
  operator: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

/** Default range: current month in Asia/Manila. */
export function defaultRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function parseReportFilter(
  params: Record<string, string | string[] | undefined>,
  today: string,
): ReportFilter & { from: string; to: string } {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = reportFilterSchema.safeParse(flat);
  const f = parsed.success ? parsed.data : reportFilterSchema.parse({});
  const d = defaultRange(today);
  return { ...f, from: f.from ?? d.from, to: f.to ?? d.to };
}

export const REPORT_META: Record<
  ReportKey,
  { title: string; description: string; finance: boolean }
> = {
  production: {
    title: "Production report",
    description:
      "Completed roast batches: green input, roasted output, loss, yield, cost per roasted kg.",
    finance: false,
  },
  "green-inventory": {
    title: "Green inventory report",
    description: "Green coffee lots with available quantity, cost and valuation.",
    finance: false,
  },
  "finished-goods": {
    title: "Finished goods report",
    description: "Packaged products by lot with quantity, unit cost and total value.",
    finance: false,
  },
  sales: {
    title: "Sales report",
    description: "Fulfilled sales lines with revenue, COGS and gross profit.",
    finance: true,
  },
  expenses: {
    title: "Expense report",
    description: "Expenses by category, date and classification.",
    finance: true,
  },
  profitability: {
    title: "Profitability report",
    description: "Net sales, COGS, gross profit, operating expenses and operating result.",
    finance: true,
  },
};
