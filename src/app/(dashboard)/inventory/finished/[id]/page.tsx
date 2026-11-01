import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { formatManilaDate } from "@/lib/units/time";
import { getFinishedLot } from "@/server/services/packaging.service";
import { listMovements } from "@/server/services/inventory.service";
import { MovementsTable } from "@/features/inventory/components/movements-table";

export default async function FinishedLotPage({ params }: PageProps<"/inventory/finished/[id]">) {
  const { id } = await params;
  const { lot, lineage } = await getFinishedLot(id);
  const movements = lot.inventory_item_id
    ? await listMovements({ inventoryItemId: lot.inventory_item_id, page: 1, pageSize: 50 })
    : { rows: [] };
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${lot.product_name} ${lot.variant_name} · ${lot.lot_code}`}
        description={`SKU ${lot.sku} · packaged ${formatManilaDate(lot.packaged_at)}${lot.best_before_at ? ` · best before ${formatManilaDate(lot.best_before_at)}` : ""}`}
        breadcrumb={
          <Link
            href="/inventory/finished"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeftIcon className="size-3" /> Finished goods
          </Link>
        }
        actions={<StatusBadge status={lot.stock_status ?? "in_stock"} />}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Available"
          value={`${lot.available} / ${lot.packaged_quantity}`}
          hint={`${lot.reserved} reserved`}
          testId="lot-available"
        />
        <MetricCard
          label="Unit cost"
          value={<CurrencyDisplay value={lot.unit_cost} />}
          hint={`lot cost ₱${lot.total_cost.toFixed(2)}`}
          testId="lot-unit-cost"
        />
        <MetricCard label="Stock value" value={<CurrencyDisplay value={lot.stock_value} />} />
        <MetricCard
          label="Retail price"
          value={<CurrencyDisplay value={lot.selling_price} />}
          hint={
            lot.wholesale_price !== null
              ? `wholesale ₱${lot.wholesale_price.toFixed(2)}`
              : undefined
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traceability</CardTitle>
          <CardDescription>Packaging session → roast batches → green coffee lots.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="lineage">
          <p className="text-sm">
            Packaging session:{" "}
            {lot.packaging_session_id ? (
              <Link
                href={`/packaging/${lot.packaging_session_id}`}
                className="font-medium hover:underline"
                data-testid="lineage-session"
              >
                {lot.session_number}
              </Link>
            ) : (
              "—"
            )}
          </p>
          {lineage.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lineage recorded.</p>
          ) : (
            <ul className="space-y-3">
              {lineage.map((pi, idx) => (
                <li key={idx} className="rounded-md border p-3 text-sm" data-testid="lineage-batch">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      Roast batch{" "}
                      <Link
                        href={`/roasting/${pi.roast_batches?.id}`}
                        className="font-medium hover:underline"
                      >
                        {pi.roast_batches?.batch_number}
                      </Link>{" "}
                      · {formatManilaDate(pi.roast_batches?.roast_date)} · used{" "}
                      <WeightDisplay grams={pi.input_weight_g} />
                    </span>
                    <span>
                      inherited <CurrencyDisplay value={pi.inherited_cost} />
                    </span>
                  </div>
                  <ul className="text-muted-foreground mt-2 space-y-1 pl-4 text-xs">
                    {(pi.roast_batches?.roast_batch_inputs ?? []).map((ri, j) => (
                      <li key={j} data-testid="lineage-green-lot">
                        Green lot{" "}
                        <Link
                          href={`/inventory/lots/${ri.green_coffee_lots?.id}`}
                          className="hover:underline"
                        >
                          {ri.green_coffee_lots?.lot_code}
                        </Link>{" "}
                        · {ri.green_coffee_lots?.green_coffees?.name}
                        {ri.green_coffee_lots?.green_coffees?.country
                          ? ` (${[ri.green_coffee_lots.green_coffees.region, ri.green_coffee_lots.green_coffees.country].filter(Boolean).join(", ")})`
                          : ""}{" "}
                        · <WeightDisplay grams={ri.input_weight_g} /> ·{" "}
                        <CurrencyDisplay value={ri.allocated_green_cost} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
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
