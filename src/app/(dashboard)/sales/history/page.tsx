import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate } from "@/lib/units/time";
import { listSalesHistory } from "@/server/services/sales.service";

export const metadata: Metadata = { title: "Sales history" };

export default async function SalesHistoryPage({ searchParams }: PageProps<"/sales/history">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const data = await listSalesHistory({
    from: get("from"),
    to: get("to"),
    page: Math.max(1, Number(get("page") ?? 1) || 1),
    pageSize: 50,
  });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales history"
        description="Every fulfilled line with its revenue, cost snapshot and gross profit."
        breadcrumb={
          <Link href="/sales" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Sales
          </Link>
        }
      />
      <DateRangeFilter />
      {data.rows.length === 0 ? (
        <EmptyState title="No fulfilled sales in this period" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table data-testid="history-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Gross profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const revenue = r.quantity * (r.unit_price_snapshot ?? 0);
                return (
                  <TableRow key={r.id} data-testid="history-row">
                    <TableCell>{formatManilaDate(r.sales_fulfillments?.fulfilled_at)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/sales/${r.sales_fulfillments?.sales_orders?.id}`}
                        className="hover:underline"
                      >
                        {r.sales_fulfillments?.sales_orders?.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.sales_fulfillments?.sales_orders?.customers?.name ?? "Walk-in"}
                    </TableCell>
                    <TableCell>
                      {r.sales_fulfillments?.sales_orders?.sales_channels?.name}
                    </TableCell>
                    <TableCell>
                      {r.sales_order_items?.product_variants?.products?.name}{" "}
                      {r.sales_order_items?.product_variants?.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.finished_goods_lots?.lot_code}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.quantity}
                      {r.returned_quantity ? ` (−${r.returned_quantity})` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={revenue} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={r.total_cost} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={revenue - (r.total_cost ?? 0)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
