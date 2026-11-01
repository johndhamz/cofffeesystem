import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { validate } from "@/lib/validation";
import { Errors } from "@/lib/errors";
import { fromCentavos, toCentavos } from "@/lib/money";
import { salesRepository, type OrderListQuery } from "@/server/repositories/sales.repository";
import { masterDataRepository } from "@/server/repositories/master-data.repository";
import { settingsRepository } from "@/server/repositories/settings.repository";
import {
  cancelOrderSchema,
  fulfillmentSchema,
  paymentSchema,
  refundSchema,
  returnSchema,
  salesOrderSchema,
} from "@/features/sales/schemas";

export async function listSalesOrders(query: OrderListQuery) {
  const ctx = await requirePermission("sales.read");
  const db = await createSupabaseServerClient();
  return salesRepository(db).listOrders(ctx.business.businessId, query);
}

export async function getSalesSummary(range?: { from?: string; to?: string }) {
  const ctx = await requirePermission("sales.read");
  const db = await createSupabaseServerClient();
  return salesRepository(db).salesSummary(ctx.business.businessId, range);
}

export async function getSalesOrder(id: string) {
  const ctx = await requirePermission("sales.read");
  const db = await createSupabaseServerClient();
  const o = await salesRepository(db).getOrder(ctx.business.businessId, id);
  if (!o) throw Errors.notFound("Sales order");
  return o;
}

export async function getOrderFormOptions() {
  const ctx = await requirePermission("sales.read");
  const db = await createSupabaseServerClient();
  const repo = salesRepository(db);
  const [customers, channels, variants, locations, settings] = await Promise.all([
    masterDataRepository(db, "customers").listActive(ctx.business.businessId),
    masterDataRepository(db, "sales_channels").listActive(ctx.business.businessId),
    repo.variantAvailability(ctx.business.businessId),
    masterDataRepository(db, "inventory_locations").listActive(ctx.business.businessId),
    settingsRepository(db).getByBusiness(ctx.business.businessId),
  ]);
  return {
    customers: customers.map((c) => ({ id: c.id, name: c.name, customer_type: c.customer_type })),
    channels: channels.map((c) => ({ id: c.id, name: c.name, channel_type: c.channel_type })),
    variants: variants.map((v) => ({
      id: v.variant_id,
      label: `${v.product_name} — ${v.variant_name} (${v.sku})`,
      selling_price: v.selling_price,
      wholesale_price: v.wholesale_price,
      available: v.available ?? 0,
    })),
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    defaultLocationId: settings.default_location_id,
  };
}

function toOrderArgs(values: ReturnType<typeof validate<typeof salesOrderSchema>>) {
  return {
    customerId: values.customer_id ?? null,
    channelId: values.sales_channel_id,
    priceTier: values.price_tier,
    orderedAt: values.ordered_at,
    dueAt: values.due_at ?? null,
    discount: fromCentavos(toCentavos(values.discount_amount)),
    notes: values.notes ?? null,
    items: values.items.map((i) => ({
      product_variant_id: i.product_variant_id,
      quantity: i.quantity,
      unit_price: fromCentavos(toCentavos(i.unit_price)),
      discount_amount: fromCentavos(toCentavos(i.discount_amount)),
    })),
  };
}

export async function createSalesOrder(input: unknown, idempotencyKey: string) {
  const ctx = await requirePermission("sales.manage");
  const values = validate(salesOrderSchema, input);
  const db = await createSupabaseServerClient();
  return salesRepository(db).createOrder({
    businessId: ctx.business.businessId,
    ...toOrderArgs(values),
    idempotencyKey,
  });
}

export async function updateSalesOrderDraft(id: string, input: unknown) {
  await requirePermission("sales.manage");
  const values = validate(salesOrderSchema, input);
  const db = await createSupabaseServerClient();
  return salesRepository(db).updateOrderDraft({ orderId: id, ...toOrderArgs(values) });
}

export async function confirmSalesOrder(id: string, reserve = true) {
  await requirePermission("sales.manage");
  const db = await createSupabaseServerClient();
  await salesRepository(db).confirm(id, reserve);
}

export async function cancelSalesOrder(id: string, input: unknown) {
  await requirePermission("sales.manage");
  const values = validate(cancelOrderSchema, input);
  const db = await createSupabaseServerClient();
  await salesRepository(db).cancel(id, values.reason);
}

export async function deleteDraftSalesOrder(id: string) {
  const ctx = await requirePermission("sales.manage");
  const db = await createSupabaseServerClient();
  await salesRepository(db).deleteDraft(ctx.business.businessId, id);
}

export async function getFulfillmentOptions(orderId: string) {
  const ctx = await requirePermission("sales.manage");
  const db = await createSupabaseServerClient();
  const repo = salesRepository(db);
  const order = await repo.getOrder(ctx.business.businessId, orderId);
  if (!order) throw Errors.notFound("Sales order");
  const lotsByItem = await Promise.all(
    (order.detail.sales_order_items ?? []).map(async (i) => ({
      orderItemId: i.id,
      lots: await repo.lotsForVariant(ctx.business.businessId, i.product_variant_id),
    })),
  );
  const locations = await masterDataRepository(db, "inventory_locations").listActive(
    ctx.business.businessId,
  );
  return { order, lotsByItem, locations: locations.map((l) => ({ id: l.id, name: l.name })) };
}

export async function fulfillSalesOrder(id: string, input: unknown, idempotencyKey: string) {
  await requirePermission("sales.manage");
  const values = validate(fulfillmentSchema, input);
  const db = await createSupabaseServerClient();
  return salesRepository(db).fulfill({
    orderId: id,
    locationId: values.location_id ?? null,
    fulfilledAt: values.fulfilled_at,
    items: values.items.filter((i) => i.quantity > 0),
    notes: values.notes ?? null,
    idempotencyKey,
  });
}

export async function recordPayment(orderId: string, input: unknown, idempotencyKey: string) {
  await requirePermission("sales.manage");
  const values = validate(paymentSchema, input);
  const db = await createSupabaseServerClient();
  return salesRepository(db).recordPayment({
    orderId,
    amount: fromCentavos(toCentavos(values.amount)),
    method: values.payment_method,
    reference: values.payment_reference ?? null,
    receivedAt: values.received_at,
    notes: values.notes ?? null,
    idempotencyKey,
  });
}

export async function issueRefund(input: unknown, idempotencyKey: string) {
  await requirePermission("sales.manage");
  const values = validate(refundSchema, input);
  const db = await createSupabaseServerClient();
  return salesRepository(db).issueRefund({
    paymentId: values.payment_id,
    amount: fromCentavos(toCentavos(values.amount)),
    reason: values.reason,
    method: values.refund_method,
    idempotencyKey,
  });
}

export async function createSalesReturn(orderId: string, input: unknown, idempotencyKey: string) {
  await requirePermission("sales.manage");
  const values = validate(returnSchema, input);
  const items = values.items.filter((i) => i.quantity > 0);
  if (items.length === 0)
    throw Errors.validation("Enter a quantity for at least one line.", {
      items: ["Enter a quantity"],
    });
  const db = await createSupabaseServerClient();
  return salesRepository(db).createReturn({
    orderId,
    locationId: values.location_id ?? null,
    reason: values.reason,
    receivedAt: values.received_at,
    notes: values.notes ?? null,
    items,
    idempotencyKey,
  });
}

export async function listCustomers(q: {
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}) {
  const ctx = await requirePermission("customers.read");
  const db = await createSupabaseServerClient();
  return salesRepository(db).customers(ctx.business.businessId, q);
}

export async function getCustomer(id: string) {
  const ctx = await requirePermission("customers.read");
  const db = await createSupabaseServerClient();
  const repo = salesRepository(db);
  const customer = await repo.customer(ctx.business.businessId, id);
  if (!customer) throw Errors.notFound("Customer");
  const orders = await repo.listOrders(ctx.business.businessId, {
    customer: id,
    page: 1,
    pageSize: 50,
    sort: "ordered_at",
    dir: "desc",
  });
  return { customer, orders };
}

export async function listSalesHistory(q: {
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}) {
  const ctx = await requirePermission("sales.read");
  const db = await createSupabaseServerClient();
  return salesRepository(db).salesHistory(ctx.business.businessId, q);
}
