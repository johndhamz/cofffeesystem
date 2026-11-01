import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { fromCentavos, toCentavos } from "@/lib/money";
import {
  packagingRepository,
  type SessionListQuery,
} from "@/server/repositories/packaging.repository";
import { roastingRepository } from "@/server/repositories/roasting.repository";
import { productsRepository } from "@/server/repositories/products.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { settingsRepository } from "@/server/repositories/settings.repository";
import { packagingSessionSchema, voidPackagingSchema } from "@/features/packaging/schemas";

export async function listPackagingSessions(query: SessionListQuery) {
  const ctx = await requirePermission("packaging.read");
  const db = await createSupabaseServerClient();
  return packagingRepository(db).listSessions(ctx.business.businessId, query);
}

export async function getPackagingSession(id: string) {
  const ctx = await requirePermission("packaging.read");
  const db = await createSupabaseServerClient();
  const s = await packagingRepository(db).getSession(ctx.business.businessId, id);
  if (!s) throw Errors.notFound("Packaging session");
  return s;
}

export async function getPackagingFormOptions() {
  const ctx = await requirePermission("packaging.read");
  const db = await createSupabaseServerClient();
  const [batches, variants, materials, locations, members, settings] = await Promise.all([
    roastingRepository(db).roastedBulkList(ctx.business.businessId),
    productsRepository(db).activeVariants(ctx.business.businessId),
    packagingRepository(db).materialsInventory(ctx.business.businessId),
    masterDataRepository(db, "inventory_locations").listActive(ctx.business.businessId),
    roastingRepository(db).listMembers(ctx.business.businessId),
    settingsRepository(db).getByBusiness(ctx.business.businessId),
  ]);
  return {
    batches: batches.map((b) => ({
      id: b.id,
      label: `${b.batch_number} · ${b.coffee_names ?? ""}`,
      available_g: b.roasted_available_g ?? 0,
      cost_per_kg: b.roasted_cost_per_kg,
    })),
    variants: variants.map((v) => ({
      id: v.id,
      label: `${v.products?.name} — ${v.name} (${v.sku})`,
      net_weight_g: v.net_weight_g,
      materials: (v.variant_materials ?? []).map((m) => ({
        material_id: m.material_id,
        quantity_per_unit: m.quantity_per_unit,
      })),
    })),
    materials: materials
      .filter((m) => m.is_active)
      .map((m) => ({
        id: m.material_id,
        name: m.name,
        base_unit: m.base_unit,
        available: m.available ?? 0,
        standard_unit_cost: m.standard_unit_cost,
      })),
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    members,
    defaultLocationId: settings.default_location_id,
    currentUserId: ctx.user.id,
  };
}

function toArgs(values: ReturnType<typeof validate<typeof packagingSessionSchema>>) {
  return {
    locationId: values.location_id,
    packagedAt: values.packaged_at,
    operatorId: values.operator_id ?? null,
    inputs: values.inputs,
    outputs: values.outputs.map((o) => ({
      variant_id: o.variant_id,
      quantity: o.quantity,
      lot_code: o.lot_code ?? null,
      best_before_at: o.best_before_at ?? null,
    })),
    materials: values.materials.filter((m) => m.quantity > 0),
    laborCost: fromCentavos(toCentavos(values.labor_cost)),
    overheadCost: fromCentavos(toCentavos(values.overhead_cost)),
    notes: values.notes ?? null,
  };
}

export async function createPackagingSession(input: unknown, idempotencyKey: string) {
  const ctx = await requirePermission("packaging.manage");
  const values = validate(packagingSessionSchema, input);
  const db = await createSupabaseServerClient();
  return packagingRepository(db).create({
    businessId: ctx.business.businessId,
    ...toArgs(values),
    idempotencyKey,
  });
}

export async function updatePackagingSessionDraft(id: string, input: unknown) {
  await requirePermission("packaging.manage");
  const values = validate(packagingSessionSchema, input);
  const db = await createSupabaseServerClient();
  return packagingRepository(db).updateDraft({ sessionId: id, ...toArgs(values) });
}

export async function completePackagingSession(id: string) {
  await requirePermission("packaging.manage");
  const db = await createSupabaseServerClient();
  return packagingRepository(db).complete(id);
}

export async function voidPackagingSession(id: string, input: unknown, idempotencyKey: string) {
  await requirePermission("packaging.manage");
  const values = validate(voidPackagingSchema, input);
  const db = await createSupabaseServerClient();
  await packagingRepository(db).void(id, values.reason, idempotencyKey);
}

export async function deleteDraftPackagingSession(id: string) {
  const ctx = await requirePermission("packaging.manage");
  const db = await createSupabaseServerClient();
  await packagingRepository(db).deleteDraft(ctx.business.businessId, id);
}

export async function listFinishedGoods(opts: {
  q?: string;
  stock?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  return packagingRepository(db).finishedGoods(ctx.business.businessId, opts);
}

export async function getFinishedLot(lotId: string) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  const repo = packagingRepository(db);
  const lot = await repo.finishedLot(ctx.business.businessId, lotId);
  if (!lot) throw Errors.notFound("Finished goods lot");
  const lineage = lot.packaging_session_id
    ? await repo.finishedLotLineage(ctx.business.businessId, lot.packaging_session_id)
    : [];
  return { lot, lineage };
}

export async function listMaterialsInventory() {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  return packagingRepository(db).materialsInventory(ctx.business.businessId);
}
