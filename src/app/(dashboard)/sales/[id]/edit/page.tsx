import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getOrderFormOptions, getSalesOrder } from "@/server/services/sales.service";
import { OrderForm } from "@/features/sales/components/order-form";

export default async function EditOrderPage({ params }: PageProps<"/sales/[id]/edit">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "sales.manage"))
    return <AccessDenied message="Your role cannot edit sales orders." />;
  const [{ detail }, options] = await Promise.all([getSalesOrder(id), getOrderFormOptions()]);
  if (detail.status !== "draft") redirect(`/sales/${id}`);
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit ${detail.order_number}`}
        breadcrumb={
          <Link href={`/sales/${id}`} className="hover:underline">
            {detail.order_number}
          </Link>
        }
      />
      <OrderForm
        options={options}
        initial={{
          id: detail.id,
          values: {
            customer_id: detail.customer_id ?? "",
            sales_channel_id: detail.sales_channel_id,
            price_tier: detail.price_tier as "retail",
            ordered_at: detail.ordered_at,
            due_at: detail.due_at ?? "",
            discount_amount: detail.discount_amount.toFixed(2),
            notes: detail.notes ?? "",
            items: (detail.sales_order_items ?? []).map((i) => ({
              product_variant_id: i.product_variant_id,
              quantity: i.quantity,
              unit_price: i.unit_price.toFixed(2),
              discount_amount: i.discount_amount.toFixed(2),
            })),
          },
        }}
      />
    </div>
  );
}
