import type { Metadata } from "next";
import Link from "next/link";
import { BoxesIcon, HistoryIcon, SlidersHorizontalIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import { getSessionContext, can } from "@/lib/auth/session";
import {
  getGreenInventoryDashboard,
  getReconciliationIssues,
  parseInventoryFilter,
} from "@/server/services/inventory.service";
import { GreenLotsTable } from "@/features/inventory/components/green-lots-table";
import { InventoryFilters } from "@/features/inventory/components/inventory-filters";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const filter = parseInventoryFilter(await searchParams);
  const [ctx, data, reconciliation] = await Promise.all([
    getSessionContext(),
    getGreenInventoryDashboard(filter),
    getReconciliationIssues(),
  ]);
  const canAdjust = can(ctx, "inventory.adjust");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Green coffee lots, balances and valuation. Balances reconcile to the movement ledger."
        actions={
          <>
            <Button asChild variant="outline" data-testid="roasted-link">
              <Link href="/inventory/roasted">
                <BoxesIcon /> Roasted bulk
              </Link>
            </Button>
            <Button asChild variant="outline" data-testid="movements-link">
              <Link href="/inventory/movements">
                <HistoryIcon /> Movements
              </Link>
            </Button>
            <Button asChild variant="outline" data-testid="adjustments-link">
              <Link href="/inventory/adjustments">
                <SlidersHorizontalIcon /> Adjustments
              </Link>
            </Button>
            {canAdjust ? (
              <Button asChild data-testid="new-adjustment-button">
                <Link href="/inventory/adjustments/new">New adjustment</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {reconciliation.length > 0 ? (
        <Alert variant="destructive" data-testid="reconciliation-alert">
          <TriangleAlertIcon />
          <AlertTitle>Balance mismatch detected</AlertTitle>
          <AlertDescription>
            {reconciliation.length} balance row(s) do not equal the sum of their movements. This
            should never happen — contact support.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="inventory-metrics">
        <MetricCard
          label="On hand"
          value={formatWeight(data.summary.onHandG)}
          hint={`${formatWeight(data.summary.reservedG)} reserved`}
          icon={<BoxesIcon className="size-5" />}
          testId="metric-on-hand"
        />
        <MetricCard
          label="Available"
          value={formatWeight(data.summary.availableG)}
          testId="metric-available"
        />
        <MetricCard
          label="Stock value"
          value={formatPHP(toCentavos(data.summary.stockValue))}
          hint="Lot-based actual cost incl. landed costs"
          testId="metric-value"
        />
        <MetricCard
          label="Low / out of stock"
          value={`${data.summary.lowStock} / ${data.summary.outOfStock}`}
          tone={data.summary.lowStock + data.summary.outOfStock > 0 ? "warning" : "default"}
          icon={<TriangleAlertIcon className="size-5" />}
          testId="metric-low"
        />
      </div>

      <InventoryFilters
        countries={data.options.countries}
        processes={data.options.processes}
        suppliers={data.options.suppliers}
      />
      <GreenLotsTable data={data.lots} />
    </div>
  );
}
