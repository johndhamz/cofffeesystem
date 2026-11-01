import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { ActiveBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate, formatManilaDateTime } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { getCustomer } from "@/server/services/sales.service";
import { getDynamicOptions } from "@/server/services/master-data.service";
import { MasterRowActions } from "@/features/settings/master-data/row-actions";
import { OrdersTable } from "@/features/sales/components/orders-table";

export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const [ctx, { customer, orders }, dynamicOptions] = await Promise.all([
    getSessionContext(),
    getCustomer(id),
    getDynamicOptions("customers"),
  ]);
  const canManage = can(ctx, "customers.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={`${customer.customer_type === "wholesale" ? "Wholesale" : "Retail"} customer · ${customer.payment_terms_days ? `${customer.payment_terms_days}-day terms` : "pay on order"}`}
        breadcrumb={
          <Link href="/customers" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Customers
          </Link>
        }
        actions={
          <>
            <ActiveBadge isActive={customer.is_active} />
            <MasterRowActions
              entityKey="customers"
              record={customer as never}
              canManage={canManage}
              canDelete={ctx?.business?.role === "owner"}
              expanded
              dynamicOptions={dynamicOptions}
            />
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="customer-stats">
        <MetricCard label="Orders" value={customer.orders} testId="customer-orders" />
        <MetricCard
          label="Revenue (fulfilled)"
          value={<CurrencyDisplay value={customer.revenue} />}
          testId="customer-revenue"
        />
        <MetricCard
          label="Outstanding"
          value={<CurrencyDisplay value={customer.outstanding} />}
          tone={(customer.outstanding ?? 0) > 0 ? "warning" : "default"}
          testId="customer-outstanding"
        />
        <MetricCard label="Last order" value={formatManilaDate(customer.last_order_at)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Email</dt>
                <dd>{customer.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Phone</dt>
                <dd>{customer.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Address</dt>
                <dd className="whitespace-pre-wrap">{customer.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Notes</dt>
                <dd className="whitespace-pre-wrap">{customer.notes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Since</dt>
                <dd>{formatManilaDateTime(customer.created_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase history</CardTitle>
          </CardHeader>
          <CardContent>
            <OrdersTable data={orders} compact />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
