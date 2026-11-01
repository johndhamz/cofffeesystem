import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDateTime } from "@/lib/units/time";
import { MOVEMENT_TYPE_LABELS } from "../schemas";
import type { InventoryMovementHistoryRow } from "@/types";

export function MovementsTable({
  rows,
  showItem = true,
}: {
  rows: InventoryMovementHistoryRow[];
  showItem?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No stock movements yet"
        description="Every receipt, adjustment and consumption is recorded here."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table data-testid="movements-table">
        <TableHeader>
          <TableRow>
            <TableHead>Posted</TableHead>
            <TableHead>Type</TableHead>
            {showItem ? <TableHead>Item</TableHead> : null}
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id} data-testid="movement-row" data-movement-type={m.movement_type}>
              <TableCell className="whitespace-nowrap">
                {formatManilaDateTime(m.posted_at)}
              </TableCell>
              <TableCell>{MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}</TableCell>
              {showItem ? (
                <TableCell>
                  {m.lot_id ? (
                    <Link href={`/inventory/lots/${m.lot_id}`} className="hover:underline">
                      {m.coffee_name} · {m.lot_code}
                    </Link>
                  ) : (
                    m.item_type
                  )}
                </TableCell>
              ) : null}
              <TableCell>{m.location_name}</TableCell>
              <TableCell
                className={`text-right ${m.quantity_delta < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}
              >
                {m.base_unit === "g" ? (
                  <WeightDisplay grams={m.quantity_delta} signed />
                ) : (
                  `${m.quantity_delta > 0 ? "+" : ""}${m.quantity_delta} ${m.base_unit}`
                )}
              </TableCell>
              <TableCell className="text-right">
                <CurrencyDisplay value={m.total_cost} muted={m.total_cost === 0} />
              </TableCell>
              <TableCell className="text-muted-foreground">{m.created_by_name ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
