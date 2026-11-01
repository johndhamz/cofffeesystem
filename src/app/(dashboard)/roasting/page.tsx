import type { Metadata } from "next";
import Link from "next/link";
import { FlameIcon, HistoryIcon, PlusIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { formatWeight } from "@/lib/units";
import { getSessionContext, can } from "@/lib/auth/session";
import { getRoastSummary, listRoastBatches } from "@/server/services/roasting.service";
import { RoastBatchesTable } from "@/features/roasting/components/roast-batches-table";
import { ROAST_STATUS_LABELS } from "@/features/roasting/schemas";

export const metadata: Metadata = { title: "Roast Production" };

export default async function RoastingPage({ searchParams }: PageProps<"/roasting">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const [ctx, data, summary] = await Promise.all([
    getSessionContext(),
    listRoastBatches({
      q: get("q"),
      status: get("status") ?? "all",
      page: Math.max(1, Number(get("page") ?? 1) || 1),
      pageSize: Math.min(100, Math.max(5, Number(get("pageSize") ?? 20) || 20)),
      sort: get("sort") ?? "roast_date",
      dir: get("dir") === "asc" ? "asc" : "desc",
    }),
    getRoastSummary(),
  ]);
  const canManage = can(ctx, "roasting.manage");
  const createButton = canManage ? (
    <Button asChild data-testid="create-button">
      <Link href="/roasting/new">
        <PlusIcon /> New roast
      </Link>
    </Button>
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roast Production"
        description="Roast batches convert green coffee lots into roasted bulk stock when completed."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/roasting/history">
                <HistoryIcon /> History
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/roasting/profiles">
                <SlidersHorizontalIcon /> Profiles
              </Link>
            </Button>
            {createButton}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="roast-metrics">
        <MetricCard
          label="Completed roasts"
          value={summary.completed}
          hint={`${summary.inProgress} in progress · ${summary.drafts} drafts`}
          icon={<FlameIcon className="size-5" />}
        />
        <MetricCard label="Green consumed" value={formatWeight(summary.greenConsumedG)} />
        <MetricCard
          label="Roasted output"
          value={formatWeight(summary.roastedOutputG)}
          hint={summary.avgLossPct !== null ? `avg loss ${summary.avgLossPct}%` : undefined}
        />
        <MetricCard
          label="Roasted on hand"
          value={formatWeight(summary.roastedOnHandG)}
          testId="metric-roasted-on-hand"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search batch, coffee or lot…" />
        <ParamSelect
          paramKey="status"
          label="Status"
          defaultValue="all"
          options={[
            { value: "all", label: "All statuses" },
            ...Object.entries(ROAST_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
      <RoastBatchesTable data={data} emptyAction={createButton} />
    </div>
  );
}
