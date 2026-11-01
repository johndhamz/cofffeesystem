"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate } from "@/lib/units/time";
import { ROAST_LEVEL_LABELS } from "@/lib/roasting/calculations";
import { ROAST_STATUS_LABELS } from "../schemas";
import type { RoastBatchSummary } from "@/server/repositories/roasting.repository";
import type { Paginated } from "@/types";

export function RoastBatchesTable({
  data,
  emptyAction,
}: {
  data: Paginated<RoastBatchSummary>;
  emptyAction?: React.ReactNode;
}) {
  const columns: DataTableColumn<RoastBatchSummary>[] = [
    {
      key: "batch_number",
      header: "Batch",
      sortable: true,
      cell: (r) => (
        <Link
          href={`/roasting/${r.id}`}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="row-name"
        >
          {r.batch_number}
        </Link>
      ),
    },
    {
      key: "roast_date",
      header: "Date",
      sortable: true,
      cell: (r) => formatManilaDate(r.roast_date),
    },
    {
      key: "coffee_names",
      header: "Coffee / lots",
      hideOnMobile: true,
      cell: (r) => (
        <span>
          {r.coffee_names ?? "—"}
          <span className="text-muted-foreground block text-xs">{r.lot_codes}</span>
        </span>
      ),
    },
    {
      key: "green_weight_g",
      header: "Green",
      sortable: true,
      align: "right",
      cell: (r) => <WeightDisplay grams={r.green_weight_g} />,
    },
    {
      key: "roasted_weight_g",
      header: "Roasted",
      sortable: true,
      align: "right",
      cell: (r) => <WeightDisplay grams={r.roasted_weight_g} />,
    },
    {
      key: "roast_loss_pct",
      header: "Loss",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (r) => (r.roast_loss_pct !== null ? `${r.roast_loss_pct}%` : "—"),
    },
    {
      key: "roast_level",
      header: "Level",
      hideOnMobile: true,
      cell: (r) => (r.roast_level ? ROAST_LEVEL_LABELS[r.roast_level] : "—"),
    },
    {
      key: "roasted_cost_per_kg",
      header: "Cost / kg",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (r) => <CurrencyDisplay value={r.roasted_cost_per_kg} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <StatusBadge
          status={r.status}
          label={ROAST_STATUS_LABELS[r.status]}
          tone={
            r.status === "completed"
              ? "success"
              : r.status === "in_progress"
                ? "info"
                : r.status === "voided"
                  ? "danger"
                  : "neutral"
          }
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/roasting/${r.id}`}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle="No roast batches"
      emptyDescription="Create a roast batch to consume green coffee and produce roasted bulk stock."
      emptyAction={emptyAction}
      testId="roasts-table"
    />
  );
}
