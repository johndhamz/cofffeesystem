import type { Metadata } from "next";
import Link from "next/link";
import {
  BoxesIcon,
  ConstructionIcon,
  PackageSearchIcon,
  ShoppingCartIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import { getSessionContext, can } from "@/lib/auth/session";
import {
  getGreenInventoryDashboard,
  parseInventoryFilter,
} from "@/server/services/inventory.service";
import { listPurchaseOrders } from "@/server/services/procurement.service";
import { ROLE_LABELS } from "@/lib/permissions/policy";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const canInventory = can(ctx, "inventory.read");
  const canPurchases = can(ctx, "purchases.read");

  const [inventory, openPurchases] = await Promise.all([
    canInventory
      ? getGreenInventoryDashboard({
          ...parseInventoryFilter({}),
          pageSize: 5,
          sort: "available_g",
          dir: "asc",
        })
      : null,
    canPurchases
      ? listPurchaseOrders({
          page: 1,
          pageSize: 5,
          status: "confirmed",
          dir: "desc",
          sort: "ordered_at",
        })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${ctx?.profile.fullName?.split(" ")[0] ?? "there"}`}
        description={
          ctx?.business
            ? `${ctx.business.businessName} · ${ROLE_LABELS[ctx.business.role]}`
            : undefined
        }
      />

      {inventory ? (
        <section className="space-y-3" data-testid="inventory-summary">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Green coffee inventory</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Available green"
              value={formatWeight(inventory.summary.availableG)}
              icon={<BoxesIcon className="size-5" />}
              testId="metric-available"
            />
            <MetricCard
              label="Stock value"
              value={formatPHP(toCentavos(inventory.summary.stockValue))}
              hint="Lot-based actual cost"
              testId="metric-value"
            />
            <MetricCard label="Active lots" value={inventory.summary.lots} testId="metric-lots" />
            <MetricCard
              label="Low / out of stock"
              value={`${inventory.summary.lowStock} / ${inventory.summary.outOfStock}`}
              tone={
                inventory.summary.lowStock + inventory.summary.outOfStock > 0
                  ? "warning"
                  : "default"
              }
              icon={<TriangleAlertIcon className="size-5" />}
              testId="metric-low"
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {inventory ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lowest stock lots</CardTitle>
              <CardDescription>Lots with the least available weight.</CardDescription>
            </CardHeader>
            <CardContent>
              {inventory.lots.rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">No green lots received yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {inventory.lots.rows.map((lot) => (
                    <li key={lot.lot_id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <Link
                          href={`/inventory/lots/${lot.lot_id}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {lot.coffee_name}
                        </Link>
                        <span className="text-muted-foreground block text-xs">{lot.lot_code}</span>
                      </span>
                      <span className="tabular-nums">{formatWeight(lot.available_g ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="mt-2 h-auto p-0">
                <Link href="/inventory">Open inventory →</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {openPurchases ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCartIcon className="size-4" /> Confirmed purchases awaiting receipt
              </CardTitle>
              <CardDescription>Stock increases only when a receipt is posted.</CardDescription>
            </CardHeader>
            <CardContent>
              {openPurchases.rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No purchases waiting to be received.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {openPurchases.rows.map((po) => (
                    <li key={po.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <Link
                          href={`/purchases/${po.id}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {po.purchase_number}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {po.suppliers?.name}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatPHP(toCentavos(po.total))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="mt-2 h-auto p-0">
                <Link href="/purchases">Open purchases →</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="border-dashed" data-testid="placeholder-notice">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ConstructionIcon className="size-4" /> Placeholder: production, sales and financial
            metrics
          </CardTitle>
          <CardDescription>
            Roast yield, sales revenue, margins and expenses will appear here once their modules
            ship (Phases 3–6). Nothing shown here is estimated or mocked — only live inventory and
            purchasing data are displayed above.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center gap-2 text-sm">
          <PackageSearchIcon className="size-4" /> See docs/DEVELOPMENT_ROADMAP.md for the schedule.
        </CardContent>
      </Card>
    </div>
  );
}
