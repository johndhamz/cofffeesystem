import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ParamSelect } from "@/components/shared/data-table";
import { listMovements } from "@/server/services/inventory.service";
import { MovementsTable } from "@/features/inventory/components/movements-table";
import { MOVEMENT_TYPE_LABELS } from "@/features/inventory/schemas";

export const metadata: Metadata = { title: "Stock movements" };

export default async function MovementsPage({ searchParams }: PageProps<"/inventory/movements">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  const type = get("type");
  const data = await listMovements({
    page,
    pageSize: 50,
    type: type && type in MOVEMENT_TYPE_LABELS ? type : undefined,
  });

  const qs = (p: number) => {
    const next = new URLSearchParams();
    if (type) next.set("type", type);
    next.set("page", String(p));
    return `/inventory/movements?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock movements"
        description="Append-only ledger of every stock change. Rows are never edited or deleted."
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Inventory
          </Link>
        }
      />
      <ParamSelect
        paramKey="type"
        label="Movement type"
        options={[
          { value: "", label: "All types" },
          ...Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        ]}
      />
      <MovementsTable rows={data.rows} />
      {data.pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button asChild variant="outline" size="icon" disabled={page <= 1}>
            <Link href={qs(page - 1)} aria-label="Previous">
              <ChevronLeftIcon />
            </Link>
          </Button>
          <span>
            {page} / {data.pageCount}
          </span>
          <Button asChild variant="outline" size="icon" disabled={page >= data.pageCount}>
            <Link href={qs(page + 1)} aria-label="Next">
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
