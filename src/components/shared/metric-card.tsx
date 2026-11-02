import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricAccent =
  "blue" | "orange" | "aqua" | "yellow" | "magenta" | "green" | "violet" | "neutral";

export interface MetricDelta {
  /** change in percent vs the comparison period; null when there is nothing to compare */
  pct: number | null;
  /** what the comparison is, e.g. "vs previous 30 days" */
  label: string;
  /** whether an increase is good (sales) or bad (expenses) */
  upIsGood?: boolean;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  accent?: MetricAccent;
  delta?: MetricDelta;
  /** makes the whole card a link (hover lift + arrow) */
  href?: string;
  className?: string;
  testId?: string;
}

const TONE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "",
  warning: "border-status-warning/60",
  danger: "border-status-critical/60",
  success: "border-status-good/60",
};

const ACCENT: Record<MetricAccent, { bar: string; icon: string }> = {
  blue: { bar: "bg-chart-1", icon: "bg-chart-1/20 text-chart-1" },
  orange: { bar: "bg-chart-2", icon: "bg-chart-2/20 text-chart-2" },
  aqua: { bar: "bg-chart-3", icon: "bg-chart-3/20 text-chart-3" },
  yellow: { bar: "bg-chart-4", icon: "bg-chart-4/20 text-chart-4" },
  magenta: { bar: "bg-chart-5", icon: "bg-chart-5/20 text-chart-5" },
  green: { bar: "bg-chart-6", icon: "bg-chart-6/20 text-chart-6" },
  violet: { bar: "bg-chart-7", icon: "bg-chart-7/20 text-chart-7" },
  neutral: { bar: "bg-muted-foreground/40", icon: "bg-muted text-muted-foreground" },
};

function Delta({ delta }: { delta: MetricDelta }) {
  if (delta.pct === null) return null;
  const up = delta.pct > 0;
  const flat = Math.abs(delta.pct) < 0.05;
  const good = flat ? null : (delta.upIsGood ?? true) === up;
  const Icon = flat ? MinusIcon : up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums",
        good === null
          ? "text-muted-foreground"
          : good
            ? "text-status-good"
            : "text-status-critical",
      )}
      data-testid="metric-delta"
    >
      <Icon className="size-3.5" />
      {flat ? "0%" : `${up ? "+" : ""}${delta.pct.toFixed(1)}%`}
      <span className="text-muted-foreground font-normal">{delta.label}</span>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  accent = "neutral",
  delta,
  href,
  className,
  testId,
}: MetricCardProps) {
  const a = ACCENT[accent];
  const long = typeof value === "string" && value.length > 11;
  const body = (
    <Card
      className={cn(
        "relative gap-2 overflow-hidden py-4 transition-shadow",
        href && "hover:ring-ring/40 hover:shadow-md hover:ring-2",
        TONE[tone],
        className,
      )}
      data-testid={testId}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", a.bar)} />
      <CardContent className="flex items-start justify-between gap-3 px-4 pl-5">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              long ? "text-xl break-words" : "text-2xl",
            )}
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </p>
          {delta ? <Delta delta={delta} /> : null}
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {icon ? (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-md [&_svg]:size-4",
                a.icon,
              )}
            >
              {icon}
            </span>
          ) : null}
          {href ? (
            <ArrowRightIcon className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return body;
  return (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:outline-none"
      aria-label={`${label}: open`}
    >
      {body}
    </Link>
  );
}
