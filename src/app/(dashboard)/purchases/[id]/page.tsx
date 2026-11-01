import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate, formatManilaDateTime } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { getPurchaseOrder } from "@/server/services/procurement.service";
import { PurchaseOrderActions } from "@/features/procurement/components/purchase-order-actions";
import { PO_STATUS_LABELS } from "@/features/procurement/schemas";

export default async function PurchaseOrderDetailPage({ params }: PageProps<"/purchases/[id]">) {
  const { id } = await params;
  const [ctx, po] = await Promise.all([getSessionContext(), getPurchaseOrder(id)]);
  const items = po.purchase_order_items ?? [];
  const receipts = (po.goods_receipts ?? []).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.purchase_number}
        description={`${po.suppliers?.name ?? "Supplier"} · ordered ${formatManilaDate(po.ordered_at)}`}
        breadcrumb={
          <Link href="/purchases" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Purchases
          </Link>
        }
        actions={
          <>
            <StatusBadge status={po.status} label={PO_STATUS_LABELS[po.status]} />
            <PurchaseOrderActions
              id={po.id}
              status={po.status}
              canManage={can(ctx, "purchases.manage")}
              canPost={can(ctx, "purchases.post")}
              hasItems={items.length > 0}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="po-items-table">
            <TableHeader>
              <TableRow>
                <TableHead>Green coffee</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Cost / kg</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid="po-item">
                  <TableCell className="font-medium">{item.green_coffees?.name}</TableCell>
                  <TableCell className="text-right">
                    <WeightDisplay grams={item.ordered_quantity_g} />
                  </TableCell>
                  <TableCell className="text-right" data-testid="po-item-received">
                    <WeightDisplay grams={item.received_quantity_g} />
                  </TableCell>
                  <TableCell className="text-right">
                    <WeightDisplay grams={item.ordered_quantity_g - item.received_quantity_g} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.unit_cost} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.line_total} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 ml-auto grid w-full max-w-xs gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <CurrencyDisplay value={po.subtotal} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Additional costs</span>
              <CurrencyDisplay value={po.additional_costs} />
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <CurrencyDisplay value={po.total} />
            </div>
          </div>
          {po.notes ? (
            <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">{po.notes}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goods receipts</CardTitle>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="no-receipts">
              No goods received yet. Stock increases only when a receipt is posted.
            </p>
          ) : (
            <ul className="divide-y" data-testid="receipts-list">
              {receipts.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    <Link
                      href={`/purchases/receipts/${r.id}`}
                      className="font-medium hover:underline"
                      data-testid="receipt-link"
                    >
                      {r.receipt_number}
                    </Link>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatManilaDate(r.received_at)} · {r.inventory_locations?.name} ·{" "}
                      {(r.goods_receipt_items ?? [])
                        .map((i) => i.green_coffee_lots?.lot_code)
                        .join(", ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <WeightDisplay
                      grams={(r.goods_receipt_items ?? []).reduce(
                        (a, i) => a + i.received_quantity_g,
                        0,
                      )}
                    />
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Created {formatManilaDateTime(po.created_at)}
        {po.confirmed_at ? ` · confirmed ${formatManilaDateTime(po.confirmed_at)}` : ""}
        {po.cancelled_at ? ` · cancelled ${formatManilaDateTime(po.cancelled_at)}` : ""}
      </p>
    </div>
  );
}
