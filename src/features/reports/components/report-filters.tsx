"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParamSelect } from "@/components/shared/data-table";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import type { ReportKey } from "../schemas";

export interface ReportFilterOptions {
  origins: string[];
  products: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  operators: { id: string; name: string }[];
}

const SHOW: Record<
  ReportKey,
  ("date" | "origin" | "product" | "customer" | "channel" | "operator")[]
> = {
  production: ["date", "origin", "operator"],
  "green-inventory": ["origin"],
  "finished-goods": ["product"],
  sales: ["date", "origin", "product", "customer", "channel"],
  expenses: ["date"],
  profitability: ["date"],
};

export function ReportFilters({
  report,
  options,
  range,
}: {
  report: ReportKey;
  options: ReportFilterOptions;
  range: { from: string; to: string };
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const show = SHOW[report];
  const exportQuery = new URLSearchParams(params.toString());
  exportQuery.set("from", range.from);
  exportQuery.set("to", range.to);
  exportQuery.delete("page");
  const q = exportQuery.toString();
  return (
    <div
      className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
      data-testid="report-filters"
    >
      {show.includes("date") ? <DateRangeFilter /> : null}
      {show.includes("origin") ? (
        <ParamSelect
          paramKey="origin"
          label="Origin"
          options={[
            { value: "", label: "All origins" },
            ...options.origins.map((o) => ({ value: o, label: o })),
          ]}
        />
      ) : null}
      {show.includes("product") ? (
        <ParamSelect
          paramKey="product"
          label="Product"
          options={[
            { value: "", label: "All products" },
            ...options.products.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      ) : null}
      {show.includes("customer") ? (
        <ParamSelect
          paramKey="customer"
          label="Customer"
          options={[
            { value: "", label: "All customers" },
            ...options.customers.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      ) : null}
      {show.includes("channel") ? (
        <ParamSelect
          paramKey="channel"
          label="Channel"
          options={[
            { value: "", label: "All channels" },
            ...options.channels.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      ) : null}
      {show.includes("operator") ? (
        <ParamSelect
          paramKey="operator"
          label="Roast operator"
          options={[
            { value: "", label: "All operators" },
            ...options.operators.map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
      ) : null}
      {params.toString() ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      ) : null}
      <span className="flex gap-2 lg:ml-auto">
        <Button asChild variant="outline" size="sm" data-testid="export-csv">
          <a href={`/api/reports/${report}/csv?${q}`}>
            <DownloadIcon /> CSV
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" data-testid="export-pdf">
          <a href={`/api/reports/${report}/pdf?${q}`}>
            <FileTextIcon /> PDF
          </a>
        </Button>
      </span>
    </div>
  );
}
