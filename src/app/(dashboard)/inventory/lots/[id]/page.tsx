import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatWeight } from "@/lib/units";
import { formatManilaDate } from "@/lib/units/time";
import { getSessionContext, can } from "@/lib/auth/session";
import { getGreenLotDetail } from "@/server/services/inventory.service";
import { MovementsTable } from "@/features/inventory/components/movements-table";
import { LotEditDialog } from "@/features/inventory/components/lot-edit-dialog";

export default async function LotDetailPage({ params }: PageProps<"/inventory/lots/[id]">) {
  const { id } = await params;
  const [ctx, detail] = await Promise.all([getSessionContext(), getGreenLotDetail(id)]);
  const { lot, record, balances, layers, movements } = detail;
  const canAdjust = can(ctx, "inventory.adjust");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${lot.coffee_name} · ${lot.lot_code}`}
        description={[lot.region, lot.country, lot.processing_method, lot.supplier_name]
          .filter(Boolean)
          .join(" · ")}
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Inventory
          </Link>
        }
        actions={
          <>
            <StatusBadge status={lot.stock_status ?? "in_stock"} />
            {canAdjust ? (
              <LotEditDialog
                lotId={lot.lot_id}
                initial={{
                  moisture_pct: lot.moisture_pct,
                  density_g_per_100ml: lot.density_g_per_100ml,
                  notes: record?.notes ?? null,
                  low_stock_threshold_g: lot.low_stock_threshold,
                }}
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Received"
          value={formatWeight(lot.received_quantity_g ?? 0)}
          hint={`First received ${formatManilaDate(lot.received_at)}`}
          testId="lot-received"
        />
        <MetricCard
          label="Available"
          value={formatWeight(lot.available_g ?? 0)}
          hint={`${formatWeight(lot.reserved_g ?? 0)} reserved`}
          testId="lot-available"
        />
        <MetricCard
          label="Cost per kg"
          value={<CurrencyDisplay value={lot.cost_per_kg} />}
          hint="Actual purchase + landed"
          testId="lot-cost-per-kg"
        />
        <MetricCard
          label="Stock value"
          value={<CurrencyDisplay value={lot.stock_value} />}
          testId="lot-value"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lot details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Moisture</dt>
                <dd data-testid="lot-moisture">
                  {lot.moisture_pct ?? "—"}
                  {lot.moisture_pct != null ? " %" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Density</dt>
                <dd>
                  {lot.density_g_per_100ml ?? "—"}
                  {lot.density_g_per_100ml != null ? " g/100ml" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Low-stock threshold</dt>
                <dd>
                  {lot.low_stock_threshold != null
                    ? formatWeight(lot.low_stock_threshold)
                    : lot.low_stock_threshold_g != null
                      ? `${formatWeight(lot.low_stock_threshold_g)} (coffee default)`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase">Supplier</dt>
                <dd>{lot.supplier_name ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs uppercase">Notes</dt>
                <dd className="whitespace-pre-wrap">{record?.notes ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balances by location</CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <p className="text-muted-foreground text-sm">No stock posted yet.</p>
            ) : (
              <Table data-testid="lot-balances">
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.inventory_locations?.name}</TableCell>
                      <TableCell className="text-right">
                        <WeightDisplay grams={b.on_hand_quantity} />
                      </TableCell>
                      <TableCell className="text-right">
                        <WeightDisplay grams={b.reserved_quantity} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost layers</CardTitle>
        </CardHeader>
        <CardContent>
          {layers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cost layers.</p>
          ) : (
            <Table data-testid="lot-cost-layers">
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Qty received</TableHead>
                  <TableHead className="text-right">Qty remaining</TableHead>
                  <TableHead className="text-right">Original cost</TableHead>
                  <TableHead className="text-right">Remaining cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layers.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatManilaDate(l.received_at)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.source_type.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <WeightDisplay grams={l.received_quantity} />
                    </TableCell>
                    <TableCell className="text-right">
                      <WeightDisplay grams={l.remaining_quantity} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={l.original_cost} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay value={l.remaining_cost} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movement history</CardTitle>
        </CardHeader>
        <CardContent>
          <MovementsTable rows={movements.rows} showItem={false} />
        </CardContent>
      </Card>
    </div>
  );
}
