import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getFulfillmentOptions } from "@/server/services/sales.service";
import { ReturnForm } from "@/features/sales/components/return-form";

export default async function ReturnPage({ params }: PageProps<"/sales/[id]/return">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "sales.manage")) return <AccessDenied message="Your role cannot record returns." />;
  const { order, locations } = await getFulfillmentOptions(id);
  if (!["partially_fulfilled", "fulfilled", "completed", "returned"].includes(order.detail.status))
    redirect(`/sales/${id}`);
  const lines = (order.detail.sales_fulfillments ?? [])
    .filter((f) => f.status === "posted")
    .flatMap((f) =>
      (f.sales_fulfillment_items ?? [])
        .filter((fi) => fi.quantity - fi.returned_quantity > 0)
        .map((fi) => ({
          fulfillment_item_id: fi.id,
          label: `${fi.sales_order_items?.product_variants?.products?.name} ${fi.sales_order_items?.product_variants?.name} · ${f.fulfillment_number}`,
          lot_code: fi.finished_goods_lots?.lot_code ?? "",
          returnable: fi.quantity - fi.returned_quantity,
        })),
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Return for ${order.detail.order_number}`}
        breadcrumb={
          <Link href={`/sales/${id}`} className="hover:underline">
            {order.detail.order_number}
          </Link>
        }
      />
      <ReturnForm
        orderId={id}
        orderNumber={order.detail.order_number}
        lines={lines}
        locations={locations}
        defaultLocationId={null}
      />
    </div>
  );
}
