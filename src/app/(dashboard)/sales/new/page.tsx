import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getSessionContext, can } from "@/lib/auth/session";
import { getOrderFormOptions } from "@/server/services/sales.service";
import { OrderForm } from "@/features/sales/components/order-form";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const ctx = await getSessionContext();
  if (!can(ctx, "sales.manage"))
    return <AccessDenied message="Your role cannot create sales orders." />;
  const options = await getOrderFormOptions();
  if (options.variants.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="New sales order" />
        <EmptyState
          title="No sellable products"
          description="Create a product variant first."
          action={
            <Button asChild variant="outline">
              <Link href="/products">Products</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="New sales order"
        description="Saved as a draft; confirm to reserve stock."
        breadcrumb={
          <Link href="/sales" className="hover:underline">
            Sales
          </Link>
        }
      />
      <OrderForm options={options} />
    </div>
  );
}
