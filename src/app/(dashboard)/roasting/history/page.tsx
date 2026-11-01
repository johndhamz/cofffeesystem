import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import { getRoastSummary, listRoastBatches } from "@/server/services/roasting.service";
import { RoastBatchesTable } from "@/features/roasting/components/roast-batches-table";

export const metadata: Metadata = { title: "Roast history" };

export default async function RoastHistoryPage({ searchParams }: PageProps<"/roasting/history">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const range = { from: get("from"), to: get("to") };
  const [data, summary] = await Promise.all([
    listRoastBatches({
      status: "completed",
      from: range.from,
      to: range.to,
      page: Math.max(1, Number(get("page") ?? 1) || 1),
      pageSize: Math.min(100, Math.max(5, Number(get("pageSize") ?? 25) || 25)),
      sort: get("sort") ?? "roast_date",
      dir: get("dir") === "asc" ? "asc" : "desc",
    }),
    getRoastSummary(range),
  ]);
  const perKg =
    summary.roastedOutputG > 0
      ? Math.round((toCentavos(summary.productionCost) * 1000) / summary.roastedOutputG)
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roast production history"
        description="Completed batches with yield summary for the selected period."
        breadcrumb={
          <Link href="/roasting" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Roast Production
          </Link>
        }
      />
      <DateRangeFilter />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="yield-summary">
        <MetricCard label="Completed roasts" value={summary.completed} />
        <MetricCard label="Green consumed" value={formatWeight(summary.greenConsumedG)} />
        <MetricCard label="Roasted output" value={formatWeight(summary.roastedOutputG)} />
        <MetricCard
          label="Average loss"
          value={summary.avgLossPct !== null ? `${summary.avgLossPct}%` : "—"}
          hint={
            summary.avgLossPct !== null
              ? `yield ${Math.round((100 - summary.avgLossPct) * 100) / 100}%`
              : undefined
          }
        />
        <MetricCard
          label="Avg cost / roasted kg"
          value={perKg !== null ? formatPHP(perKg) : "—"}
          hint={`total ${formatPHP(toCentavos(summary.productionCost))}`}
        />
      </div>
      <RoastBatchesTable data={data} />
    </div>
  );
}
