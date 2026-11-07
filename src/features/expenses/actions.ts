"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  addAllocation,
  createExpense,
  removeAllocation,
  updateExpense,
  attachReceipt,
  voidExpense,
} from "@/server/services/expenses.service";

function revalidate(id?: string) {
  revalidatePath("/expenses");
  if (id) revalidatePath(`/expenses/${id}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function createExpenseAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const row = await createExpense(input, idempotencyKey);
    revalidate(row.id);
    return ok({ id: row.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateExpenseAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await updateExpense(id, input);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function voidExpenseAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await voidExpense(id, input);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function addAllocationAction(
  expenseId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await addAllocation(expenseId, input);
    revalidate(expenseId);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function removeAllocationAction(expenseId: string, id: string): Promise<ActionResult> {
  try {
    await removeAllocation(id);
    revalidate(expenseId);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function attachReceiptAction(expenseId: string, path: string): Promise<ActionResult> {
  try {
    await attachReceipt(expenseId, path);
    revalidate(expenseId);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
