import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput, ParamSelect } from "@/components/shared/data-table";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatManilaDate } from "@/lib/units/time";
import { formatPHP, toCentavos } from "@/lib/money";
import { COST_TREATMENTS } from "@/lib/finance/calculations";
import { getSessionContext, can } from "@/lib/auth/session";
import { getExpenseFormOptions, listExpenses } from "@/server/services/expenses.service";
import { ExpenseFormDialog } from "@/features/expenses/components/expense-form-dialog";

export const metadata: Metadata = { title: "Expenses" };
const TREATMENT: Record<string, string> = Object.fromEntries(
  COST_TREATMENTS.map((t) => [t.value, t.label]),
);

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const params = await searchParams;
  const get = (k: string) =>
    Array.isArray(params[k]) ? params[k]?.[0] : (params[k] as string | undefined);
  const [ctx, data, options] = await Promise.all([
    getSessionContext(),
    listExpenses({
      q: get("q"),
      treatment: get("treatment") ?? "all",
      category: get("category"),
      from: get("from"),
      to: get("to"),
      page: Math.max(1, Number(get("page") ?? 1) || 1),
      pageSize: 50,
      sort: get("sort") ?? "incurred_at",
      dir: get("dir") === "asc" ? "asc" : "desc",
    }),
    getExpenseFormOptions(),
  ]);
  const canManage = can(ctx, "expenses.manage");
  const createButton = canManage ? (
    <ExpenseFormDialog
      options={options}
      trigger={
        <Button data-testid="create-button">
          <PlusIcon /> Record expense
        </Button>
      }
    />
  ) : null;
  const total = data.rows.filter((r) => !r.is_voided).reduce((a, r) => a + r.amount, 0);
  const opex = data.rows.reduce((a, r) => a + (r.operating_amount ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        description="Period expenses and production costs. Each peso is recognised once: production treatments live inside inventory cost."
        actions={createButton}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total (page)" value={formatPHP(toCentavos(total))} />
        <MetricCard
          label="Operating expenses (page)"
          value={formatPHP(toCentavos(opex))}
          hint="selling + administrative + other operating"
        />
        <MetricCard
          label="Inside inventory cost (page)"
          value={formatPHP(toCentavos(total - opex))}
          hint="acquisition, roast & packaging production, capital"
        />
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput placeholder="Search description, number or supplier…" />
        <ParamSelect
          paramKey="treatment"
          label="Treatment"
          defaultValue="all"
          options={[
            { value: "all", label: "All treatments" },
            ...COST_TREATMENTS.map((t) => ({ value: t.value, label: t.label })),
          ]}
        />
        <ParamSelect
          paramKey="category"
          label="Category"
          options={[
            { value: "", label: "All categories" },
            ...options.categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <DateRangeFilter />
      </div>
      {data.rows.length === 0 ? (
        <EmptyState
          title="No expenses"
          description="Record LPG, labor, rent, marketplace fees and other costs."
          action={createButton}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table data-testid="expenses-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>No.</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Treatment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Operating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.id} data-testid="expense-row">
                  <TableCell>{formatManilaDate(r.incurred_at)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/expenses/${r.id}`}
                      className="font-medium hover:underline"
                      data-testid="row-name"
                    >
                      {r.expense_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.description}
                    {r.supplier_name ? (
                      <span className="text-muted-foreground block text-xs">{r.supplier_name}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.category_name}</TableCell>
                  <TableCell>{TREATMENT[r.cost_treatment] ?? r.cost_treatment}</TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={r.amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay
                      value={r.operating_amount}
                      muted={(r.operating_amount ?? 0) === 0}
                    />
                  </TableCell>
                  <TableCell>
                    {r.is_voided ? (
                      <StatusBadge status="cancelled" label="Voided" />
                    ) : (r.allocated_amount ?? 0) > 0 ? (
                      <StatusBadge status="posted" label="Allocated" tone="info" />
                    ) : (
                      <StatusBadge status="posted" label="Recorded" tone="success" />
                    )}
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
