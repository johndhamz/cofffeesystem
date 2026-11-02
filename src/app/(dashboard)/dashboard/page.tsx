import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoxesIcon,
  FlameIcon,
  HandCoinsIcon,
  PackageIcon,
  ReceiptIcon,
  ScaleIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard, type MetricDelta } from "@/components/shared/metric-card";
import { formatWeight } from "@/lib/units";
import { formatPHP, toCentavos } from "@/lib/money";
import { formatManilaDate, toManilaDateString } from "@/lib/units/time";
import { getSessionContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions/policy";
import { parseReportFilter } from "@/features/reports/schemas";
import { getDashboardCharts, getDashboardMetrics } from "@/server/services/reports.service";
import { DashboardRangeBar } from "@/features/dashboard/components/range-bar";
import {
  HorizontalBars,
  MarginTrendChart,
  MonthlySalesChart,
  WeeklyRoastChart,
  YieldTrendChart,
} from "@/features/dashboard/components/dashboard-charts";

export const metadata: Metadata = { title: "Dashboard" };

const n = (v: unknown) => (typeof v === "number" ? v : 0);

/** The same-length period immediately before [from, to]. */
function previousRange(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  const days = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  const pTo = new Date(a.getTime() - 86400000);
  const pFrom = new Date(pTo.getTime() - (days - 1) * 86400000);
  return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10), days };
}

function deltaOf(current: number, previous: number, label: string, upIsGood = true): MetricDelta {
  if (previous === 0) return { pct: current === 0 ? 0 : null, label, upIsGood };
  return { pct: ((current - previous) / Math.abs(previous)) * 100, label, upIsGood };
}

function ChartCard({
  title,
  description,
  href,
  children,
  testId,
}: {
  title: string;
  description?: string;
  href?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {href ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground -mr-2 h-7 px-2 text-xs"
          >
            <Link href={href}>
              Open <ArrowRightIcon className="size-3" />
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const today = toManilaDateString();
  const filter = parseReportFilter(await searchParams, today);
  const prev = previousRange(filter.from, filter.to);
  const [ctx, m, charts] = await Promise.all([
    getSessionContext(),
    getDashboardMetrics(filter),
    getDashboardCharts(filter),
  ]);
  const finance = m.finance === true;
  const pm = finance
    ? await getDashboardMetrics({ ...filter, from: prev.from, to: prev.to })
    : null;
  const vs = `vs prev. ${prev.days}d`;
  const alerts = n(m.low_stock_alerts) + n(m.low_material_alerts);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${ctx?.profile.fullName?.split(" ")[0] ?? "there"}`}
        description={
          ctx?.business
            ? `${ctx.business.businessName} · ${ROLE_LABELS[ctx.business.role]} · ${formatManilaDate(filter.from)} to ${formatManilaDate(filter.to)}`
            : undefined
        }
      />
      <DashboardRangeBar today={today} from={filter.from} to={filter.to} />

      {finance ? (
        <section className="space-y-3" data-testid="finance-metrics">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <span className="bg-chart-1 size-2 rounded-full" aria-hidden /> Financial (management
            view)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              label="Net sales"
              value={formatPHP(toCentavos(n(m.net_sales)))}
              hint={`${n(m.orders)} orders · ${n(m.units_sold)} units`}
              icon={<ReceiptIcon className="size-5" />}
              accent="blue"
              href={`/sales/history?from=${filter.from}&to=${filter.to}`}
              delta={deltaOf(n(m.net_sales), n(pm?.net_sales), vs)}
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
              icon={<TrendingUpIcon className="size-5" />}
              accent="aqua"
              href={`/reports/profitability?from=${filter.from}&to=${filter.to}`}
              delta={deltaOf(n(m.gross_profit), n(pm?.gross_profit), vs)}
              testId="metric-gross-profit"
            />
            <MetricCard
              label="Operating expenses"
              value={formatPHP(toCentavos(n(m.operating_expenses)))}
              icon={<WalletIcon className="size-5" />}
              accent="orange"
              href={`/expenses?from=${filter.from}&to=${filter.to}`}
              delta={deltaOf(n(m.operating_expenses), n(pm?.operating_expenses), vs, false)}
              testId="metric-opex"
            />
            <MetricCard
              label="Operating result"
              value={formatPHP(toCentavos(n(m.operating_result)))}
              tone={n(m.operating_result) < 0 ? "danger" : "success"}
              icon={<ScaleIcon className="size-5" />}
              accent={n(m.operating_result) < 0 ? "magenta" : "green"}
              href={`/reports/profitability?from=${filter.from}&to=${filter.to}`}
              delta={deltaOf(n(m.operating_result), n(pm?.operating_result), vs)}
              testId="metric-operating-result"
            />
            <MetricCard
              label="Receivables"
              value={formatPHP(toCentavos(n(m.receivables)))}
              hint={
                n(m.refunds) > 0
                  ? `refunds ${formatPHP(toCentavos(n(m.refunds)))}`
                  : "unpaid orders"
              }
              tone={n(m.receivables) > 0 ? "warning" : "default"}
              icon={<HandCoinsIcon className="size-5" />}
              accent="yellow"
              href="/sales?payment=unpaid"
              testId="metric-receivables"
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3" data-testid="inventory-summary">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
          <span className="bg-chart-6 size-2 rounded-full" aria-hidden /> Inventory &amp; production
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            label="Green coffee"
            value={formatWeight(n(m.green_stock_g), { maxFractionDigits: 1 })}
            hint={finance ? `${formatPHP(toCentavos(n(m.green_stock_value)))} on hand` : "on hand"}
            icon={<BoxesIcon className="size-5" />}
            accent="green"
            href="/inventory"
            testId="metric-green"
          />
          <MetricCard
            label="Roasted bulk"
            value={formatWeight(n(m.roasted_stock_g), { maxFractionDigits: 1 })}
            hint={
              finance ? `${formatPHP(toCentavos(n(m.roasted_stock_value)))} on hand` : "on hand"
            }
            icon={<FlameIcon className="size-5" />}
            accent="orange"
            href="/inventory/roasted"
            testId="metric-roasted"
          />
          <MetricCard
            label="Finished goods"
            value={`${n(m.finished_units)} units`}
            hint={
              finance ? `${formatPHP(toCentavos(n(m.finished_stock_value)))} on hand` : "on hand"
            }
            icon={<PackageIcon className="size-5" />}
            accent="violet"
            href="/inventory/finished"
            testId="metric-finished"
          />
          <MetricCard
            label="Roasted output"
            value={formatWeight(n(m.roasted_output_g), { maxFractionDigits: 1 })}
            hint={`${n(m.roast_batches)} batches · avg loss ${m.avg_roast_loss_pct ?? "—"}%`}
            icon={<FlameIcon className="size-5" />}
            accent="blue"
            href={`/roasting/history?from=${filter.from}&to=${filter.to}`}
            testId="metric-output"
          />
          <MetricCard
            label="Low-stock alerts"
            value={alerts}
            tone={alerts > 0 ? "warning" : "default"}
            icon={<TriangleAlertIcon className="size-5" />}
            accent={alerts > 0 ? "yellow" : "neutral"}
            hint={`${n(m.low_stock_alerts)} green lots · ${n(m.low_material_alerts)} materials`}
            href={alerts > 0 ? "/inventory?stock=low_stock" : "/inventory"}
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
            = remaining cost of all stock layers (lot-based actual cost). Click any card to open its
            detail.
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {finance ? (
          <>
            <ChartCard
              title="Monthly sales"
              description="Net sales vs gross profit, revenue on fulfilment. Click a legend entry to hide a series."
              href={`/reports/sales?from=${filter.from}&to=${filter.to}`}
            >
              <MonthlySalesChart data={charts.monthly} />
            </ChartCard>
            <ChartCard
              title="Gross margin trend"
              description="Gross profit as a share of net sales, by month."
              href={`/reports/profitability?from=${filter.from}&to=${filter.to}`}
            >
              <MarginTrendChart data={charts.monthly} />
            </ChartCard>
            <ChartCard
              title="Top products"
              description="Net sales by product. Click a bar to see its orders."
              href={`/reports/sales?from=${filter.from}&to=${filter.to}`}
            >
              <HorizontalBars
                data={charts.topProducts.map((r) => ({ label: r.label, value: r.net_sales }))}
                valueKind="money"
                testId="chart-top-products"
                color="var(--chart-1)"
                linkTo={{ base: "/sales?q=", productName: true }}
              />
            </ChartCard>
            <ChartCard
              title="Sales by origin"
              description="Net sales traced back to the green coffee's country."
              href={`/reports/sales?from=${filter.from}&to=${filter.to}`}
            >
              <HorizontalBars
                data={charts.byOrigin.map((r) => ({ label: r.label, value: r.net_sales }))}
                valueKind="money"
                testId="chart-origin"
                color="var(--chart-7)"
              />
            </ChartCard>
            <ChartCard
              title="Expenses by category"
              description="Operating treatments only count toward the operating result."
              href={`/expenses?from=${filter.from}&to=${filter.to}`}
            >
              <HorizontalBars
                data={charts.byCategory.map((r) => ({ label: r.category, value: r.amount }))}
                valueKind="money"
                testId="chart-expenses"
                color="var(--chart-2)"
                linkTo={{ base: "/expenses?q=" }}
              />
            </ChartCard>
          </>
        ) : null}
        <ChartCard
          title="Weekly roast output"
          description="Green coffee in vs roasted coffee out, per week."
          href="/roasting/history"
        >
          <WeeklyRoastChart data={charts.weekly} />
        </ChartCard>
        <ChartCard
          title="Production yield trend"
          description="Roasted weight as a share of green weight (100% − loss)."
          href="/reports/production"
        >
          <YieldTrendChart data={charts.weekly} />
        </ChartCard>
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
