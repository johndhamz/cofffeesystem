import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getPurchaseFormOptions, getPurchaseOrder } from "@/server/services/procurement.service";
import { ReceiveGoodsForm } from "@/features/procurement/components/receive-goods-form";

export default async function ReceiveGoodsPage({ params }: PageProps<"/purchases/[id]/receive">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "purchases.post"))
    return <AccessDenied message="Your role cannot receive goods." />;
  const [po, options] = await Promise.all([getPurchaseOrder(id), getPurchaseFormOptions()]);
  if (po.status !== "confirmed" && po.status !== "partially_received") redirect(`/purchases/${id}`);

  const items = (po.purchase_order_items ?? [])
    .filter((i) => i.ordered_quantity_g - i.received_quantity_g > 0)
    .map((i) => ({
      purchase_order_item_id: i.id,
      coffee_name: i.green_coffees?.name ?? "Green coffee",
      ordered_g: i.ordered_quantity_g,
      received_g: i.received_quantity_g,
      unit_cost: i.unit_cost,
    }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Receive goods"
        breadcrumb={
          <Link href={`/purchases/${id}`} className="hover:underline">
            {po.purchase_number}
          </Link>
        }
      />
      <ReceiveGoodsForm
        purchaseOrderId={po.id}
        purchaseNumber={po.purchase_number}
        locations={options.locations.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={options.defaultLocationId}
        items={items}
      />
    </div>
  );
}
