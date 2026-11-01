import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { getSessionContext, can } from "@/lib/auth/session";
import { getAdjustmentFormOptions } from "@/server/services/inventory.service";
import { AdjustmentForm } from "@/features/inventory/components/adjustment-form";

export const metadata: Metadata = { title: "New adjustment" };

export default async function NewAdjustmentPage({
  searchParams,
}: PageProps<"/inventory/adjustments/new">) {
  const ctx = await getSessionContext();
  if (!can(ctx, "inventory.adjust"))
    return <AccessDenied message="Your role cannot adjust inventory." />;
  const params = await searchParams;
  const item = typeof params.item === "string" ? params.item : undefined;
  const options = await getAdjustmentFormOptions();

  return (
    <div className="space-y-5">
      <PageHeader
        title="New inventory adjustment"
        breadcrumb={
          <Link href="/inventory/adjustments" className="hover:underline">
            Adjustments
          </Link>
        }
      />
      {options.items.length === 0 ? (
        <EmptyState
          title="No stock to adjust"
          description="Receive a purchase or create packaging materials first."
        />
      ) : (
        <AdjustmentForm
          items={options.items}
          locations={options.locations.map((l) => ({ id: l.id, name: l.name }))}
          defaultItemId={item}
        />
      )}
    </div>
  );
}
