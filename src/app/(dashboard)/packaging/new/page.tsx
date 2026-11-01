import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getSessionContext, can } from "@/lib/auth/session";
import { getPackagingFormOptions } from "@/server/services/packaging.service";
import { PackagingSessionForm } from "@/features/packaging/components/packaging-session-form";

export const metadata: Metadata = { title: "New packaging session" };

export default async function NewPackagingPage() {
  const ctx = await getSessionContext();
  if (!can(ctx, "packaging.manage"))
    return <AccessDenied message="Your role cannot create packaging sessions." />;
  const options = await getPackagingFormOptions();
  if (options.batches.length === 0 || options.variants.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="New packaging session" />
        <EmptyState
          title={
            options.batches.length === 0 ? "No roasted coffee in stock" : "No product variants"
          }
          description={
            options.batches.length === 0
              ? "Complete a roast batch first."
              : "Create a product with at least one variant first."
          }
          action={
            <Button asChild variant="outline">
              <Link href={options.batches.length === 0 ? "/roasting" : "/products"}>
                {options.batches.length === 0 ? "Roast Production" : "Products"}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="New packaging session"
        description="Saved as a draft; completing it moves stock."
        breadcrumb={
          <Link href="/packaging" className="hover:underline">
            Packaging
          </Link>
        }
      />
      <PackagingSessionForm options={options} />
    </div>
  );
}
