import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
  testId?: string;
}

const TONE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "",
  warning: "border-amber-300/60 dark:border-amber-500/40",
  danger: "border-red-300/60 dark:border-red-500/40",
  success: "border-emerald-300/60 dark:border-emerald-500/40",
};

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
  testId,
}: MetricCardProps) {
  return (
    <Card className={cn("gap-2 py-4", TONE[tone], className)} data-testid={testId}>
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p
            className="truncate text-2xl font-semibold tabular-nums"
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </p>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        {icon ? <div className="text-muted-foreground shrink-0">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
