import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { getSessionContext, can } from "@/lib/auth/session";
import { listPurchaseOrders } from "@/server/services/procurement.service";
import { listActiveMasterRecords } from "@/server/services/master-data.service";
import { PurchaseOrdersTable } from "@/features/procurement/components/purchase-orders-table";
import { PO_STATUS_LABELS } from "@/features/procurement/schemas";
import type { PurchaseOrderStatus } from "@/types";

export const metadata: Metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: PageProps<"/purchases">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const status = (get("status") ?? "all") as PurchaseOrderStatus | "all";
  const [ctx, suppliers, data] = await Promise.all([
    getSessionContext(),
    listActiveMasterRecords("suppliers"),
    listPurchaseOrders({
      q: get("q"),
      status,
      supplier: get("supplier"),
      page: Math.max(1, Number(get("page") ?? 1) || 1),
      pageSize: Math.min(100, Math.max(5, Number(get("pageSize") ?? 20) || 20)),
      sort: get("sort") ?? "ordered_at",
      dir: get("dir") === "asc" ? "asc" : "desc",
    }),
  ]);
  const canManage = can(ctx, "purchases.manage");

  const createButton = canManage ? (
    <Button asChild data-testid="create-button">
      <Link href="/purchases/new">
        <PlusIcon /> New purchase
      </Link>
    </Button>
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchases"
        description="Green coffee purchase orders and goods receipts."
        actions={createButton}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search PO number…" />
        <ParamSelect
          paramKey="status"
          label="Status"
          defaultValue="all"
          options={[
            { value: "all", label: "All statuses" },
            ...Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <ParamSelect
          paramKey="supplier"
          label="Supplier"
          options={[
            { value: "", label: "All suppliers" },
            ...suppliers.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>
      <PurchaseOrdersTable data={data} emptyAction={createButton} />
    </div>
  );
}
