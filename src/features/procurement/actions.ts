"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  deleteDraftPurchaseOrder,
  receiveGoods,
  updatePurchaseOrderDraft,
} from "@/server/services/procurement.service";

function revalidatePurchases(id?: string) {
  revalidatePath("/purchases");
  if (id) revalidatePath(`/purchases/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function createPurchaseOrderAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await createPurchaseOrder(input, idempotencyKey);
    revalidatePurchases(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function updatePurchaseOrderDraftAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await updatePurchaseOrderDraft(id, input);
    revalidatePurchases(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function confirmPurchaseOrderAction(id: string): Promise<ActionResult> {
  try {
    await confirmPurchaseOrder(id);
    revalidatePurchases(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function cancelPurchaseOrderAction(id: string): Promise<ActionResult> {
  try {
    await cancelPurchaseOrder(id);
    revalidatePurchases(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDraftPurchaseOrderAction(id: string): Promise<ActionResult> {
  try {
    await deleteDraftPurchaseOrder(id);
    revalidatePurchases();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function receiveGoodsAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ receiptId: string }>> {
  try {
    const receiptId = await receiveGoods(input, idempotencyKey);
    revalidatePurchases(
      typeof input.purchase_order_id === "string" ? input.purchase_order_id : undefined,
    );
    return ok({ receiptId });
  } catch (error) {
    return fail(error);
  }
}
