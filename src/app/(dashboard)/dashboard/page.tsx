import type { Metadata } from "next";
import Link from "next/link";
import {
  BoxesIcon,
  FlameIcon,
  PackageIcon,
  ReceiptIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import { toManilaDateString } from "@/lib/units/time";
import { getSessionContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions/policy";
import { parseReportFilter } from "@/features/reports/schemas";
import { getDashboardCharts, getDashboardMetrics } from "@/server/services/reports.service";
import {
  HorizontalBars,
  MarginTrendChart,
  MonthlySalesChart,
  WeeklyRoastChart,
  YieldTrendChart,
} from "@/features/dashboard/components/dashboard-charts";

export const metadata: Metadata = { title: "Dashboard" };

const n = (v: unknown) => (typeof v === "number" ? v : 0);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const filter = parseReportFilter(await searchParams, toManilaDateString());
  const [ctx, m, charts] = await Promise.all([
    getSessionContext(),
    getDashboardMetrics(filter),
    getDashboardCharts(filter),
  ]);
  const finance = m.finance === true;
  const alerts = n(m.low_stock_alerts) + n(m.low_material_alerts);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${ctx?.profile.fullName?.split(" ")[0] ?? "there"}`}
        description={
          ctx?.business
            ? `${ctx.business.businessName} · ${ROLE_LABELS[ctx.business.role]} · ${filter.from} to ${filter.to}`
            : undefined
        }
        actions={<DateRangeFilter />}
      />

      {finance ? (
        <section className="space-y-3" data-testid="finance-metrics">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Financial (management view)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Net sales"
              value={formatPHP(toCentavos(n(m.net_sales)))}
              hint={`${n(m.orders)} orders · ${n(m.units_sold)} units`}
              icon={<ReceiptIcon className="size-5" />}
              testId="metric-net-sales"
            />
            <MetricCard
              label="Gross profit"
              value={formatPHP(toCentavos(n(m.gross_profit)))}
              hint={
                m.gross_margin_pct !== null && m.gross_margin_pct !== undefined
                  ? `${m.gross_margin_pct}% margin`
                  : "no sales yet"
              }
              testId="metric-gross-profit"
            />
            <MetricCard
              label="Operating expenses"
              value={formatPHP(toCentavos(n(m.operating_expenses)))}
              icon={<WalletIcon className="size-5" />}
              testId="metric-opex"
            />
            <MetricCard
              label="Operating result"
              value={formatPHP(toCentavos(n(m.operating_result)))}
              tone={n(m.operating_result) < 0 ? "danger" : "success"}
              testId="metric-operating-result"
            />
            <MetricCard
              label="Receivables"
              value={formatPHP(toCentavos(n(m.receivables)))}
              hint={n(m.refunds) > 0 ? `refunds ${formatPHP(toCentavos(n(m.refunds)))}` : undefined}
              tone={n(m.receivables) > 0 ? "warning" : "default"}
              testId="metric-receivables"
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3" data-testid="inventory-summary">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Inventory &amp; production
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Green coffee"
            value={formatWeight(n(m.green_stock_g))}
            hint={finance ? formatPHP(toCentavos(n(m.green_stock_value))) : undefined}
            icon={<BoxesIcon className="size-5" />}
            testId="metric-green"
          />
          <MetricCard
            label="Roasted bulk"
            value={formatWeight(n(m.roasted_stock_g))}
            hint={finance ? formatPHP(toCentavos(n(m.roasted_stock_value))) : undefined}
            icon={<FlameIcon className="size-5" />}
            testId="metric-roasted"
          />
          <MetricCard
            label="Finished goods"
            value={`${n(m.finished_units)} units`}
            hint={finance ? formatPHP(toCentavos(n(m.finished_stock_value))) : undefined}
            icon={<PackageIcon className="size-5" />}
            testId="metric-finished"
          />
          <MetricCard
            label="Roasted output"
            value={formatWeight(n(m.roasted_output_g))}
            hint={`${n(m.roast_batches)} batches · avg loss ${m.avg_roast_loss_pct ?? "—"}%`}
            testId="metric-output"
          />
          <MetricCard
            label="Low-stock alerts"
            value={alerts}
            tone={alerts > 0 ? "warning" : "default"}
            icon={<TriangleAlertIcon className="size-5" />}
            hint={`${n(m.low_stock_alerts)} green lots · ${n(m.low_material_alerts)} materials`}
            testId="metric-alerts"
          />
        </div>
        {finance ? (
          <p className="text-muted-foreground text-xs">
            Inventory valuation{" "}
            {formatPHP(
              toCentavos(
                n(m.green_stock_value) + n(m.roasted_stock_value) + n(m.finished_stock_value),
              ),
            )}{" "}
            = remaining cost of all stock layers (lot-based actual cost).
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {finance ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly sales</CardTitle>
                <CardDescription>Net sales vs gross profit, revenue on fulfilment.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlySalesChart data={charts.monthly} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gross margin trend</CardTitle>
              </CardHeader>
              <CardContent>
                <MarginTrendChart data={charts.monthly} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top products</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBars
                  data={charts.topProducts.map((r) => ({ label: r.label, value: r.net_sales }))}
                  valueKind="money"
                  testId="chart-top-products"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales by origin</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBars
                  data={charts.byOrigin.map((r) => ({ label: r.label, value: r.net_sales }))}
                  valueKind="money"
                  testId="chart-origin"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expenses by category</CardTitle>
                <CardDescription>
                  Operating treatments only count toward the operating result.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HorizontalBars
                  data={charts.byCategory.map((r) => ({ label: r.category, value: r.amount }))}
                  valueKind="money"
                  testId="chart-expenses"
                />
              </CardContent>
            </Card>
          </>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly roast output</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyRoastChart data={charts.weekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production yield trend</CardTitle>
          </CardHeader>
          <CardContent>
            <YieldTrendChart data={charts.weekly} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/reports">Reports &amp; exports</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/inventory">Inventory</Link>
        </Button>
        {finance ? (
          <Button asChild variant="outline">
            <Link href="/expenses">Expenses</Link>
          </Button>
        ) : null}
      </div>
      {!finance ? (
        <p className="text-muted-foreground text-xs" data-testid="finance-hidden">
          Financial metrics are visible to owners only.
        </p>
      ) : null}
    </div>
  );
}
