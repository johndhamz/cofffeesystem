import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AccessDenied } from "@/components/shared/access-denied";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { toManilaDateString } from "@/lib/units/time";
import { AppError } from "@/lib/errors";
import { parseReportFilter, REPORT_KEYS, type ReportKey } from "@/features/reports/schemas";
import {
  getReportFilterOptions,
  runReport,
  type ReportResult,
} from "@/server/services/reports.service";
import { ReportFilters } from "@/features/reports/components/report-filters";

function Cell({ value, kind }: { value: unknown; kind?: string }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground">—</span>;
  if (kind === "money") return <CurrencyDisplay value={value as number} />;
  if (kind === "weight") return <WeightDisplay grams={Number(value)} />;
  if (kind === "pct") return <span className="tabular-nums">{String(value)}%</span>;
  return <>{String(value)}</>;
}

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[report]">) {
  const { report } = await params;
  if (!REPORT_KEYS.includes(report as ReportKey)) notFound();
  const filter = parseReportFilter(await searchParams, toManilaDateString());
  let data: ReportResult;
  try {
    data = await runReport(report as ReportKey, filter);
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN")
      return <AccessDenied message={error.message} />;
    throw error;
  }
  const options = await getReportFilterOptions();
  const qs = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(filter))
      if (v !== undefined && k !== "page" && k !== "pageSize") next.set(k, String(v));
    next.set("page", String(p));
    return `/reports/${report}?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={data.title}
        description={data.description}
        breadcrumb={
          <Link href="/reports" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Reports
          </Link>
        }
      />
      <ReportFilters report={report as ReportKey} options={options} range={data.range} />
      {report === "profitability" && data.totals ? (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          data-testid="profitability-summary"
        >
          <MetricCard
            label="Net sales"
            value={<CurrencyDisplay value={data.totals.net_sales as number} />}
            testId="p-net-sales"
          />
          <MetricCard
            label="COGS"
            value={<CurrencyDisplay value={data.totals.cogs as number} />}
            testId="p-cogs"
          />
          <MetricCard
            label="Gross profit"
            value={<CurrencyDisplay value={data.totals.gross_profit as number} />}
            hint={
              data.totals.gross_margin_pct !== null
                ? `${data.totals.gross_margin_pct}% margin`
                : undefined
            }
            testId="p-gross-profit"
          />
          <MetricCard
            label="Operating expenses"
            value={<CurrencyDisplay value={data.totals.operating_expenses as number} />}
            testId="p-opex"
          />
          <MetricCard
            label="Operating result"
            value={<CurrencyDisplay value={data.totals.operating_result as number} />}
            tone={(data.totals.operating_result as number) < 0 ? "danger" : "success"}
            testId="p-result"
          />
          <MetricCard
            label="Refunds / orders"
            value={`${(data.totals.refunds as number).toFixed(2)} / ${data.totals.orders}`}
          />
        </div>
      ) : null}
      {data.rows.length === 0 ? (
        <EmptyState title="No data for these filters" description={data.note} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table data-testid="report-table">
            <TableHeader>
              <TableRow>
                {data.columns.map((c) => (
                  <TableHead key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r, i) => (
                <TableRow key={i} data-testid="report-row">
                  {data.columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={c.align === "right" ? "text-right" : undefined}
                    >
                      <Cell value={r[c.key]} kind={c.kind} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {data.totals ? (
              <TableFooter>
                <TableRow data-testid="report-totals">
                  {data.columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={`font-medium ${c.align === "right" ? "text-right" : ""}`}
                    >
                      <Cell value={data.totals?.[c.key]} kind={c.kind} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      )}
      {data.pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button asChild variant="outline" size="icon" disabled={data.page <= 1}>
            <Link href={qs(data.page - 1)} aria-label="Previous">
              <ChevronLeftIcon />
            </Link>
          </Button>
          <span>
            {data.page} / {data.pageCount} · {data.total} rows
          </span>
          <Button asChild variant="outline" size="icon" disabled={data.page >= data.pageCount}>
            <Link href={qs(data.page + 1)} aria-label="Next">
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
      ) : null}
      {data.note ? <p className="text-muted-foreground text-xs">{data.note}</p> : null}
    </div>
  );
}
