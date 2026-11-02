import type { Metadata } from "next";
import Link from "next/link";
import { HistoryIcon, PlusIcon, ReceiptIcon, UsersIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { formatPHP, toCentavos } from "@/lib/money";
import { getSessionContext, can } from "@/lib/auth/session";
import { getSalesSummary, listSalesOrders } from "@/server/services/sales.service";
import { OrdersTable } from "@/features/sales/components/orders-table";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/sales/calculations";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const [ctx, data, summary] = await Promise.all([
    getSessionContext(),
    listSalesOrders({
      q: get("q"),
      status: get("status") ?? "all",
      payment: get("payment") ?? "all",
      page: Math.max(1, Number(get("page") ?? 1) || 1),
      pageSize: Math.min(100, Math.max(5, Number(get("pageSize") ?? 20) || 20)),
      sort: get("sort") ?? "ordered_at",
      dir: get("dir") === "asc" ? "asc" : "desc",
    }),
    getSalesSummary(),
  ]);
  const canManage = can(ctx, "sales.manage");
  const canImport = canManage && can(ctx, "inventory.adjust");
  const createButton = canManage ? (
    <Button asChild data-testid="create-button">
      <Link href="/sales/new">
        <PlusIcon /> New order
      </Link>
    </Button>
  ) : null;
  const margin =
    summary.revenue > 0
      ? Math.round(((summary.revenue - summary.cogs) / summary.revenue) * 1000) / 10
      : null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales"
        description="Orders reserve stock on confirmation; stock and cost of goods are recorded when a fulfilment is posted."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/customers">
                <UsersIcon /> Customers
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sales/history">
                <HistoryIcon /> History
              </Link>
            </Button>
            {canImport ? (
              <Button asChild variant="outline" data-testid="import-link">
                <Link href="/sales/import">
                  <UploadIcon /> Import history
                </Link>
              </Button>
            ) : null}
            {createButton}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="sales-metrics">
        <MetricCard
          label="Revenue (fulfilled)"
          value={formatPHP(toCentavos(summary.revenue))}
          hint={`${summary.unitsSold} units sold`}
          icon={<ReceiptIcon className="size-5" />}
          testId="metric-revenue"
        />
        <MetricCard
          label="Gross profit"
          value={formatPHP(toCentavos(summary.revenue - summary.cogs))}
          hint={
            margin !== null
              ? `${margin}% margin · COGS ${formatPHP(toCentavos(summary.cogs))}`
              : "no fulfilled sales yet"
          }
        />
        <MetricCard
          label="Receivable"
          value={formatPHP(toCentavos(summary.outstanding))}
          tone={summary.outstanding > 0 ? "warning" : "default"}
          testId="metric-receivable"
        />
        <MetricCard
          label="Open orders"
          value={summary.open}
          hint={`${summary.orders} orders total`}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search order, customer or product…" />
        <ParamSelect
          paramKey="status"
          label="Status"
          defaultValue="all"
          options={[
            { value: "all", label: "All statuses" },
            ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <ParamSelect
          paramKey="payment"
          label="Payment"
          defaultValue="all"
          options={[
            { value: "all", label: "Any payment" },
            ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
      <OrdersTable data={data} emptyAction={createButton} />
    </div>
  );
}
