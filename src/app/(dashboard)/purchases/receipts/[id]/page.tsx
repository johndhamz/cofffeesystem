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
import { getGoodsReceipt } from "@/server/services/procurement.service";

export default async function GoodsReceiptPage({ params }: PageProps<"/purchases/receipts/[id]">) {
  const { id } = await params;
  const receipt = await getGoodsReceipt(id);
  const items = receipt.goods_receipt_items ?? [];
  const totalG = items.reduce((a, i) => a + i.received_quantity_g, 0);
  const totalCost = items.reduce((a, i) => a + (i.total_cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={receipt.receipt_number}
        description={`${receipt.purchase_orders?.suppliers?.name ?? ""} · received ${formatManilaDate(receipt.received_at)} into ${receipt.inventory_locations?.name ?? ""}`}
        breadcrumb={
          <Link
            href={`/purchases/${receipt.purchase_order_id}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeftIcon className="size-3" /> {receipt.purchase_orders?.purchase_number}
          </Link>
        }
        actions={<StatusBadge status={receipt.status} />}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Received lots</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="receipt-items-table">
            <TableHeader>
              <TableRow>
                <TableHead>Green coffee</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Purchase cost</TableHead>
                <TableHead className="text-right">PO cost share</TableHead>
                <TableHead className="text-right">Landed</TableHead>
                <TableHead className="text-right">Lot cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid="receipt-item">
                  <TableCell className="font-medium">
                    {item.purchase_order_items?.green_coffees?.name}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/inventory/lots/${item.green_lot_id}`}
                      className="hover:underline"
                      data-testid="lot-link"
                    >
                      {item.green_coffee_lots?.lot_code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <WeightDisplay grams={item.received_quantity_g} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.purchase_cost} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.po_cost_share} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.allocated_landed_cost} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={item.total_cost} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 ml-auto grid w-full max-w-xs gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total weight</span>
              <WeightDisplay grams={totalG} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt landed costs</span>
              <CurrencyDisplay value={receipt.additional_costs} />
            </div>
            <div className="flex justify-between font-medium">
              <span>Total lot cost</span>
              <CurrencyDisplay value={totalCost} />
            </div>
          </div>
          {receipt.notes ? (
            <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
              {receipt.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        {receipt.posted_at ? `Posted ${formatManilaDateTime(receipt.posted_at)}` : "Not posted"}
      </p>
    </div>
  );
}
