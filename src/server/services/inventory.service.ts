import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { inventoryRepository } from "@/server/repositories/inventory.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import {
  inventoryAdjustmentSchema,
  inventoryFilterSchema,
  lotUpdateSchema,
  type InventoryFilter,
} from "@/features/inventory/schemas";

export function parseInventoryFilter(
  searchParams: Record<string, string | string[] | undefined>,
): InventoryFilter {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) flat[k] = Array.isArray(v) ? v[0] : v;
  const parsed = inventoryFilterSchema.safeParse(flat);
  return parsed.success ? parsed.data : inventoryFilterSchema.parse({});
}

export async function getGreenInventoryDashboard(filter: InventoryFilter) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  const repo = inventoryRepository(db);
  const [lots, summary, options] = await Promise.all([
    repo.listGreenLots(ctx.business.businessId, filter),
    repo.summary(ctx.business.businessId),
    repo.filterOptions(ctx.business.businessId),
  ]);
  return { lots, summary, options };
}

export async function getGreenLotDetail(lotId: string) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  const repo = inventoryRepository(db);
  const lot = await repo.getGreenLot(ctx.business.businessId, lotId);
  if (!lot) throw Errors.notFound("Green coffee lot");
  const [record, balances, layers, movements] = await Promise.all([
    repo.getLotRecord(ctx.business.businessId, lotId),
    lot.inventory_item_id
      ? repo.balancesForItem(ctx.business.businessId, lot.inventory_item_id)
      : Promise.resolve([]),
    lot.inventory_item_id
      ? repo.costLayersForItem(ctx.business.businessId, lot.inventory_item_id)
      : Promise.resolve([]),
    lot.inventory_item_id
      ? repo.listMovements(ctx.business.businessId, {
          inventoryItemId: lot.inventory_item_id,
          page: 1,
          pageSize: 50,
        })
      : Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 50, pageCount: 1 }),
  ]);
  return { lot, record, balances, layers, movements };
}

export async function updateGreenLot(lotId: string, input: unknown) {
  const ctx = await requirePermission("inventory.adjust");
  const values = validate(lotUpdateSchema, input);
  const db = await createSupabaseServerClient();
  const repo = inventoryRepository(db);
  const lot = await repo.getGreenLot(ctx.business.businessId, lotId);
  if (!lot) throw Errors.notFound("Green coffee lot");
  await repo.updateLot(ctx.business.businessId, lotId, {
    moisture_pct: values.moisture_pct ?? null,
    density_g_per_100ml: values.density_g_per_100ml ?? null,
    notes: values.notes ?? null,
  });
  if (lot.inventory_item_id) {
    await repo.updateItemThreshold(
      ctx.business.businessId,
      lot.inventory_item_id,
      values.low_stock_threshold_g ?? null,
    );
  }
}

export async function listMovements(args: {
  inventoryItemId?: string;
  page: number;
  pageSize: number;
  type?: string;
}) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  return inventoryRepository(db).listMovements(ctx.business.businessId, args);
}

/** Every stock item that can be adjusted: green lots, roasted batches, packaging materials, finished lots. */
export async function getAdjustmentFormOptions() {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  const bid = ctx.business.businessId;
  const [lots, locations, roasted, materials, finished] = await Promise.all([
    inventoryRepository(db).allGreenLots(bid),
    masterDataRepository(db, "inventory_locations").listActive(bid),
    db
      .from("roast_batch_summary_view")
      .select("id, batch_number, coffee_names, roasted_item_id, roasted_available_g")
      .eq("business_id", bid)
      .eq("status", "completed")
      .not("roasted_item_id", "is", null),
    db
      .from("packaging_material_inventory_view")
      .select("material_id, name, base_unit, inventory_item_id, available")
      .eq("business_id", bid)
      .eq("is_active", true),
    db
      .from("finished_goods_inventory_view")
      .select("lot_id, lot_code, product_name, variant_name, inventory_item_id, available")
      .eq("business_id", bid),
  ]);
  const items: {
    inventory_item_id: string;
    label: string;
    available: number;
    unit: string;
    group: string;
  }[] = [
    ...lots
      .filter((l) => l.inventory_item_id)
      .map((l) => ({
        inventory_item_id: l.inventory_item_id!,
        label: `${l.coffee_name} · ${l.lot_code}`,
        available: l.available_g ?? 0,
        unit: "g",
        group: "Green coffee lots",
      })),
    ...(roasted.data ?? []).map((r) => ({
      inventory_item_id: r.roasted_item_id!,
      label: `${r.batch_number} · ${r.coffee_names ?? ""}`,
      available: r.roasted_available_g ?? 0,
      unit: "g",
      group: "Roasted bulk",
    })),
    ...(materials.data ?? [])
      .filter((m) => m.inventory_item_id)
      .map((m) => ({
        inventory_item_id: m.inventory_item_id!,
        label: m.name,
        available: m.available ?? 0,
        unit: m.base_unit,
        group: "Packaging materials",
      })),
    ...(finished.data ?? [])
      .filter((f) => f.inventory_item_id)
      .map((f) => ({
        inventory_item_id: f.inventory_item_id!,
        label: `${f.product_name} ${f.variant_name} · ${f.lot_code}`,
        available: f.available ?? 0,
        unit: "unit",
        group: "Finished goods",
      })),
  ];
  return { items, locations };
}

/** Create and post an inventory adjustment atomically. Idempotent on the key. */
export async function createInventoryAdjustment(input: unknown, idempotencyKey: string) {
  const ctx = await requirePermission("inventory.adjust");
  const values = validate(inventoryAdjustmentSchema, input);
  const db = await createSupabaseServerClient();
  return inventoryRepository(db).createInventoryAdjustment({
    businessId: ctx.business.businessId,
    reason: values.reason,
    notes: values.notes ?? null,
    lines: values.lines.map((line) => ({
      inventory_item_id: line.inventory_item_id,
      location_id: line.location_id,
      quantity_delta: line.direction === "increase" ? line.quantity : -line.quantity,
      unit_cost: line.unit_cost ?? null,
      notes: line.notes ?? null,
    })),
    idempotencyKey,
    post: true,
  });
}

export async function reverseInventoryAdjustment(adjustmentId: string, idempotencyKey: string) {
  await requirePermission("inventory.adjust");
  const db = await createSupabaseServerClient();
  return inventoryRepository(db).reverseInventoryAdjustment(adjustmentId, idempotencyKey);
}

export async function listAdjustments(page: number, pageSize = 25) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  return inventoryRepository(db).listAdjustments(ctx.business.businessId, page, pageSize);
}

export async function getAdjustment(id: string) {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  const adj = await inventoryRepository(db).getAdjustment(ctx.business.businessId, id);
  if (!adj) throw Errors.notFound("Inventory adjustment");
  return adj;
}

export async function getReconciliationIssues() {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  return inventoryRepository(db).reconciliation(ctx.business.businessId);
}
