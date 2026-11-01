"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate } from "@/lib/units/time";
import { PACKAGING_STATUS_LABELS } from "../schemas";
import type { PackagingSessionSummary } from "@/server/repositories/packaging.repository";
import type { Paginated } from "@/types";

export function SessionsTable({
  data,
  emptyAction,
}: {
  data: Paginated<PackagingSessionSummary>;
  emptyAction?: React.ReactNode;
}) {
  const columns: DataTableColumn<PackagingSessionSummary>[] = [
    {
      key: "session_number",
      header: "Session",
      sortable: true,
      cell: (r) => (
        <Link
          href={`/packaging/${r.id}`}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="row-name"
        >
          {r.session_number}
        </Link>
      ),
    },
    {
      key: "packaged_at",
      header: "Date",
      sortable: true,
      cell: (r) => formatManilaDate(r.packaged_at),
    },
    {
      key: "product_names",
      header: "Products",
      hideOnMobile: true,
      cell: (r) => (
        <span>
          {r.product_names ?? "—"}
          <span className="text-muted-foreground block text-xs">{r.batch_numbers}</span>
        </span>
      ),
    },
    {
      key: "required_weight_g",
      header: "Coffee",
      align: "right",
      hideOnMobile: true,
      cell: (r) => <WeightDisplay grams={r.required_weight_g} />,
    },
    {
      key: "output_units",
      header: "Units",
      sortable: true,
      align: "right",
      cell: (r) => r.output_units ?? "—",
    },
    {
      key: "total_cost",
      header: "Total cost",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (r) => <CurrencyDisplay value={r.total_cost} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <StatusBadge
          status={r.status}
          label={PACKAGING_STATUS_LABELS[r.status]}
          tone={r.status === "completed" ? "success" : r.status === "voided" ? "danger" : "neutral"}
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/packaging/${r.id}`}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle="No packaging sessions"
      emptyDescription="Package roasted coffee into finished products."
      emptyAction={emptyAction}
      testId="sessions-table"
    />
  );
}
