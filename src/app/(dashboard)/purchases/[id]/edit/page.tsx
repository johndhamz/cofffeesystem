import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { getSessionContext, can } from "@/lib/auth/session";
import { getPurchaseFormOptions, getPurchaseOrder } from "@/server/services/procurement.service";
import { PurchaseOrderForm } from "@/features/procurement/components/purchase-order-form";

export default async function EditPurchasePage({ params }: PageProps<"/purchases/[id]/edit">) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!can(ctx, "purchases.manage"))
    return <AccessDenied message="Your role cannot edit purchase orders." />;
  const [po, options] = await Promise.all([getPurchaseOrder(id), getPurchaseFormOptions()]);
  if (po.status !== "draft") redirect(`/purchases/${id}`);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit ${po.purchase_number}`}
        breadcrumb={
          <Link href={`/purchases/${id}`} className="hover:underline">
            {po.purchase_number}
          </Link>
        }
      />
      <PurchaseOrderForm
        suppliers={options.suppliers.map((s) => ({ id: s.id, name: s.name }))}
        greenCoffees={options.greenCoffees.map((g) => ({ id: g.id, name: g.name }))}
        initial={{
          id: po.id,
          values: {
            supplier_id: po.supplier_id,
            ordered_at: po.ordered_at,
            notes: po.notes ?? "",
            additional_costs: po.additional_costs.toFixed(2),
            items: (po.purchase_order_items ?? []).map((i) => ({
              green_coffee_id: i.green_coffee_id,
              quantity_kg: i.ordered_quantity_g / 1000,
              unit_cost: String(i.unit_cost),
            })),
          },
        }}
      />
    </div>
  );
}
