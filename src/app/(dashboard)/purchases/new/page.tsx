import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getSessionContext, can } from "@/lib/auth/session";
import { getPurchaseFormOptions } from "@/server/services/procurement.service";
import { PurchaseOrderForm } from "@/features/procurement/components/purchase-order-form";

export const metadata: Metadata = { title: "New purchase" };

export default async function NewPurchasePage() {
  const ctx = await getSessionContext();
  if (!can(ctx, "purchases.manage"))
    return <AccessDenied message="Your role cannot create purchase orders." />;
  const options = await getPurchaseFormOptions();

  if (options.suppliers.length === 0 || options.greenCoffees.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="New purchase order" />
        <EmptyState
          title="Set up master data first"
          description="You need at least one active supplier and one active green coffee before creating a purchase."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/settings/suppliers">Suppliers</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/green-coffee">Green coffee</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New purchase order"
        description="Saved as a draft. Confirm it before receiving goods."
        breadcrumb={
          <Link href="/purchases" className="hover:underline">
            Purchases
          </Link>
        }
      />
      <PurchaseOrderForm
        suppliers={options.suppliers.map((s) => ({ id: s.id, name: s.name }))}
        greenCoffees={options.greenCoffees.map((g) => ({ id: g.id, name: g.name }))}
      />
    </div>
  );
}
