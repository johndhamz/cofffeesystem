import { formatWeight, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

interface WeightDisplayProps {
  grams: number | null | undefined;
  unit?: WeightUnit | "auto";
  className?: string;
  signed?: boolean;
}

export function WeightDisplay({ grams, unit = "auto", className, signed }: WeightDisplayProps) {
  if (grams === null || grams === undefined) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const text = formatWeight(Math.abs(grams), { unit });
  const prefix = signed ? (grams > 0 ? "+" : grams < 0 ? "−" : "") : grams < 0 ? "−" : "";
  return (
    <span className={cn("tabular-nums", className)} data-testid="weight" data-grams={grams}>
      {prefix}
      {text}
    </span>
  );
}
