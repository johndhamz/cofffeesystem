"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Preset date ranges, computed from today's Manila date; the URL (?from&to) stays the source of truth. */
const PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "mtd", label: "This month", days: 0 },
  { key: "ytd", label: "This year", days: 0 },
] as const;

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function presetRange(
  key: (typeof PRESETS)[number]["key"],
  today: string,
): { from: string; to: string } {
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "mtd":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "ytd":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default: {
      const days = PRESETS.find((p) => p.key === key)?.days ?? 30;
      return { from: shift(today, -(days - 1)), to: today };
    }
  }
}

export function DashboardRangeBar({
  today,
  from,
  to,
}: {
  today: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(next: { from?: string; to?: string }) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2" data-testid="date-range-filter">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Date range presets">
        {PRESETS.map((p) => {
          const r = presetRange(p.key, today);
          const active = r.from === from && r.to === to;
          return (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn("h-8", active && "shadow-sm")}
              aria-pressed={active}
              onClick={() => apply(r)}
              data-testid={`range-${p.key}`}
            >
              {p.label}
            </Button>
          );
        })}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs">
            From
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && apply({ from: e.target.value })}
            className="h-8 w-36"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs">
            To
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && apply({ to: e.target.value })}
            className="h-8 w-36"
          />
        </div>
        <CalendarIcon className="text-muted-foreground mb-2 size-4" aria-hidden />
      </div>
    </div>
  );
}
