import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { allocateCentavos, fromCentavos, toCentavos } from "@/lib/money";
import { kgToGrams } from "@/lib/units";
import {
  procurementRepository,
  type PurchaseOrderListQuery,
} from "@/server/repositories/procurement.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { settingsRepository } from "@/server/repositories/settings.repository";
import { goodsReceiptSchema, purchaseOrderSchema } from "@/features/procurement/schemas";

/**
 * Procurement application service.
 * State transitions and stock posting happen inside PostgreSQL functions (atomic + idempotent);
 * this layer validates input, enforces permissions and prepares money/weight values.
 */

export async function listPurchaseOrders(query: PurchaseOrderListQuery) {
  const ctx = await requirePermission("purchases.read");
  const db = await createSupabaseServerClient();
  return procurementRepository(db).listPurchaseOrders(ctx.business.businessId, query);
}

export async function getPurchaseOrder(id: string) {
  const ctx = await requirePermission("purchases.read");
  const db = await createSupabaseServerClient();
  const po = await procurementRepository(db).getPurchaseOrder(ctx.business.businessId, id);
  if (!po) throw Errors.notFound("Purchase order");
  return po;
}

export async function getPurchaseFormOptions() {
  const ctx = await requirePermission("purchases.read");
  const db = await createSupabaseServerClient();
  const [suppliers, greenCoffees, locations, settings] = await Promise.all([
    masterDataRepository(db, "suppliers").listActive(ctx.business.businessId),
    masterDataRepository(db, "green_coffees").listActive(ctx.business.businessId),
    masterDataRepository(db, "inventory_locations").listActive(ctx.business.businessId),
    settingsRepository(db).getByBusiness(ctx.business.businessId),
  ]);
  return { suppliers, greenCoffees, locations, defaultLocationId: settings.default_location_id };
}

function toPoItems(items: { green_coffee_id: string; quantity_kg: number; unit_cost: string }[]) {
  return items.map((item) => ({
    green_coffee_id: item.green_coffee_id,
    ordered_quantity_g: kgToGrams(item.quantity_kg),
    unit_cost: item.unit_cost,
  }));
}

export async function createPurchaseOrder(input: unknown, idempotencyKey: string) {
  const ctx = await requirePermission("purchases.manage");
  const values = validate(purchaseOrderSchema, input);
  const db = await createSupabaseServerClient();
  return procurementRepository(db).createPurchaseOrder({
    businessId: ctx.business.businessId,
    supplierId: values.supplier_id,
    orderedAt: values.ordered_at,
    notes: values.notes ?? null,
    additionalCosts: fromCentavos(toCentavos(values.additional_costs)),
    items: toPoItems(values.items),
    idempotencyKey,
  });
}

export async function updatePurchaseOrderDraft(id: string, input: unknown) {
  await requirePermission("purchases.manage");
  const values = validate(purchaseOrderSchema, input);
  const db = await createSupabaseServerClient();
  return procurementRepository(db).updatePurchaseOrderDraft({
    purchaseOrderId: id,
    supplierId: values.supplier_id,
    orderedAt: values.ordered_at,
    notes: values.notes ?? null,
    additionalCosts: fromCentavos(toCentavos(values.additional_costs)),
    items: toPoItems(values.items),
  });
}

export async function confirmPurchaseOrder(id: string) {
  await requirePermission("purchases.manage");
  const db = await createSupabaseServerClient();
  await procurementRepository(db).confirmPurchaseOrder(id);
}

export async function cancelPurchaseOrder(id: string) {
  await requirePermission("purchases.manage");
  const db = await createSupabaseServerClient();
  await procurementRepository(db).cancelPurchaseOrder(id);
}

export async function deleteDraftPurchaseOrder(id: string) {
  const ctx = await requirePermission("purchases.manage");
  const db = await createSupabaseServerClient();
  await procurementRepository(db).deleteDraftPurchaseOrder(ctx.business.businessId, id);
}

/**
 * Receive goods against a confirmed purchase order and post stock in one transaction.
 * Receipt-level additional costs are allocated across lines proportionally to received
 * weight using the largest-remainder method so the centavos always sum exactly.
 */
export async function receiveGoods(input: unknown, idempotencyKey: string) {
  await requirePermission("purchases.post");
  const values = validate(goodsReceiptSchema, input);

  const received = values.items
    .map((item) => ({ ...item, received_quantity_g: kgToGrams(item.quantity_kg) }))
    .filter((item) => item.received_quantity_g > 0);
  if (received.length === 0) {
    throw Errors.validation("Enter a received quantity for at least one item.", {
      items: ["Enter a received quantity for at least one item"],
    });
  }

  const landedTotal = toCentavos(values.additional_costs);
  const allocations = allocateCentavos(
    landedTotal,
    received.map((i) => i.received_quantity_g),
  );

  const db = await createSupabaseServerClient();
  const repo = procurementRepository(db);
  const receiptId = await repo.createGoodsReceipt({
    purchaseOrderId: values.purchase_order_id,
    locationId: values.location_id,
    receivedAt: values.received_at,
    additionalCosts: fromCentavos(landedTotal),
    notes: values.notes ?? null,
    items: received.map((item, idx) => ({
      purchase_order_item_id: item.purchase_order_item_id,
      received_quantity_g: item.received_quantity_g,
      allocated_landed_cost: fromCentavos(allocations[idx] ?? 0),
      green_lot_id: null,
      new_lot: {
        lot_code: item.lot_code ?? null,
        moisture_pct: item.moisture_pct ?? null,
        density_g_per_100ml: item.density_g_per_100ml ?? null,
        notes: item.lot_notes ?? null,
      },
    })),
    idempotencyKey,
  });

  await repo.postGoodsReceipt(receiptId);
  return receiptId;
}

export async function getGoodsReceipt(id: string) {
  const ctx = await requirePermission("purchases.read");
  const db = await createSupabaseServerClient();
  const receipt = await procurementRepository(db).getGoodsReceipt(ctx.business.businessId, id);
  if (!receipt) throw Errors.notFound("Goods receipt");
  return receipt;
}
