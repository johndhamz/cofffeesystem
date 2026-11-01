"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  addRoastEvent,
  completeRoastBatch,
  createRoastBatch,
  deleteDraftRoastBatch,
  deleteMeasurement,
  deleteRoastAttachment,
  deleteRoastEvent,
  saveMeasurement,
  startRoastBatch,
  updateRoastBatchDraft,
  uploadRoastAttachment,
  voidRoastBatch,
} from "@/server/services/roasting.service";

function revalidate(id?: string) {
  revalidatePath("/roasting");
  revalidatePath("/roasting/history");
  if (id) revalidatePath(`/roasting/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/inventory/roasted");
  revalidatePath("/dashboard");
}

export async function createRoastBatchAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string; warning: string | null }>> {
  try {
    const result = await createRoastBatch(input, idempotencyKey);
    revalidate(result.id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function updateRoastBatchDraftAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string; warning: string | null }>> {
  try {
    const result = await updateRoastBatchDraft(id, input);
    revalidate(id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function startRoastBatchAction(id: string): Promise<ActionResult> {
  try {
    await startRoastBatch(id);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function completeRoastBatchAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await completeRoastBatch(id, input);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function voidRoastBatchAction(
  id: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult> {
  try {
    await voidRoastBatch(id, input, idempotencyKey);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDraftRoastBatchAction(id: string): Promise<ActionResult> {
  try {
    await deleteDraftRoastBatch(id);
    revalidate();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function saveMeasurementAction(
  batchId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await saveMeasurement(batchId, input);
    revalidatePath(`/roasting/${batchId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMeasurementAction(batchId: string, id: string): Promise<ActionResult> {
  try {
    await deleteMeasurement(id);
    revalidatePath(`/roasting/${batchId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function addRoastEventAction(
  batchId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await addRoastEvent(batchId, input);
    revalidatePath(`/roasting/${batchId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRoastEventAction(batchId: string, id: string): Promise<ActionResult> {
  try {
    await deleteRoastEvent(id);
    revalidatePath(`/roasting/${batchId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function uploadRoastAttachmentAction(
  batchId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const file = formData.get("file");
    await uploadRoastAttachment(batchId, file as File);
    revalidatePath(`/roasting/${batchId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRoastAttachmentAction(
  batchId: string,
  id: string,
): Promise<ActionResult> {
  try {
    await deleteRoastAttachment(id);
    revalidatePath(`/roasting/${batchId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
