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

export async function getAdjustmentFormOptions() {
  const ctx = await requirePermission("inventory.read");
  const db = await createSupabaseServerClient();
  const [lots, locations] = await Promise.all([
    inventoryRepository(db).allGreenLots(ctx.business.businessId),
    masterDataRepository(db, "inventory_locations").listActive(ctx.business.businessId),
  ]);
  return { lots: lots.filter((l) => l.inventory_item_id), locations };
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
