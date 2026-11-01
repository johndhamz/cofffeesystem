import type { Metadata } from "next";
import Link from "next/link";
import { BoxIcon, PackageIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { getSessionContext, can } from "@/lib/auth/session";
import { listPackagingSessions } from "@/server/services/packaging.service";
import { SessionsTable } from "@/features/packaging/components/sessions-table";
import { PACKAGING_STATUS_LABELS } from "@/features/packaging/schemas";

export const metadata: Metadata = { title: "Packaging" };

export default async function PackagingPage({ searchParams }: PageProps<"/packaging">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const [ctx, data] = await Promise.all([
    getSessionContext(),
    listPackagingSessions({
      q: get("q"),
      status: get("status") ?? "all",
      page: Math.max(1, Number(get("page") ?? 1) || 1),
      pageSize: Math.min(100, Math.max(5, Number(get("pageSize") ?? 20) || 20)),
      sort: get("sort") ?? "packaged_at",
      dir: get("dir") === "asc" ? "asc" : "desc",
    }),
  ]);
  const canManage = can(ctx, "packaging.manage");
  const createButton = canManage ? (
    <Button asChild data-testid="create-button">
      <Link href="/packaging/new">
        <PlusIcon /> New session
      </Link>
    </Button>
  ) : null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Packaging"
        description="Pack roasted coffee into finished products; every lot stays traceable to its roast batches and green lots."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/packaging/materials">
                <BoxIcon /> Materials
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inventory/finished">
                <PackageIcon /> Finished goods
              </Link>
            </Button>
            {createButton}
          </>
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search session, product or batch…" />
        <ParamSelect
          paramKey="status"
          label="Status"
          defaultValue="all"
          options={[
            { value: "all", label: "All statuses" },
            ...Object.entries(PACKAGING_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
      <SessionsTable data={data} emptyAction={createButton} />
    </div>
  );
}
