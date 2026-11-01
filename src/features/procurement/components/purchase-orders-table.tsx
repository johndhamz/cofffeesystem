"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate } from "@/lib/units/time";
import type { Paginated, PurchaseOrder } from "@/types";

type Row = PurchaseOrder & { suppliers: { id: string; name: string } | null };

export function PurchaseOrdersTable({
  data,
  emptyAction,
}: {
  data: Paginated<Row>;
  emptyAction?: React.ReactNode;
}) {
  const columns: DataTableColumn<Row>[] = [
    {
      key: "purchase_number",
      header: "PO #",
      sortable: true,
      cell: (row) => (
        <Link
          href={`/purchases/${row.id}`}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="row-name"
        >
          {row.purchase_number}
        </Link>
      ),
    },
    { key: "supplier", header: "Supplier", cell: (row) => row.suppliers?.name ?? "—" },
    {
      key: "ordered_at",
      header: "Ordered",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => formatManilaDate(row.ordered_at),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      align: "right",
      cell: (row) => <CurrencyDisplay value={row.total} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/purchases/${r.id}`}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle="No purchase orders"
      emptyDescription="Create a purchase order to start buying green coffee."
      emptyAction={emptyAction}
      testId="purchases-table"
    />
  );
}
