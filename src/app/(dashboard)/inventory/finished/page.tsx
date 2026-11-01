import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { formatPHP, toCentavos } from "@/lib/money";
import { listFinishedGoods } from "@/server/services/packaging.service";
import { FinishedGoodsTable } from "@/features/packaging/components/finished-goods-table";

export const metadata: Metadata = { title: "Finished goods" };

export default async function FinishedGoodsPage({
  searchParams,
}: PageProps<"/inventory/finished">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const data = await listFinishedGoods({
    q: get("q"),
    stock: get("stock") ?? "in_stock",
    page: Math.max(1, Number(get("page") ?? 1) || 1),
    pageSize: Math.min(100, Math.max(5, Number(get("pageSize") ?? 25) || 25)),
    sort: get("sort"),
    dir: get("dir") === "asc" ? "asc" : "desc",
  });
  const units = data.rows.reduce((a, r) => a + (r.available ?? 0), 0);
  const value = data.rows.reduce((a, r) => a + (r.stock_value ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Finished goods inventory"
        description="Packaged products by lot, each carrying its actual unit cost and lineage."
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Inventory
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Lots shown" value={data.total} />
        <MetricCard label="Units available (page)" value={units} testId="metric-units" />
        <MetricCard label="Stock value (page)" value={formatPHP(toCentavos(value))} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search product, SKU or lot…" />
        <ParamSelect
          paramKey="stock"
          label="Stock"
          defaultValue="in_stock"
          options={[
            { value: "in_stock", label: "In stock" },
            { value: "out_of_stock", label: "Sold out" },
            { value: "all", label: "All lots" },
          ]}
        />
      </div>
      <FinishedGoodsTable data={data} />
    </div>
  );
}
