import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { Errors } from "@/lib/errors";
import { validate } from "@/lib/validation";
import type { ListQuery } from "@/lib/validation/common";
import {
  masterDataRepository,
  type MasterRow,
  type MasterTable,
} from "@/server/repositories/master-data.repository";
import { MASTER_ENTITIES, type MasterEntityKey } from "@/features/settings/master-data/entities";
import type { Paginated } from "@/types";

/**
 * Application service for all master-data entities (suppliers, green coffees, roasters,
 * locations, expense categories, sales channels). Handles:
 *  - permission checks (central policy) — RLS enforces the same rules in the database
 *  - server-side validation (zod)
 *  - duplicate detection (case-insensitive name per business; DB has a unique index too)
 *  - business scoping
 */
export async function listMasterRecords<K extends MasterEntityKey>(
  key: K,
  query: ListQuery,
): Promise<Paginated<MasterRow<(typeof MASTER_ENTITIES)[K]["table"]>>> {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission("master_data.read");
  const db = await createSupabaseServerClient();
  const repo = masterDataRepository(db, entity.table);
  return repo.list(ctx.business.businessId, query, {
    searchColumns: entity.searchColumns,
    sortableColumns: entity.sortableColumns,
    defaultSort: entity.defaultSort,
  }) as Promise<Paginated<MasterRow<(typeof MASTER_ENTITIES)[K]["table"]>>>;
}

export async function listActiveMasterRecords<K extends MasterEntityKey>(
  key: K,
): Promise<MasterRow<(typeof MASTER_ENTITIES)[K]["table"]>[]> {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission("master_data.read");
  const db = await createSupabaseServerClient();
  return masterDataRepository(db, entity.table).listActive(ctx.business.businessId) as Promise<
    MasterRow<(typeof MASTER_ENTITIES)[K]["table"]>[]
  >;
}

export async function getMasterRecord<K extends MasterEntityKey>(
  key: K,
  id: string,
): Promise<MasterRow<(typeof MASTER_ENTITIES)[K]["table"]> | null> {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission("master_data.read");
  const db = await createSupabaseServerClient();
  return masterDataRepository(db, entity.table).getById(
    ctx.business.businessId,
    id,
  ) as Promise<MasterRow<(typeof MASTER_ENTITIES)[K]["table"]> | null>;
}

export async function createMasterRecord<K extends MasterEntityKey>(key: K, input: unknown) {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission(entity.managePermission);
  const values = validate(entity.schema, input) as Record<string, unknown> & { name: string };
  const db = await createSupabaseServerClient();
  const repo = masterDataRepository(db, entity.table);

  const duplicate = await repo.findByName(ctx.business.businessId, values.name);
  if (duplicate) {
    throw Errors.conflict(`${entity.singular} "${values.name}" already exists.`, {
      name: [`A ${entity.singular.toLowerCase()} with this name already exists`],
    });
  }

  return repo.create({
    ...nullifyUndefined(values),
    business_id: ctx.business.businessId,
  } as never);
}

export async function updateMasterRecord<K extends MasterEntityKey>(
  key: K,
  id: string,
  input: unknown,
) {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission(entity.managePermission);
  const values = validate(entity.schema, input) as Record<string, unknown> & { name: string };
  const db = await createSupabaseServerClient();
  const repo = masterDataRepository(db, entity.table);

  const existing = await repo.getById(ctx.business.businessId, id);
  if (!existing) throw Errors.notFound(entity.singular);

  const duplicate = await repo.findByName(ctx.business.businessId, values.name, id);
  if (duplicate) {
    throw Errors.conflict(`${entity.singular} "${values.name}" already exists.`, {
      name: [`A ${entity.singular.toLowerCase()} with this name already exists`],
    });
  }

  return repo.update(ctx.business.businessId, id, nullifyUndefined(values) as never);
}

export async function setMasterRecordActive<K extends MasterEntityKey>(
  key: K,
  id: string,
  isActive: boolean,
) {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission(entity.managePermission);
  const db = await createSupabaseServerClient();
  const repo = masterDataRepository(db, entity.table);
  const existing = await repo.getById(ctx.business.businessId, id);
  if (!existing) throw Errors.notFound(entity.singular);
  return repo.update(ctx.business.businessId, id, { is_active: isActive } as never);
}

/**
 * Hard delete. Only owners may do this, and the database refuses (FK RESTRICT) when the
 * record is referenced by any transaction. Prefer deactivation.
 */
export async function deleteMasterRecord<K extends MasterEntityKey>(key: K, id: string) {
  const entity = MASTER_ENTITIES[key];
  const ctx = await requirePermission(entity.managePermission);
  if (ctx.business.role !== "owner") {
    throw Errors.forbidden("Only owners can permanently delete records. Deactivate it instead.");
  }
  const db = await createSupabaseServerClient();
  const repo = masterDataRepository(db, entity.table);
  const existing = await repo.getById(ctx.business.businessId, id);
  if (!existing) throw Errors.notFound(entity.singular);
  try {
    await repo.remove(ctx.business.businessId, id);
  } catch (error) {
    if (error instanceof Error && /referenc/i.test(error.message)) {
      throw Errors.invalidState(
        `${entity.singular} is used by existing transactions and cannot be deleted. Deactivate it instead.`,
      );
    }
    throw error;
  }
}

function nullifyUndefined<T extends Record<string, unknown>>(values: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) out[k] = v === undefined ? null : v;
  return out as T;
}

export type { MasterTable };
