import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3Icon,
  BeanIcon,
  FlameIcon,
  LockIcon,
  PackageIcon,
  ReceiptIcon,
  WalletIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatPHP, toCentavos } from "@/lib/money";
import { requirePermission } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canSeeFinance } from "@/server/services/reports.service";
import { REPORT_KEYS, REPORT_META } from "@/features/reports/schemas";
import { fromDatabaseError } from "@/lib/errors";

export const metadata: Metadata = { title: "Reports" };
const ICONS = {
  production: FlameIcon,
  "green-inventory": BeanIcon,
  "finished-goods": PackageIcon,
  sales: ReceiptIcon,
  expenses: WalletIcon,
  profitability: BarChart3Icon,
};

export default async function ReportsPage() {
  const ctx = await requirePermission("reports.read");
  const finance = await canSeeFinance();
  const db = await createSupabaseServerClient();
  const { data: valuation, error } = await db.rpc("report_inventory_valuation", {
    p_business_id: ctx.business.businessId,
  });
  if (error) throw fromDatabaseError(error);
  const label: Record<string, string> = {
    green_coffee_lot: "Green coffee",
    roasted_bulk: "Roasted bulk",
    finished_product: "Finished goods",
    packaging_material: "Packaging materials",
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Management reports built from recorded cost snapshots and the inventory ledger. Not statutory financial statements."
      />
      {finance ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="valuation">
          {(valuation ?? []).map((v) => (
            <MetricCard
              key={v.item_type}
              label={label[v.item_type] ?? v.item_type}
              value={formatPHP(toCentavos(v.value))}
              hint={`${v.items} items`}
            />
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_KEYS.map((key) => {
          const meta = REPORT_META[key];
          const Icon = ICONS[key];
          const locked = meta.finance && !finance;
          const card = (
            <Card
              className={`h-full gap-1 py-4 transition-colors ${locked ? "opacity-60" : "hover:border-foreground/30"}`}
            >
              <CardContent className="flex items-start gap-3 px-4">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                  {locked ? <LockIcon className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{meta.title}</span>
                  <span className="text-muted-foreground block text-xs">
                    {locked ? "Owners only" : meta.description}
                  </span>
                </span>
              </CardContent>
            </Card>
          );
          return locked ? (
            <div key={key} data-testid={`report-card-${key}`} data-locked="true">
              {card}
            </div>
          ) : (
            <Link key={key} href={`/reports/${key}`} data-testid={`report-card-${key}`}>
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
