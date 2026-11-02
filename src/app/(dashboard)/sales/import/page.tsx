import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getOrderFormOptions } from "@/server/services/sales.service";
import { ImportWizard } from "@/features/sales/components/import-wizard";

export const metadata: Metadata = { title: "Import sales history" };

export default async function SalesImportPage() {
  await requirePermission("sales.manage");
  await requirePermission("inventory.adjust");
  const options = await getOrderFormOptions();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Import sales history"
        description="Bring past sales into the system as backdated, fulfilled orders so revenue, cost of goods and reports include them."
        breadcrumb={
          <Link href="/sales" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Sales
          </Link>
        }
      />
      <ImportWizard locations={options.locations} defaultLocationId={options.defaultLocationId} />
    </div>
  );
}
