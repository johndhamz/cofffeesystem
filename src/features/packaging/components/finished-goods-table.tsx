"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate } from "@/lib/units/time";
import type { FinishedGoodsRow } from "@/server/repositories/packaging.repository";
import type { Paginated } from "@/types";

export function FinishedGoodsTable({ data }: { data: Paginated<FinishedGoodsRow> }) {
  const columns: DataTableColumn<FinishedGoodsRow>[] = [
    {
      key: "product_name",
      header: "Product",
      sortable: true,
      cell: (r) => (
        <Link
          href={`/inventory/finished/${r.lot_id}`}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="row-name"
        >
          {r.product_name} {r.variant_name}
        </Link>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      sortable: true,
      hideOnMobile: true,
      cell: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: "lot_code",
      header: "Lot",
      sortable: true,
      cell: (r) => <span data-testid="lot-code">{r.lot_code}</span>,
    },
    {
      key: "packaged_at",
      header: "Packaged",
      sortable: true,
      hideOnMobile: true,
      cell: (r) => formatManilaDate(r.packaged_at),
    },
    {
      key: "best_before_at",
      header: "Best before",
      sortable: true,
      hideOnMobile: true,
      cell: (r) => formatManilaDate(r.best_before_at),
    },
    {
      key: "available",
      header: "Available",
      sortable: true,
      align: "right",
      cell: (r) => (
        <span data-testid="available-units" data-units={r.available}>
          {r.available} / {r.packaged_quantity}
        </span>
      ),
    },
    {
      key: "unit_cost",
      header: "Unit cost",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (r) => <CurrencyDisplay value={r.unit_cost} />,
    },
    {
      key: "stock_value",
      header: "Value",
      sortable: true,
      align: "right",
      cell: (r) => <CurrencyDisplay value={r.stock_value} />,
    },
    {
      key: "stock_status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.stock_status ?? "in_stock"} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.lot_id}
      rowHref={(r) => `/inventory/finished/${r.lot_id}`}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle="No finished goods"
      emptyDescription="Complete a packaging session to create finished-goods lots."
      testId="finished-table"
    />
  );
}
