import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/shared/empty-state";
import { formatPHP, toCentavos } from "@/lib/money";
import { getSessionContext, can } from "@/lib/auth/session";
import { listMaterialsInventory } from "@/server/services/packaging.service";

export const metadata: Metadata = { title: "Packaging materials inventory" };

export default async function MaterialsInventoryPage() {
  const [ctx, rows] = await Promise.all([getSessionContext(), listMaterialsInventory()]);
  const active = rows.filter((r) => r.is_active);
  const value = active.reduce((a, r) => a + (r.stock_value ?? 0), 0);
  const low = active.filter((r) => r.stock_status !== "in_stock").length;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Packaging materials"
        description="Bags, labels and boxes. Receive stock with a positive adjustment (enter the unit cost)."
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Inventory
          </Link>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/packaging/materials">
                <SettingsIcon /> Manage materials
              </Link>
            </Button>
            {can(ctx, "inventory.adjust") ? (
              <Button asChild data-testid="receive-materials">
                <Link href="/inventory/adjustments/new">
                  <PlusIcon /> Receive / adjust
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Materials" value={active.length} />
        <MetricCard label="Stock value" value={formatPHP(toCentavos(value))} />
        <MetricCard label="Low / out of stock" value={low} tone={low > 0 ? "warning" : "default"} />
      </div>
      {active.length === 0 ? (
        <EmptyState
          title="No packaging materials"
          description="Define materials under Packaging → Materials."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table data-testid="materials-table">
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reorder level</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((r) => (
                <TableRow key={r.material_id} data-testid="material-row" data-material={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                  <TableCell
                    className="text-right"
                    data-testid="material-on-hand"
                    data-units={r.on_hand}
                  >
                    {r.on_hand} {r.base_unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.available} {r.base_unit}
                  </TableCell>
                  <TableCell className="text-right">{r.reorder_level}</TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={r.stock_value} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.stock_status ?? "in_stock"} />
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
