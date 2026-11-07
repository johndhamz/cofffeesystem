import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { isObjectWithin } from "@/lib/storage/paths";
import { ROAST_ATTACHMENT_BUCKET } from "@/lib/storage/buckets";
import { fromCentavos, toCentavos } from "@/lib/money";
import { capacityStatus } from "@/lib/roasting/calculations";
import { roastingRepository, type RoastListQuery } from "@/server/repositories/roasting.repository";
import { inventoryRepository } from "@/server/repositories/inventory.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { settingsRepository } from "@/server/repositories/settings.repository";
import {
  roastBatchSchema,
  roastCompletionSchema,
  roastEventSchema,
  roastMeasurementSchema,
  voidRoastSchema,
} from "@/features/roasting/schemas";

const ATTACHMENT_BUCKET = ROAST_ATTACHMENT_BUCKET;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export async function listRoastBatches(query: RoastListQuery) {
  const ctx = await requirePermission("roasting.read");
  const db = await createSupabaseServerClient();
  return roastingRepository(db).list(ctx.business.businessId, query);
}

export async function getRoastSummary(range?: { from?: string; to?: string }) {
  const ctx = await requirePermission("roasting.read");
  const db = await createSupabaseServerClient();
  return roastingRepository(db).summary(ctx.business.businessId, range);
}

export async function getRoastBatch(id: string) {
  const ctx = await requirePermission("roasting.read");
  const db = await createSupabaseServerClient();
  const repo = roastingRepository(db);
  const [summary, detail] = await Promise.all([
    repo.getSummary(ctx.business.businessId, id),
    repo.getDetail(ctx.business.businessId, id),
  ]);
  if (!summary || !detail) throw Errors.notFound("Roast batch");
  const attachments = await Promise.all(
    (detail.roast_attachments ?? []).map(async (a) => {
      const { data } = await db.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(a.storage_path, 60 * 60);
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );
  return { summary, detail: { ...detail, roast_attachments: attachments } };
}

export async function getRoastFormOptions() {
  const ctx = await requirePermission("roasting.read");
  const db = await createSupabaseServerClient();
  const repo = roastingRepository(db);
  const [roasters, profiles, locations, lots, members, settings] = await Promise.all([
    masterDataRepository(db, "roasters").listActive(ctx.business.businessId),
    repo.listProfiles(ctx.business.businessId),
    masterDataRepository(db, "inventory_locations").listActive(ctx.business.businessId),
    inventoryRepository(db).allGreenLots(ctx.business.businessId),
    repo.listMembers(ctx.business.businessId),
    settingsRepository(db).getByBusiness(ctx.business.businessId),
  ]);
  return {
    roasters: roasters.map((r) => ({
      id: r.id,
      name: r.name,
      capacity_g: r.capacity_g,
      capacity_policy: r.capacity_policy,
    })),
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, roaster_id: p.roaster_id })),
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    lots: lots
      .filter((l) => l.inventory_item_id && (l.available_g ?? 0) > 0)
      .map((l) => ({
        id: l.lot_id,
        label: `${l.coffee_name} · ${l.lot_code}`,
        available_g: l.available_g ?? 0,
        cost_per_kg: l.cost_per_kg,
      })),
    members,
    defaultRoasterId: settings.default_roaster_id,
    defaultLocationId: settings.default_location_id,
    currentUserId: ctx.user.id,
  };
}

/** Returns a capacity warning (never blocks a draft); completion enforces the roaster's policy. */
async function capacityWarning(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
  roasterId: string,
  greenG: number,
) {
  const roaster = await masterDataRepository(db, "roasters").getById(businessId, roasterId);
  if (!roaster) return null;
  const status = capacityStatus(greenG, roaster.capacity_g);
  return status.over
    ? `Green input ${greenG} g exceeds ${roaster.name}'s capacity of ${roaster.capacity_g} g (${status.pct}%).${roaster.capacity_policy === "block" ? " This roaster blocks over-capacity batches at completion." : ""}`
    : null;
}

export async function createRoastBatch(input: unknown, idempotencyKey: string) {
  const ctx = await requirePermission("roasting.manage");
  const values = validate(roastBatchSchema, input);
  const db = await createSupabaseServerClient();
  const id = await roastingRepository(db).create({
    businessId: ctx.business.businessId,
    roasterId: values.roaster_id,
    profileId: values.roast_profile_id ?? null,
    locationId: values.location_id,
    roastDate: values.roast_date,
    operatorId: values.operator_id ?? null,
    inputs: values.inputs,
    notes: values.notes ?? null,
    idempotencyKey,
  });
  const greenG = values.inputs.reduce((a, i) => a + i.input_weight_g, 0);
  return {
    id,
    warning: await capacityWarning(db, ctx.business.businessId, values.roaster_id, greenG),
  };
}

export async function updateRoastBatchDraft(id: string, input: unknown) {
  const ctx = await requirePermission("roasting.manage");
  const values = validate(roastBatchSchema, input);
  const db = await createSupabaseServerClient();
  await roastingRepository(db).updateDraft({
    batchId: id,
    roasterId: values.roaster_id,
    profileId: values.roast_profile_id ?? null,
    locationId: values.location_id,
    roastDate: values.roast_date,
    operatorId: values.operator_id ?? null,
    inputs: values.inputs,
    notes: values.notes ?? null,
  });
  const greenG = values.inputs.reduce((a, i) => a + i.input_weight_g, 0);
  return {
    id,
    warning: await capacityWarning(db, ctx.business.businessId, values.roaster_id, greenG),
  };
}

export async function startRoastBatch(id: string) {
  await requirePermission("roasting.manage");
  const db = await createSupabaseServerClient();
  await roastingRepository(db).start(id);
}

export async function completeRoastBatch(id: string, input: unknown) {
  await requirePermission("roasting.manage");
  const values = validate(roastCompletionSchema, input);
  const db = await createSupabaseServerClient();
  return roastingRepository(db).complete({
    batchId: id,
    roastedWeightG: values.roasted_weight_g,
    roastLevel: values.roast_level ?? null,
    totalDurationSeconds: values.total_duration_seconds,
    firstCrackSeconds: values.first_crack_seconds ?? null,
    chargeBtC: values.charge_bt_c ?? null,
    chargeEtC: values.charge_et_c ?? null,
    firstCrackBtC: values.first_crack_bt_c ?? null,
    dropBtC: values.drop_bt_c ?? null,
    costs: values.costs.map((c) => ({
      cost_type: c.cost_type,
      amount: fromCentavos(toCentavos(c.amount)),
      notes: c.notes ?? null,
    })),
    notes: values.notes ?? null,
  });
}

export async function voidRoastBatch(id: string, input: unknown, idempotencyKey: string) {
  await requirePermission("roasting.manage");
  const values = validate(voidRoastSchema, input);
  const db = await createSupabaseServerClient();
  await roastingRepository(db).void(id, values.reason, idempotencyKey);
}

export async function deleteDraftRoastBatch(id: string) {
  const ctx = await requirePermission("roasting.manage");
  const db = await createSupabaseServerClient();
  await roastingRepository(db).deleteDraft(ctx.business.businessId, id);
}

export async function saveMeasurement(batchId: string, input: unknown) {
  const ctx = await requirePermission("roasting.manage");
  const values = validate(roastMeasurementSchema, input);
  const db = await createSupabaseServerClient();
  return roastingRepository(db).upsertMeasurement(ctx.business.businessId, batchId, {
    elapsed_seconds: values.elapsed_seconds,
    bt_c: values.bt_c ?? null,
    et_c: values.et_c ?? null,
    gas_kpa: values.gas_kpa ?? null,
    airflow_pct: values.airflow_pct ?? null,
    drum_speed_pct: values.drum_speed_pct ?? null,
  });
}

export async function deleteMeasurement(id: string) {
  const ctx = await requirePermission("roasting.manage");
  const db = await createSupabaseServerClient();
  await roastingRepository(db).deleteMeasurement(ctx.business.businessId, id);
}

export async function addRoastEvent(batchId: string, input: unknown) {
  const ctx = await requirePermission("roasting.manage");
  const values = validate(roastEventSchema, input);
  const db = await createSupabaseServerClient();
  return roastingRepository(db).addEvent(ctx.business.businessId, batchId, {
    event_type: values.event_type,
    elapsed_seconds: values.elapsed_seconds,
    temperature_c: values.temperature_c ?? null,
    notes: values.notes ?? null,
  });
}

export async function deleteRoastEvent(id: string) {
  const ctx = await requirePermission("roasting.manage");
  const db = await createSupabaseServerClient();
  await roastingRepository(db).deleteEvent(ctx.business.businessId, id);
}

const FILE_TYPES: Record<string, string> = {
  ".alog": "artisan_alog",
  ".csv": "artisan_csv",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
};

/**
 * Records an attachment the browser already uploaded straight to Storage (see `uploadToBucket`).
 * Storage RLS, the bucket's MIME allow-list and size limit were enforced on the upload itself; here
 * we only accept objects inside this business's folder for this batch and confirm they exist.
 */
export async function attachRoastFile(
  batchId: string,
  input: { path: string; fileName: string; sizeBytes: number },
) {
  const ctx = await requirePermission("roasting.manage");
  if (!isObjectWithin(input.path, ctx.business.businessId, batchId))
    throw Errors.validation("Attachment path does not belong to this roast batch.");
  if (
    !Number.isFinite(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_ATTACHMENT_BYTES
  )
    throw Errors.validation("File is larger than 10 MB.", { file: ["Maximum size is 10 MB"] });
  const ext = (input.fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const fileType = FILE_TYPES[ext] ?? "other";
  const db = await createSupabaseServerClient();
  const probe = await db.storage.from(ATTACHMENT_BUCKET).createSignedUrl(input.path, 60);
  if (probe.error) throw Errors.validation("Uploaded file was not found. Please try again.");
  return roastingRepository(db).addAttachment(ctx.business.businessId, batchId, {
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    file_type: fileType,
    size_bytes: Math.round(input.sizeBytes),
    uploaded_by: ctx.user.id,
  });
}

export async function deleteRoastAttachment(id: string) {
  const ctx = await requirePermission("roasting.manage");
  const db = await createSupabaseServerClient();
  const row = await roastingRepository(db).deleteAttachment(ctx.business.businessId, id);
  if (row?.storage_path) await db.storage.from(ATTACHMENT_BUCKET).remove([row.storage_path]);
}

export async function listRoastedBulk() {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  return roastingRepository(db).roastedBulkList(ctx.business.businessId);
}
