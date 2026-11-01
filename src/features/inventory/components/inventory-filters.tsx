"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";

interface Props {
  countries: string[];
  processes: string[];
  suppliers: { id: string; name: string }[];
}

export function InventoryFilters({ countries, processes, suppliers }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hasFilters = ["q", "country", "supplier", "process", "lot", "stock"].some((k) =>
    params.get(k),
  );

  return (
    <div
      className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center"
      data-testid="inventory-filters"
    >
      <SearchInput placeholder="Search coffee, lot or supplier…" />
      <ParamSelect
        paramKey="country"
        label="Origin"
        options={[
          { value: "", label: "All origins" },
          ...countries.map((c) => ({ value: c, label: c })),
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
      <ParamSelect
        paramKey="process"
        label="Process"
        options={[
          { value: "", label: "All processes" },
          ...processes.map((p) => ({ value: p, label: p })),
        ]}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = (
            e.currentTarget.elements.namedItem("lot") as HTMLInputElement
          ).value.trim();
          const next = new URLSearchParams(params.toString());
          if (value) next.set("lot", value);
          else next.delete("lot");
          next.delete("page");
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        <Input
          name="lot"
          placeholder="Lot code"
          defaultValue={params.get("lot") ?? ""}
          className="w-32"
          data-testid="filter-lot"
        />
      </form>
      <ParamSelect
        paramKey="stock"
        label="Stock status"
        defaultValue="all"
        options={[
          { value: "all", label: "All stock" },
          { value: "in_stock", label: "In stock" },
          { value: "low_stock", label: "Low stock" },
          { value: "out_of_stock", label: "Out of stock" },
        ]}
      />
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
          data-testid="clear-filters"
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}
