import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatManilaDate, formatManilaDateTime } from "@/lib/units/time";
import { COST_TREATMENTS } from "@/lib/finance/calculations";
import { PAYMENT_METHODS } from "@/lib/sales/calculations";
import { getSessionContext, can } from "@/lib/auth/session";
import { getExpense, getExpenseFormOptions } from "@/server/services/expenses.service";
import {
  ExpenseDetailActions,
  RemoveAllocationButton,
} from "@/features/expenses/components/expense-detail-actions";

const TREATMENT = Object.fromEntries(COST_TREATMENTS.map((t) => [t.value, t]));
const METHOD: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);
const TARGET_PATH: Record<string, string> = {
  roast_batch: "/roasting",
  packaging_session: "/packaging",
  goods_receipt: "/purchases/receipts",
};

export default async function ExpenseDetailPage({ params }: PageProps<"/expenses/[id]">) {
  const { id } = await params;
  const [ctx, { row, allocations, receiptUrl }, options] = await Promise.all([
    getSessionContext(),
    getExpense(id),
    getExpenseFormOptions(),
  ]);
  const treatment = TREATMENT[row.cost_treatment];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${row.expense_number} · ${row.description}`}
        description={`${row.category_name} · ${formatManilaDate(row.incurred_at)}${row.supplier_name ? ` · ${row.supplier_name}` : ""}`}
        breadcrumb={
          <Link href="/expenses" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Expenses
          </Link>
        }
        actions={
          <>
            {row.is_voided ? <StatusBadge status="cancelled" label="Voided" /> : null}
            <ExpenseDetailActions
              expense={{
                id: row.id,
                expense_category_id: row.category_id,
                supplier_id: row.supplier_id ?? "",
                amount: row.amount.toFixed(2),
                incurred_at: row.incurred_at,
                description: row.description,
                cost_treatment: row.cost_treatment as "selling",
                payment_method: (row.payment_method ?? "") as "cash",
                payment_reference: row.payment_reference ?? "",
                notes: "",
              }}
              options={options}
              targets={options.targets}
              canManage={can(ctx, "expenses.manage")}
              canAllocate={can(ctx, "expenses.allocate")}
              unallocated={row.unallocated_amount ?? 0}
              isVoided={row.is_voided}
            />
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Amount"
          value={<CurrencyDisplay value={row.amount} />}
          testId="expense-amount"
        />
        <MetricCard
          label="Cost treatment"
          value={treatment?.label ?? row.cost_treatment}
          hint={
            treatment?.operating
              ? "counted as operating expense"
              : "recognised inside inventory cost / asset"
          }
          testId="expense-treatment"
        />
        <MetricCard
          label="Allocated to production"
          value={<CurrencyDisplay value={row.allocated_amount} />}
          hint={`${(row.unallocated_amount ?? 0).toFixed(2)} unallocated`}
        />
        <MetricCard
          label="Paid via"
          value={row.payment_method ? METHOD[row.payment_method] : "—"}
          hint={row.payment_reference ?? undefined}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocations</CardTitle>
            <CardDescription>
              Traceability to the roast batch, packaging session or receipt whose cost this expense
              explains.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allocations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No allocations.</p>
            ) : (
              <ul className="divide-y text-sm" data-testid="allocations">
                {allocations.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 py-2"
                    data-testid="allocation"
                  >
                    <span>
                      <Link
                        href={`${TARGET_PATH[a.target_type]}/${a.target_id}`}
                        className="hover:underline"
                      >
                        {a.target_type.replace("_", " ")} {a.target_id.slice(0, 8)}…
                      </Link>
                      {a.notes ? <span className="text-muted-foreground"> · {a.notes}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <CurrencyDisplay value={a.amount} />
                      {can(ctx, "expenses.allocate") && !row.is_voided ? (
                        <RemoveAllocationButton expenseId={row.id} id={a.id} />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            {receiptUrl ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
                data-testid="receipt-link"
              >
                Open attached receipt
              </a>
            ) : (
              <p className="text-muted-foreground text-sm">No receipt attached.</p>
            )}
            {row.is_voided ? (
              <p className="text-destructive mt-3 text-sm">Voided — excluded from reports.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <p className="text-muted-foreground text-xs">
        Recorded {formatManilaDateTime(row.created_at)}
      </p>
    </div>
  );
}
