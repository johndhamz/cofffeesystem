import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate } from "@/lib/units/time";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import { ROAST_LEVEL_LABELS } from "@/lib/roasting/calculations";
import { listRoastedBulk } from "@/server/services/roasting.service";

export const metadata: Metadata = { title: "Roasted bulk inventory" };

export default async function RoastedInventoryPage() {
  const rows = await listRoastedBulk();
  const onHand = rows.reduce((a, r) => a + (r.roasted_on_hand_g ?? 0), 0);
  const value = rows.reduce((a, r) => a + (r.roasted_stock_value ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Roasted bulk inventory"
        description="Roasted coffee by batch, carrying its actual production cost."
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Inventory
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Batches with stock" value={rows.length} />
        <MetricCard
          label="Roasted on hand"
          value={formatWeight(onHand)}
          testId="metric-roasted-on-hand"
        />
        <MetricCard label="Stock value" value={formatPHP(toCentavos(value))} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No roasted coffee in stock"
          description="Complete a roast batch to create roasted bulk inventory."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table data-testid="roasted-table">
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Coffee</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Roasted</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Cost / kg</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid="roasted-row" data-batch={r.batch_number}>
                  <TableCell>
                    <Link href={`/roasting/${r.id}`} className="font-medium hover:underline">
                      {r.batch_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.coffee_names}
                    <span className="text-muted-foreground block text-xs">{r.lot_codes}</span>
                  </TableCell>
                  <TableCell>{r.roast_level ? ROAST_LEVEL_LABELS[r.roast_level] : "—"}</TableCell>
                  <TableCell>{formatManilaDate(r.completed_at)}</TableCell>
                  <TableCell
                    className="text-right"
                    data-testid="roasted-on-hand"
                    data-grams={r.roasted_on_hand_g}
                  >
                    <WeightDisplay grams={r.roasted_on_hand_g} />
                  </TableCell>
                  <TableCell className="text-right">
                    <WeightDisplay grams={r.roasted_available_g} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={r.roasted_cost_per_kg} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={r.roasted_stock_value} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
