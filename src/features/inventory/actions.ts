"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  createInventoryAdjustment,
  reverseInventoryAdjustment,
  updateGreenLot,
} from "@/server/services/inventory.service";

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  revalidatePath("/inventory/adjustments");
  revalidatePath("/dashboard");
}

export async function createInventoryAdjustmentAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await createInventoryAdjustment(input, idempotencyKey);
    revalidateInventory();
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function reverseInventoryAdjustmentAction(
  adjustmentId: string,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await reverseInventoryAdjustment(adjustmentId, idempotencyKey);
    revalidateInventory();
    revalidatePath(`/inventory/adjustments/${adjustmentId}`);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateGreenLotAction(
  lotId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await updateGreenLot(lotId, input);
    revalidateInventory();
    revalidatePath(`/inventory/lots/${lotId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
