import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getSessionContext, can } from "@/lib/auth/session";
import { getRoastFormOptions } from "@/server/services/roasting.service";
import { RoastBatchForm } from "@/features/roasting/components/roast-batch-form";

export const metadata: Metadata = { title: "New roast" };

export default async function NewRoastPage() {
  const ctx = await getSessionContext();
  if (!can(ctx, "roasting.manage"))
    return <AccessDenied message="Your role cannot create roast batches." />;
  const options = await getRoastFormOptions();
  if (options.lots.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="New roast batch" />
        <EmptyState
          title="No green coffee in stock"
          description="Receive a purchase first so there are green lots to roast."
          action={
            <Button asChild variant="outline">
              <Link href="/purchases">Purchases</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="New roast batch"
        description="Saved as a draft. Start it, record the roast, then complete it to move stock."
        breadcrumb={
          <Link href="/roasting" className="hover:underline">
            Roast Production
          </Link>
        }
      />
      <RoastBatchForm options={options} />
    </div>
  );
}
