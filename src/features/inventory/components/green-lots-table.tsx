"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate } from "@/lib/units/time";
import type { GreenLotInventoryRow, Paginated } from "@/types";

export function GreenLotsTable({ data }: { data: Paginated<GreenLotInventoryRow> }) {
  const columns: DataTableColumn<GreenLotInventoryRow>[] = [
    {
      key: "coffee_name",
      header: "Coffee",
      sortable: true,
      cell: (row) => (
        <Link
          href={`/inventory/lots/${row.lot_id}`}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="row-name"
        >
          {row.coffee_name}
        </Link>
      ),
    },
    {
      key: "country",
      header: "Origin",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => [row.region, row.country].filter(Boolean).join(", ") || "—",
    },
    {
      key: "lot_code",
      header: "Lot",
      sortable: true,
      cell: (row) => <span data-testid="lot-code">{row.lot_code}</span>,
    },
    {
      key: "supplier_name",
      header: "Supplier",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.supplier_name ?? "—",
    },
    {
      key: "received_quantity_g",
      header: "Received",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (row) => <WeightDisplay grams={row.received_quantity_g} />,
    },
    {
      key: "available_g",
      header: "Available",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span data-testid="available-g" data-grams={row.available_g}>
          <WeightDisplay grams={row.available_g} />
        </span>
      ),
    },
    {
      key: "reserved_g",
      header: "Reserved",
      align: "right",
      hideOnMobile: true,
      cell: (row) => <WeightDisplay grams={row.reserved_g} />,
    },
    {
      key: "cost_per_kg",
      header: "Cost / kg",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (row) => <CurrencyDisplay value={row.cost_per_kg} />,
    },
    {
      key: "stock_value",
      header: "Value",
      sortable: true,
      align: "right",
      cell: (row) => <CurrencyDisplay value={row.stock_value} />,
    },
    {
      key: "last_received_at",
      header: "Last received",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => formatManilaDate(row.last_received_at),
    },
    {
      key: "stock_status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.stock_status ?? "in_stock"} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.lot_id}
      rowHref={(r) => `/inventory/lots/${r.lot_id}`}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle="No green coffee lots"
      emptyDescription="Lots are created when goods are received against a confirmed purchase order."
      testId="lots-table"
    />
  );
}
