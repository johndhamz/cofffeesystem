"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  createSalesReturn,
  deleteDraftSalesOrder,
  fulfillSalesOrder,
  issueRefund,
  recordPayment,
  updateSalesOrderDraft,
} from "@/server/services/sales.service";

function revalidate(id?: string) {
  revalidatePath("/sales");
  revalidatePath("/sales/history");
  if (id) revalidatePath(`/sales/${id}`);
  revalidatePath("/customers");
  revalidatePath("/inventory/finished");
  revalidatePath("/dashboard");
}

export async function createSalesOrderAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await createSalesOrder(input, idempotencyKey);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateSalesOrderDraftAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await updateSalesOrderDraft(id, input);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function confirmSalesOrderAction(id: string): Promise<ActionResult> {
  try {
    await confirmSalesOrder(id, true);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function cancelSalesOrderAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await cancelSalesOrder(id, input);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDraftSalesOrderAction(id: string): Promise<ActionResult> {
  try {
    await deleteDraftSalesOrder(id);
    revalidate();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function fulfillSalesOrderAction(
  id: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const fid = await fulfillSalesOrder(id, input, idempotencyKey);
    revalidate(id);
    return ok({ id: fid });
  } catch (error) {
    return fail(error);
  }
}

export async function recordPaymentAction(
  orderId: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await recordPayment(orderId, input, idempotencyKey);
    revalidate(orderId);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function issueRefundAction(
  orderId: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await issueRefund(input, idempotencyKey);
    revalidate(orderId);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function createSalesReturnAction(
  orderId: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await createSalesReturn(orderId, input, idempotencyKey);
    revalidate(orderId);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
