import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate, formatManilaDateTime } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { getSalesOrder } from "@/server/services/sales.service";
import { OrderActions } from "@/features/sales/components/order-actions";
import { RefundDialog } from "@/features/sales/components/refund-dialog";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  orderTone,
  paymentTone,
} from "@/lib/sales/calculations";

const METHOD: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

export default async function OrderDetailPage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  const [ctx, { summary, detail }] = await Promise.all([getSessionContext(), getSalesOrder(id)]);
  const canManage = can(ctx, "sales.manage");
  const outstanding = summary.outstanding_amount ?? 0;
  const fulfillments = (detail.sales_fulfillments ?? []).filter((f) => f.status === "posted");
  const cogs = fulfillments.reduce(
    (a, f) => a + (f.sales_fulfillment_items ?? []).reduce((s, i) => s + (i.total_cost ?? 0), 0),
    0,
  );
  const revenueFulfilled = fulfillments.reduce(
    (a, f) =>
      a +
      (f.sales_fulfillment_items ?? []).reduce(
        (s, i) => s + i.quantity * (i.unit_price_snapshot ?? 0),
        0,
      ),
    0,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.order_number}
        description={`${detail.customers?.name ?? "Walk-in"} · ${summary.channel_name} · ${formatManilaDate(detail.ordered_at)} · ${detail.price_tier} pricing`}
        breadcrumb={
          <Link href="/sales" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Sales
          </Link>
        }
        actions={
          <>
            <StatusBadge
              status={detail.status}
              label={ORDER_STATUS_LABELS[detail.status]}
              tone={orderTone(detail.status)}
            />
            <StatusBadge
              status={detail.payment_status}
              label={PAYMENT_STATUS_LABELS[detail.payment_status]}
              tone={paymentTone(detail.payment_status)}
            />
            <OrderActions
              id={detail.id}
              status={detail.status}
              canManage={canManage}
              outstanding={outstanding}
              hasItems={(detail.sales_order_items ?? []).length > 0}
            />
          </>
        }
      />
      {detail.cancel_reason ? (
        <p className="text-destructive text-sm">
          Cancelled {formatManilaDateTime(detail.cancelled_at)}: {detail.cancel_reason}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="order-stats">
        <MetricCard
          label="Total"
          value={<CurrencyDisplay value={detail.total_amount} />}
          hint={
            detail.discount_amount > 0
              ? `after ₱${detail.discount_amount.toFixed(2)} order discount`
              : undefined
          }
          testId="stat-total"
        />
        <MetricCard
          label="Paid / balance"
          value={<CurrencyDisplay value={detail.amount_paid - detail.amount_refunded} />}
          hint={`balance ₱${outstanding.toFixed(2)}${detail.amount_refunded > 0 ? ` · refunded ₱${detail.amount_refunded.toFixed(2)}` : ""}`}
          tone={outstanding > 0 ? "warning" : "default"}
          testId="stat-paid"
        />
        <MetricCard
          label="Fulfilled"
          value={`${summary.fulfilled_units ?? 0} / ${summary.ordered_units ?? 0} units`}
          hint={
            (summary.returned_units ?? 0) > 0 ? `${summary.returned_units} returned` : undefined
          }
          testId="stat-fulfilled"
        />
        <MetricCard
          label="COGS / gross profit"
          value={<CurrencyDisplay value={cogs} />}
          hint={
            fulfillments.length
              ? `gross profit ₱${(revenueFulfilled - cogs).toFixed(2)}`
              : "recorded on fulfilment"
          }
          testId="stat-cogs"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="order-items">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Fulfilled</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead>Reserved lots</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detail.sales_order_items ?? []).map((i) => (
                <TableRow key={i.id} data-testid="order-item">
                  <TableCell className="font-medium">
                    {i.product_variants?.products?.name} {i.product_variants?.name}
                    <span className="text-muted-foreground block font-mono text-xs">
                      {i.product_variants?.sku}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{i.quantity}</TableCell>
                  <TableCell className="text-right" data-testid="item-fulfilled">
                    {i.fulfilled_quantity}
                    {i.returned_quantity ? ` (−${i.returned_quantity} ret.)` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={i.unit_price} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={i.discount_amount} muted={i.discount_amount === 0} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={i.line_total} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {(i.sales_order_allocations ?? [])
                      .map((a) => `${a.finished_goods_lots?.lot_code} ×${a.quantity}`)
                      .join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {detail.notes ? (
            <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">{detail.notes}</p>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fulfilments</CardTitle>
            <CardDescription>
              Each line snapshots the exact cost of the finished lot sold.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fulfillments.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="no-fulfillments">
                Nothing shipped yet.
              </p>
            ) : (
              <ul className="space-y-3" data-testid="fulfillments">
                {fulfillments.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-md border p-3 text-sm"
                    data-testid="fulfillment"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{f.fulfillment_number}</span>
                      <span className="text-muted-foreground">
                        {formatManilaDate(f.fulfilled_at)} · {f.inventory_locations?.name}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {(f.sales_fulfillment_items ?? []).map((fi) => (
                        <li
                          key={fi.id}
                          className="flex justify-between"
                          data-testid="fulfillment-item"
                        >
                          <span>
                            {fi.sales_order_items?.product_variants?.products?.name}{" "}
                            {fi.sales_order_items?.product_variants?.name} × {fi.quantity} · lot{" "}
                            <Link
                              href={`/inventory/finished/${fi.finished_goods_lot_id}`}
                              className="hover:underline"
                            >
                              {fi.finished_goods_lots?.lot_code}
                            </Link>
                            {fi.returned_quantity ? ` · ${fi.returned_quantity} returned` : ""}
                          </span>
                          <span className="tabular-nums" data-testid="fulfillment-cost">
                            cost ₱{(fi.unit_cost_snapshot ?? 0).toFixed(4)}/unit ·{" "}
                            <CurrencyDisplay value={fi.total_cost} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments &amp; refunds</CardTitle>
            <CardDescription>Tracked separately from revenue.</CardDescription>
          </CardHeader>
          <CardContent>
            {(detail.payments ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="no-payments">
                No payments recorded.
              </p>
            ) : (
              <ul className="divide-y text-sm" data-testid="payments">
                {(detail.payments ?? []).map((p) => {
                  const refunded = (p.refunds ?? [])
                    .filter((r) => r.status === "issued")
                    .reduce((a, r) => a + r.amount, 0);
                  return (
                    <li key={p.id} className="space-y-1 py-2" data-testid="payment">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {formatManilaDate(p.received_at)} · {METHOD[p.payment_method]}
                          {p.payment_reference ? ` · ${p.payment_reference}` : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <CurrencyDisplay value={p.amount} />
                          {canManage && p.status === "received" && p.amount - refunded > 0 ? (
                            <RefundDialog
                              orderId={detail.id}
                              paymentId={p.id}
                              refundable={p.amount - refunded}
                              method={p.payment_method}
                            />
                          ) : null}
                        </span>
                      </div>
                      {(p.refunds ?? []).map((r) => (
                        <div
                          key={r.id}
                          className="text-muted-foreground flex justify-between pl-4 text-xs"
                          data-testid="refund"
                        >
                          <span>
                            Refund {formatManilaDate(r.refunded_at)} · {r.reason}
                          </span>
                          <span>
                            −<CurrencyDisplay value={r.amount} />
                          </span>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {(detail.sales_returns ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm" data-testid="returns">
              {(detail.sales_returns ?? []).map((r) => (
                <li key={r.id} className="rounded-md border p-3" data-testid="return">
                  <div className="flex justify-between">
                    <span className="font-medium">{r.return_number}</span>
                    <span className="text-muted-foreground">
                      {formatManilaDate(r.received_at)} · {r.reason}
                    </span>
                  </div>
                  <ul className="mt-1 text-xs">
                    {(r.sales_return_items ?? []).map((ri) => (
                      <li key={ri.id} data-testid="return-item">
                        {ri.quantity} × lot{" "}
                        {ri.sales_fulfillment_items?.finished_goods_lots?.lot_code} · {ri.condition}{" "}
                        · <strong>{ri.disposition}</strong>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Created {formatManilaDateTime(detail.created_at)}
        {detail.confirmed_at ? ` · confirmed ${formatManilaDateTime(detail.confirmed_at)}` : ""}
        {detail.completed_at ? ` · completed ${formatManilaDateTime(detail.completed_at)}` : ""}
      </p>
    </div>
  );
}
