import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getFulfillmentOptions } from "@/server/services/sales.service";
import { FulfillmentForm } from "@/features/sales/components/fulfillment-form";

export default async function FulfillPage({ params }: PageProps<"/sales/[id]/fulfill">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "sales.manage")) return <AccessDenied message="Your role cannot fulfil orders." />;
  const { order, lotsByItem, locations } = await getFulfillmentOptions(id);
  if (!["confirmed", "reserved", "partially_fulfilled"].includes(order.detail.status))
    redirect(`/sales/${id}`);
  const lines = (order.detail.sales_order_items ?? [])
    .filter((i) => i.quantity - i.fulfilled_quantity > 0)
    .map((i) => ({
      order_item_id: i.id,
      label: `${i.product_variants?.products?.name} ${i.product_variants?.name} (${i.product_variants?.sku})`,
      outstanding: i.quantity - i.fulfilled_quantity,
      lots: (lotsByItem.find((l) => l.orderItemId === i.id)?.lots ?? []).map((l) => ({
        lot_id: l.lot_id,
        lot_code: l.lot_code,
        available: l.available ?? 0,
        reserved_for_order: (i.sales_order_allocations ?? [])
          .filter((a) => a.finished_goods_lot_id === l.lot_id)
          .reduce((s, a) => s + a.quantity, 0),
      })),
    }));
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Fulfil ${order.detail.order_number}`}
        breadcrumb={
          <Link href={`/sales/${id}`} className="hover:underline">
            {order.detail.order_number}
          </Link>
        }
      />
      <FulfillmentForm
        orderId={id}
        orderNumber={order.detail.order_number}
        lines={lines}
        locations={locations}
        defaultLocationId={lines[0]?.lots.find((l) => l.reserved_for_order > 0) ? null : null}
      />
    </div>
  );
}
