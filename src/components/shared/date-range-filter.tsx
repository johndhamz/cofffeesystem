"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DateRangeFilterProps {
  fromKey?: string;
  toKey?: string;
}

/** Updates ?from=YYYY-MM-DD&to=YYYY-MM-DD in the URL (server components re-query). */
export function DateRangeFilter({ fromKey = "from", toKey = "to" }: DateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="date-range-filter">
      <div className="space-y-1">
        <Label htmlFor={fromKey} className="text-xs">
          From
        </Label>
        <Input
          id={fromKey}
          type="date"
          defaultValue={params.get(fromKey) ?? ""}
          onChange={(e) => update(fromKey, e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={toKey} className="text-xs">
          To
        </Label>
        <Input
          id={toKey}
          type="date"
          defaultValue={params.get(toKey) ?? ""}
          onChange={(e) => update(toKey, e.target.value)}
          className="w-40"
        />
      </div>
      {(params.get(fromKey) || params.get(toKey)) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.delete(fromKey);
            next.delete(toKey);
            router.push(`${pathname}?${next.toString()}`);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
