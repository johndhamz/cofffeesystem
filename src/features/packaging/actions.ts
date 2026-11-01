"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  completePackagingSession,
  createPackagingSession,
  deleteDraftPackagingSession,
  updatePackagingSessionDraft,
  voidPackagingSession,
} from "@/server/services/packaging.service";

function revalidate(id?: string) {
  revalidatePath("/packaging");
  if (id) revalidatePath(`/packaging/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/inventory/roasted");
  revalidatePath("/inventory/finished");
  revalidatePath("/inventory/materials");
  revalidatePath("/dashboard");
}

export async function createPackagingSessionAction(
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await createPackagingSession(input, idempotencyKey);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function updatePackagingSessionDraftAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await updatePackagingSessionDraft(id, input);
    revalidate(id);
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function completePackagingSessionAction(id: string): Promise<ActionResult> {
  try {
    await completePackagingSession(id);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function voidPackagingSessionAction(
  id: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActionResult> {
  try {
    await voidPackagingSession(id, input, idempotencyKey);
    revalidate(id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDraftPackagingSessionAction(id: string): Promise<ActionResult> {
  try {
    await deleteDraftPackagingSession(id);
    revalidate();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
