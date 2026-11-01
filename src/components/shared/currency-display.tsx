import { formatPHP, toCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  /** Decimal value as returned by the database (number or string), or integer centavos with `centavos` */
  value: number | string | null | undefined;
  centavos?: boolean;
  className?: string;
  muted?: boolean;
}

export function CurrencyDisplay({
  value,
  centavos = false,
  className,
  muted,
}: CurrencyDisplayProps) {
  if (value === null || value === undefined || value === "") {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const cents = centavos ? Number(value) : toCentavos(value);
  return (
    <span
      className={cn("tabular-nums", muted && "text-muted-foreground", className)}
      data-testid="currency"
    >
      {formatPHP(cents)}
    </span>
  );
}
