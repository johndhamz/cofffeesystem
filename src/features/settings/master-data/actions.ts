"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult, Errors } from "@/lib/errors";
import {
  createMasterRecord,
  deleteMasterRecord,
  setMasterRecordActive,
  updateMasterRecord,
} from "@/server/services/master-data.service";
import { isMasterEntityKey, MASTER_ENTITIES } from "./entities";

function revalidate(key: string, id?: string) {
  const entity = MASTER_ENTITIES[key as keyof typeof MASTER_ENTITIES];
  revalidatePath(entity.basePath);
  if (id) revalidatePath(`${entity.basePath}/${id}`);
  revalidatePath("/settings");
}

export async function createMasterRecordAction(
  key: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!isMasterEntityKey(key)) throw Errors.notFound("Entity");
    const row = await createMasterRecord(key, input);
    revalidate(key);
    return ok({ id: row.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateMasterRecordAction(
  key: string,
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!isMasterEntityKey(key)) throw Errors.notFound("Entity");
    const row = await updateMasterRecord(key, id, input);
    revalidate(key, id);
    return ok({ id: row.id });
  } catch (error) {
    return fail(error);
  }
}

export async function setMasterRecordActiveAction(
  key: string,
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    if (!isMasterEntityKey(key)) throw Errors.notFound("Entity");
    await setMasterRecordActive(key, id, isActive);
    revalidate(key, id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMasterRecordAction(key: string, id: string): Promise<ActionResult> {
  try {
    if (!isMasterEntityKey(key)) throw Errors.notFound("Entity");
    await deleteMasterRecord(key, id);
    revalidate(key, id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
