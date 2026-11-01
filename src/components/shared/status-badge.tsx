import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
};

const STATUS_TONES: Record<string, Tone> = {
  active: "success",
  inactive: "neutral",
  draft: "neutral",
  confirmed: "info",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
  posted: "success",
  reversed: "warning",
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
  confirmed: "Confirmed",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
  posted: "Posted",
  reversed: "Reversed",
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONES[status] ?? "neutral";
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent font-medium", TONE_CLASS[resolvedTone], className)}
      data-status={status}
      data-testid="status-badge"
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <StatusBadge status={isActive ? "active" : "inactive"} />;
}
