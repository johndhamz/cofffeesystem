import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { isObjectWithin } from "@/lib/storage/paths";
import { RECEIPT_BUCKET } from "@/lib/storage/buckets";
import { fromCentavos, toCentavos } from "@/lib/money";
import {
  expensesRepository,
  type ExpenseListQuery,
} from "@/server/repositories/expenses.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { allocationSchema, expenseSchema, voidExpenseSchema } from "@/features/expenses/schemas";

const BUCKET = RECEIPT_BUCKET;

export async function listExpenses(query: ExpenseListQuery) {
  const ctx = await requirePermission("expenses.read");
  const db = await createSupabaseServerClient();
  return expensesRepository(db).list(ctx.business.businessId, query);
}

export async function getExpense(id: string) {
  const ctx = await requirePermission("expenses.read");
  const db = await createSupabaseServerClient();
  const e = await expensesRepository(db).get(ctx.business.businessId, id);
  if (!e) throw Errors.notFound("Expense");
  let receiptUrl: string | null = null;
  if (e.row.receipt_path) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(e.row.receipt_path, 3600);
    receiptUrl = data?.signedUrl ?? null;
  }
  return { ...e, receiptUrl };
}

export async function getExpenseFormOptions() {
  const ctx = await requirePermission("expenses.read");
  const db = await createSupabaseServerClient();
  const [categories, suppliers, targets] = await Promise.all([
    masterDataRepository(db, "expense_categories").listActive(ctx.business.businessId),
    masterDataRepository(db, "suppliers").listActive(ctx.business.businessId),
    expensesRepository(db).allocationTargets(ctx.business.businessId),
  ]);
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      classification: c.classification,
    })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    targets,
  };
}

function toRow(values: ReturnType<typeof validate<typeof expenseSchema>>) {
  return {
    expense_category_id: values.expense_category_id,
    supplier_id: values.supplier_id ?? null,
    amount: fromCentavos(toCentavos(values.amount)),
    incurred_at: values.incurred_at,
    description: values.description,
    cost_treatment: values.cost_treatment,
    payment_method: values.payment_method ?? null,
    payment_reference: values.payment_reference ?? null,
    notes: values.notes ?? null,
  };
}

export async function createExpense(input: unknown, idempotencyKey: string) {
  const ctx = await requirePermission("expenses.manage");
  const values = validate(expenseSchema, input);
  const db = await createSupabaseServerClient();
  const repo = expensesRepository(db);
  const { data: existing } = await db
    .from("expenses")
    .select("id")
    .eq("business_id", ctx.business.businessId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return existing;
  return repo.create({
    ...toRow(values),
    business_id: ctx.business.businessId,
    idempotency_key: idempotencyKey,
    created_by: ctx.user.id,
  });
}

export async function updateExpense(id: string, input: unknown) {
  const ctx = await requirePermission("expenses.manage");
  const values = validate(expenseSchema, input);
  const db = await createSupabaseServerClient();
  const repo = expensesRepository(db);
  const existing = await repo.raw(ctx.business.businessId, id);
  if (!existing) throw Errors.notFound("Expense");
  if (existing.is_voided) throw Errors.invalidState("Voided expenses cannot be edited.");
  return repo.update(ctx.business.businessId, id, toRow(values));
}

export async function voidExpense(id: string, input: unknown) {
  const ctx = await requirePermission("expenses.manage");
  const values = validate(voidExpenseSchema, input);
  const db = await createSupabaseServerClient();
  return expensesRepository(db).update(ctx.business.businessId, id, {
    is_voided: true,
    void_reason: values.reason,
  });
}

export async function addAllocation(expenseId: string, input: unknown) {
  const ctx = await requirePermission("expenses.allocate");
  const values = validate(allocationSchema, input);
  const db = await createSupabaseServerClient();
  const repo = expensesRepository(db);
  const existing = await repo.raw(ctx.business.businessId, expenseId);
  if (!existing) throw Errors.notFound("Expense");
  return repo.addAllocation({
    business_id: ctx.business.businessId,
    expense_id: expenseId,
    source_id: expenseId,
    target_type: values.target_type,
    target_id: values.target_id,
    amount: fromCentavos(toCentavos(values.amount)),
    notes: values.notes ?? null,
    created_by: ctx.user.id,
  });
}

export async function removeAllocation(id: string) {
  const ctx = await requirePermission("expenses.allocate");
  const db = await createSupabaseServerClient();
  await expensesRepository(db).removeAllocation(ctx.business.businessId, id);
}

/**
 * Records a receipt the browser already uploaded straight to Storage (see `uploadToBucket`).
 * The object must sit inside this business's folder for this expense; Storage RLS already
 * guaranteed the caller could only write there, and we confirm the object really exists before
 * pointing the expense at it. A previous receipt is removed so the bucket never holds orphans.
 */
export async function attachReceipt(expenseId: string, path: string) {
  const ctx = await requirePermission("expenses.manage");
  if (!isObjectWithin(path, ctx.business.businessId, expenseId))
    throw Errors.validation("Receipt path does not belong to this expense.");
  const db = await createSupabaseServerClient();
  const repo = expensesRepository(db);
  const existing = await repo.raw(ctx.business.businessId, expenseId);
  if (!existing) throw Errors.notFound("Expense");
  if (existing.is_voided) throw Errors.validation("Voided expenses cannot be changed.");
  const probe = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (probe.error) throw Errors.validation("Uploaded file was not found. Please try again.");
  const updated = await repo.update(ctx.business.businessId, expenseId, { receipt_path: path });
  if (existing.receipt_path && existing.receipt_path !== path)
    await db.storage.from(BUCKET).remove([existing.receipt_path]);
  return updated;
}
