"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate } from "@/lib/units/time";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  orderTone,
  paymentTone,
} from "@/lib/sales/calculations";
import type { SalesOrderSummary } from "@/server/repositories/sales.repository";
import type { Paginated } from "@/types";

export function OrdersTable({
  data,
  emptyAction,
  compact,
}: {
  data: Paginated<SalesOrderSummary>;
  emptyAction?: React.ReactNode;
  compact?: boolean;
}) {
  const columns: DataTableColumn<SalesOrderSummary>[] = [
    {
      key: "order_number",
      header: "Order",
      sortable: true,
      cell: (r) => (
        <Link
          href={`/sales/${r.id}`}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="row-name"
        >
          {r.order_number}
        </Link>
      ),
    },
    {
      key: "ordered_at",
      header: "Date",
      sortable: true,
      cell: (r) => formatManilaDate(r.ordered_at),
    },
    ...(compact
      ? []
      : [
          {
            key: "customer_name",
            header: "Customer",
            sortable: true,
            cell: (r: SalesOrderSummary) =>
              r.customer_name ?? <span className="text-muted-foreground">Walk-in</span>,
          } as DataTableColumn<SalesOrderSummary>,
        ]),
    {
      key: "channel_name",
      header: "Channel",
      sortable: true,
      hideOnMobile: true,
      cell: (r) => r.channel_name,
    },
    {
      key: "product_names",
      header: "Items",
      hideOnMobile: true,
      cell: (r) => <span className="text-muted-foreground text-xs">{r.product_names}</span>,
    },
    {
      key: "total_amount",
      header: "Total",
      sortable: true,
      align: "right",
      cell: (r) => <CurrencyDisplay value={r.total_amount} />,
    },
    {
      key: "outstanding_amount",
      header: "Due",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      cell: (r) => (
        <CurrencyDisplay value={r.outstanding_amount} muted={(r.outstanding_amount ?? 0) <= 0} />
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <StatusBadge
          status={r.status}
          label={ORDER_STATUS_LABELS[r.status]}
          tone={orderTone(r.status)}
        />
      ),
    },
    {
      key: "payment_status",
      header: "Payment",
      sortable: true,
      cell: (r) => (
        <StatusBadge
          status={r.payment_status}
          label={PAYMENT_STATUS_LABELS[r.payment_status]}
          tone={paymentTone(r.payment_status)}
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/sales/${r.id}`}
      page={data.page}
      pageCount={data.pageCount}
      total={data.total}
      pageSize={data.pageSize}
      emptyTitle="No sales orders"
      emptyDescription="Create an order to sell finished goods."
      emptyAction={emptyAction}
      testId="orders-table"
    />
  );
}
