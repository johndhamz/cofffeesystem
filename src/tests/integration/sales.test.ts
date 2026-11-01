import { beforeAll, describe, expect, it } from "vitest";
import type { Json } from "@/types/database";
import {
  businessIdFor,
  createConfirmedPurchase,
  createMasterFixtures,
  createReceipt,
  lotsForReceipt,
  postReceipt,
  SEED,
  uniq,
  userClient,
  type Db,
} from "./helpers";

let owner: Db;
let sales: Db;
let viewer: Db;
let other: Db;
let businessId: string;
let roasterId: string;
let locationId: string;
let channelId: string;

beforeAll(async () => {
  [owner, sales, viewer, other] = await Promise.all([
    userClient(SEED.owner),
    userClient(SEED.sales),
    userClient(SEED.viewer),
    userClient(SEED.otherOwner),
  ]);
  businessId = await businessIdFor(owner);
  roasterId = (
    await owner
      .from("roasters")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", "Yoshan DY-2kg")
      .single()
  ).data!.id;
  locationId = (
    await owner
      .from("inventory_locations")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .limit(1)
      .single()
  ).data!.id;
  channelId = (
    await owner
      .from("sales_channels")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", "Walk-in")
      .single()
  ).data!.id;
});

/** Five 250 g bags from a 1260 g roast: lot unit cost ₱159.866 (coffee ₱709.33 + bags ₱40 + labor ₱50 = ₱799.33 / 5). */
async function fiveBags(units = 5, price = 350) {
  const fx = await createMasterFixtures(owner, businessId);
  const po = await createConfirmedPurchase(owner, businessId, {
    supplierId: fx.supplier.id,
    coffeeId: fx.coffee.id,
    grams: 10_000,
    unitCost: "450",
  });
  const rid = await createReceipt(owner, {
    poId: po.poId,
    locationId,
    items: [{ purchase_order_item_id: po.items[0].id, received_quantity_g: 10_000 }],
  });
  await postReceipt(owner, rid);
  const [line] = await lotsForReceipt(owner, rid);
  const { data: batchId } = await owner.rpc("create_roast_batch", {
    p_business_id: businessId,
    p_roaster_id: roasterId,
    p_roast_profile_id: null as unknown as string,
    p_location_id: locationId,
    p_roast_date: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: [{ green_lot_id: line.green_lot_id, input_weight_g: 1500 }] as unknown as Json,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("rb"),
  });
  await owner.rpc("complete_roast_batch", {
    p_batch_id: batchId!,
    p_roasted_weight_g: 1260,
    p_roast_level: "medium",
    p_total_duration_seconds: 600,
    p_first_crack_seconds: 480,
    p_charge_bt_c: null as unknown as number,
    p_charge_et_c: null as unknown as number,
    p_first_crack_bt_c: null as unknown as number,
    p_drop_bt_c: null as unknown as number,
    p_costs: [{ cost_type: "lpg", amount: "40" }] as unknown as Json,
    p_notes: null as unknown as string,
  });
  const { data: product } = await owner
    .from("products")
    .insert({ business_id: businessId, name: uniq("Product") })
    .select("id")
    .single();
  const { data: variant } = await owner
    .from("product_variants")
    .insert({
      business_id: businessId,
      product_id: product!.id,
      sku: uniq("SKU").replace(/\s/g, "-"),
      name: "250 g bag",
      net_weight_g: 250,
      selling_price: price,
      wholesale_price: 300,
    })
    .select("id")
    .single();
  const { data: bag } = await owner
    .from("packaging_materials")
    .insert({ business_id: businessId, name: uniq("Bag"), base_unit: "pc" })
    .select("id")
    .single();
  const { data: bagItem } = await owner
    .from("inventory_items")
    .select("id")
    .eq("item_type", "packaging_material")
    .eq("reference_id", bag!.id)
    .single();
  await owner.rpc("create_inventory_adjustment", {
    p_business_id: businessId,
    p_reason: "count_correction",
    p_notes: null as unknown as string,
    p_lines: [
      {
        inventory_item_id: bagItem!.id,
        location_id: locationId,
        quantity_delta: 100,
        unit_cost: "8",
        notes: null,
      },
    ] as unknown as Json,
    p_idempotency_key: uniq("adj"),
    p_post: true,
  });
  const { data: sid, error } = await owner.rpc("create_packaging_session", {
    p_business_id: businessId,
    p_location_id: locationId,
    p_packaged_at: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: [{ roast_batch_id: batchId, input_weight_g: units * 250 }] as unknown as Json,
    p_outputs: [{ variant_id: variant!.id, quantity: units }] as unknown as Json,
    p_materials: [{ material_id: bag!.id, quantity: units }] as unknown as Json,
    p_labor_cost: 50,
    p_overhead_cost: 0,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("pk"),
  });
  if (error) throw error;
  const { error: cErr } = await owner.rpc("complete_packaging_session", { p_session_id: sid! });
  if (cErr) throw cErr;
  const { data: lot } = await owner
    .from("finished_goods_inventory_view")
    .select("lot_id, inventory_item_id, unit_cost")
    .eq("packaging_session_id", sid!)
    .single();
  return {
    variantId: variant!.id,
    lotId: lot!.lot_id,
    itemId: lot!.inventory_item_id!,
    unitCost: lot!.unit_cost,
  };
}

async function customer(type: "retail" | "wholesale" = "retail") {
  const { data } = await owner
    .from("customers")
    .insert({
      business_id: businessId,
      name: uniq("Customer"),
      customer_type: type,
      payment_terms_days: type === "wholesale" ? 30 : 0,
    })
    .select("id")
    .single();
  return data!.id;
}

function createOrder(
  db: Db,
  args: {
    customerId?: string | null;
    items: {
      product_variant_id: string;
      quantity: number;
      unit_price: string;
      discount_amount?: string;
    }[];
    discount?: number;
    key?: string;
    tier?: string;
  },
) {
  return db.rpc("create_sales_order", {
    p_business_id: businessId,
    p_customer_id: (args.customerId ?? null) as string,
    p_sales_channel_id: channelId,
    p_price_tier: args.tier ?? "retail",
    p_ordered_at: "2026-11-01",
    p_due_at: null as unknown as string,
    p_discount_amount: args.discount ?? 0,
    p_notes: null as unknown as string,
    p_items: args.items.map((i) => ({
      ...i,
      discount_amount: i.discount_amount ?? "0",
    })) as unknown as Json,
    p_idempotency_key: args.key ?? uniq("so"),
  });
}

async function balance(itemId: string) {
  const { data } = await owner
    .from("inventory_balances")
    .select("on_hand_quantity, reserved_quantity")
    .eq("inventory_item_id", itemId);
  return (data ?? []).reduce(
    (a, r) => ({
      on_hand: a.on_hand + r.on_hand_quantity,
      reserved: a.reserved + r.reserved_quantity,
    }),
    { on_hand: 0, reserved: 0 },
  );
}

async function order(id: string) {
  const { data } = await owner.from("sales_order_summary_view").select("*").eq("id", id).single();
  return data!;
}

const fulfil = (db: Db, orderId: string, key = uniq("sf"), items: unknown[] | null = null) =>
  db.rpc("fulfill_sales_order", {
    p_order_id: orderId,
    p_location_id: null as unknown as string,
    p_fulfilled_at: "2026-11-01",
    p_items: items as unknown as Json,
    p_notes: null as unknown as string,
    p_idempotency_key: key,
  });
const pay = (
  db: Db,
  orderId: string,
  amount: number,
  ref: string | null = null,
  key = uniq("pay"),
) =>
  db.rpc("record_payment", {
    p_order_id: orderId,
    p_amount: amount,
    p_method: "gcash",
    p_reference: ref as string,
    p_received_at: "2026-11-01",
    p_notes: null as unknown as string,
    p_idempotency_key: key,
  });

describe("sales workflow", () => {
  it("three of five bags: confirm reserves, fulfil deducts once with cost snapshot, payment marks paid and completes", async () => {
    const fg = await fiveBags();
    const cid = await customer();
    const { data: oid, error } = await createOrder(owner, {
      customerId: cid,
      items: [{ product_variant_id: fg.variantId, quantity: 3, unit_price: "350" }],
    });
    expect(error).toBeNull();
    expect(await order(oid!)).toMatchObject({
      status: "draft",
      payment_status: "unpaid",
      subtotal: 1050,
      total_amount: 1050,
      outstanding_amount: 1050,
    });
    expect(await balance(fg.itemId)).toEqual({ on_hand: 5, reserved: 0 });

    expect(
      (await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true })).error,
    ).toBeNull();
    expect((await order(oid!)).status).toBe("reserved");
    expect(await balance(fg.itemId)).toEqual({ on_hand: 5, reserved: 3 });
    const { data: alloc } = await owner
      .from("sales_order_allocations")
      .select("finished_goods_lot_id, quantity")
      .eq("business_id", businessId);
    expect(alloc?.some((a) => a.finished_goods_lot_id === fg.lotId && a.quantity === 3)).toBe(true);
    // a second order cannot take the reserved units
    const { data: oid2 } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 3, unit_price: "350" }],
    });
    expect(
      (await owner.rpc("confirm_sales_order", { p_order_id: oid2!, p_reserve: true })).error
        ?.message,
    ).toMatch(/INSUFFICIENT_STOCK/);

    const { data: fid, error: fErr } = await fulfil(owner, oid!);
    expect(fErr).toBeNull();
    expect(await balance(fg.itemId)).toEqual({ on_hand: 2, reserved: 0 });
    const o = await order(oid!);
    expect(o).toMatchObject({ status: "fulfilled", fulfilled_units: 3, total_cogs: 479.6 }); // 3 × ₱159.866 = ₱479.60
    const { data: fi } = await owner
      .from("sales_fulfillment_items")
      .select("unit_cost_snapshot, total_cost, unit_price_snapshot, quantity")
      .eq("fulfillment_id", fid!)
      .single();
    expect(fi).toMatchObject({
      quantity: 3,
      unit_cost_snapshot: 159.866667,
      total_cost: 479.6,
      unit_price_snapshot: 350,
    });
    // payment
    expect((await pay(owner, oid!, 500, "GC-1")).error).toBeNull();
    expect(await order(oid!)).toMatchObject({
      payment_status: "partially_paid",
      amount_paid: 500,
      outstanding_amount: 550,
      status: "fulfilled",
    });
    expect((await pay(owner, oid!, 550, "GC-2")).error).toBeNull();
    expect(await order(oid!)).toMatchObject({
      payment_status: "paid",
      amount_paid: 1050,
      outstanding_amount: 0,
      status: "completed",
    });
    // customer history
    const { data: cs } = await owner
      .from("customer_summary_view")
      .select("orders, revenue, outstanding")
      .eq("id", cid)
      .single();
    expect(cs).toMatchObject({ orders: 1, revenue: 1050, outstanding: 0 }); // oid2 had no customer
    const { data: recon } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(recon).toEqual([]);
  });

  it("supports partial fulfilment, blocks over-fulfilment, and duplicate/concurrent fulfilments deduct once", async () => {
    const fg = await fiveBags();
    const { data: oid } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 4, unit_price: "350" }],
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    const { data: items } = await owner.from("sales_order_items").select("id").eq("order_id", oid!);
    const key = uniq("sf");
    const partial = [{ order_item_id: items![0].id, finished_goods_lot_id: fg.lotId, quantity: 1 }];
    const results = await Promise.all(
      Array.from({ length: 5 }, () => fulfil(owner, oid!, key, partial)),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(new Set(results.map((r) => r.data)).size).toBe(1);
    expect(await balance(fg.itemId)).toEqual({ on_hand: 4, reserved: 3 });
    expect((await order(oid!)).status).toBe("partially_fulfilled");
    expect(
      (
        await fulfil(owner, oid!, uniq("sf"), [
          { order_item_id: items![0].id, finished_goods_lot_id: fg.lotId, quantity: 4 },
        ])
      ).error?.message,
    ).toMatch(/exceed the ordered quantity/);
    expect((await fulfil(owner, oid!)).error).toBeNull(); // rest from reservation
    expect(await balance(fg.itemId)).toEqual({ on_hand: 1, reserved: 0 });
    expect((await order(oid!)).status).toBe("fulfilled");
  });

  it("concurrent confirmations cannot oversell", async () => {
    const fg = await fiveBags();
    const orders = await Promise.all(
      Array.from({ length: 4 }, () =>
        createOrder(owner, {
          items: [{ product_variant_id: fg.variantId, quantity: 2, unit_price: "350" }],
        }),
      ),
    );
    const results = await Promise.all(
      orders.map((o) => owner.rpc("confirm_sales_order", { p_order_id: o.data!, p_reserve: true })),
    );
    expect(results.filter((r) => r.error === null)).toHaveLength(2);
    expect(results.filter((r) => r.error?.message.includes("INSUFFICIENT_STOCK"))).toHaveLength(2);
    expect(await balance(fg.itemId)).toEqual({ on_hand: 5, reserved: 4 });
  });

  it("cancellation releases reservations and is blocked after fulfilment or while paid", async () => {
    const fg = await fiveBags();
    const { data: oid } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 2, unit_price: "350" }],
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    await pay(owner, oid!, 100);
    expect(
      (await owner.rpc("cancel_sales_order", { p_order_id: oid!, p_reason: "changed mind" })).error
        ?.message,
    ).toMatch(/refund/);
    const { data: p } = await owner.from("payments").select("id").eq("order_id", oid!).single();
    await owner.rpc("issue_refund", {
      p_payment_id: p!.id,
      p_amount: 100,
      p_reason: "cancelled",
      p_method: "gcash",
      p_idempotency_key: uniq("rf"),
    });
    expect(
      (await owner.rpc("cancel_sales_order", { p_order_id: oid!, p_reason: "changed mind" })).error,
    ).toBeNull();
    expect(await balance(fg.itemId)).toEqual({ on_hand: 5, reserved: 0 });
    expect(await order(oid!)).toMatchObject({ status: "cancelled", payment_status: "refunded" });
    const { data: oid2 } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 1, unit_price: "350" }],
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid2!, p_reserve: true });
    await fulfil(owner, oid2!);
    expect(
      (await owner.rpc("cancel_sales_order", { p_order_id: oid2!, p_reason: "x" })).error?.message,
    ).toMatch(/return/);
  });

  it("payments are idempotent, cannot exceed the balance, and reject duplicate references", async () => {
    const fg = await fiveBags();
    const { data: oid } = await createOrder(owner, {
      items: [
        { product_variant_id: fg.variantId, quantity: 2, unit_price: "350", discount_amount: "50" },
      ],
      discount: 50,
    });
    expect(await order(oid!)).toMatchObject({ subtotal: 700, total_amount: 600 });
    expect((await pay(owner, oid!, 100)).error?.message).toMatch(/confirm the order/);
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    const key = uniq("pay");
    const a = await pay(owner, oid!, 200, "REF-1", key);
    const b = await pay(owner, oid!, 200, "REF-1", key);
    expect(a.data).toBe(b.data);
    expect((await order(oid!)).amount_paid).toBe(200);
    expect((await pay(owner, oid!, 200, "ref-1")).error?.message).toMatch(/already recorded/);
    expect((await pay(owner, oid!, 500)).error?.message).toMatch(/exceeds the outstanding/);
    expect((await pay(owner, oid!, 0)).error?.message).toMatch(/greater than zero/);
    expect((await pay(owner, oid!, 400)).error).toBeNull();
    expect(await order(oid!)).toMatchObject({
      payment_status: "paid",
      outstanding_amount: 0,
      status: "reserved",
    }); // not completed: not fulfilled yet
    // direct writes to payments are rejected
    expect(
      (
        await owner.from("payments").insert({
          business_id: businessId,
          order_id: oid!,
          amount: 1,
          payment_method: "cash",
          idempotency_key: uniq("x"),
        })
      ).error?.code,
    ).toBe("42501");
  });

  it("refunds are limited to the payment, idempotent, and do not touch stock or revenue", async () => {
    const fg = await fiveBags();
    const { data: oid } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 1, unit_price: "350" }],
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    await fulfil(owner, oid!);
    const { data: pid } = await pay(owner, oid!, 350);
    const key = uniq("rf");
    const r1 = await owner.rpc("issue_refund", {
      p_payment_id: pid!,
      p_amount: 100,
      p_reason: "goodwill",
      p_method: "gcash",
      p_idempotency_key: key,
    });
    const r2 = await owner.rpc("issue_refund", {
      p_payment_id: pid!,
      p_amount: 100,
      p_reason: "goodwill",
      p_method: "gcash",
      p_idempotency_key: key,
    });
    expect(r1.data).toBe(r2.data);
    expect(await order(oid!)).toMatchObject({
      payment_status: "partially_refunded",
      amount_refunded: 100,
      outstanding_amount: 100,
      total_amount: 350,
    });
    expect(
      (
        await owner.rpc("issue_refund", {
          p_payment_id: pid!,
          p_amount: 300,
          p_reason: "too much",
          p_method: "cash",
          p_idempotency_key: uniq("rf"),
        })
      ).error?.message,
    ).toMatch(/exceeds the refundable/);
    expect(await balance(fg.itemId)).toEqual({ on_hand: 4, reserved: 0 });
  });

  it("returns: only sealed+restock re-enters sellable stock; COGS snapshot is preserved", async () => {
    const fg = await fiveBags();
    const { data: oid } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 3, unit_price: "350" }],
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    const { data: fid } = await fulfil(owner, oid!);
    const { data: fi } = await owner
      .from("sales_fulfillment_items")
      .select("id, unit_cost_snapshot, total_cost")
      .eq("fulfillment_id", fid!)
      .single();
    const before = { ...fi! };
    const key = uniq("sr");
    const mk = (items: unknown[]) =>
      owner.rpc("create_sales_return", {
        p_order_id: oid!,
        p_location_id: null as unknown as string,
        p_reason: "customer changed mind",
        p_received_at: "2026-11-02",
        p_notes: null as unknown as string,
        p_items: items as unknown as Json,
        p_idempotency_key: key,
      });
    expect(
      (
        await mk([
          { fulfillment_item_id: fi!.id, quantity: 1, condition: "opened", disposition: "restock" },
        ])
      ).error?.message,
    ).toMatch(/only sealed/);
    const r = await mk([
      { fulfillment_item_id: fi!.id, quantity: 1, condition: "sealed", disposition: "restock" },
      { fulfillment_item_id: fi!.id, quantity: 1, condition: "damaged", disposition: "waste" },
    ]);
    expect(r.error).toBeNull();
    expect(
      (
        await mk([
          { fulfillment_item_id: fi!.id, quantity: 1, condition: "sealed", disposition: "restock" },
        ])
      ).data,
    ).toBe(r.data); // idempotent
    expect(await balance(fg.itemId)).toEqual({ on_hand: 3, reserved: 0 }); // 5 − 3 + 1 restocked
    const { data: ret } = await owner
      .from("sales_return_items")
      .select("disposition, unit_cost_snapshot")
      .eq("return_id", r.data!)
      .order("disposition");
    expect(ret).toEqual([
      { disposition: "restock", unit_cost_snapshot: 159.866667 },
      { disposition: "waste", unit_cost_snapshot: 159.866667 },
    ]);
    expect(
      (
        await mk([
          { fulfillment_item_id: fi!.id, quantity: 2, condition: "sealed", disposition: "restock" },
        ])
      ).data,
    ).toBe(r.data);
    const { error: over } = await owner.rpc("create_sales_return", {
      p_order_id: oid!,
      p_location_id: null as unknown as string,
      p_reason: "x",
      p_received_at: "2026-11-02",
      p_notes: null as unknown as string,
      p_items: [
        { fulfillment_item_id: fi!.id, quantity: 2, condition: "sealed", disposition: "restock" },
      ] as unknown as Json,
      p_idempotency_key: uniq("sr"),
    });
    expect(over?.message).toMatch(/exceed/);
    const { data: after } = await owner
      .from("sales_fulfillment_items")
      .select("id, unit_cost_snapshot, total_cost, returned_quantity")
      .eq("id", fi!.id)
      .single();
    expect(after).toMatchObject({
      unit_cost_snapshot: before.unit_cost_snapshot,
      total_cost: before.total_cost,
      returned_quantity: 2,
    });
    expect((await order(oid!)).returned_units).toBe(2);
    const { data: layer } = await owner
      .from("inventory_cost_layers")
      .select("received_quantity, original_cost")
      .eq("inventory_item_id", fg.itemId)
      .eq("source_type", "sales_return_item")
      .single();
    expect(layer).toMatchObject({ received_quantity: 1, original_cost: 159.87 });
    const { data: recon } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(recon).toEqual([]);
  });

  it("historical COGS and prices stay unchanged when variant prices or later batches change", async () => {
    const fg = await fiveBags();
    const { data: oid } = await createOrder(owner, {
      items: [{ product_variant_id: fg.variantId, quantity: 2, unit_price: "350" }],
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    const { data: fid } = await fulfil(owner, oid!);
    await owner.from("product_variants").update({ selling_price: 999 }).eq("id", fg.variantId);
    await owner
      .from("finished_goods_lots")
      .update({ best_before_at: "2027-01-01" })
      .eq("id", fg.lotId);
    const { data: fi } = await owner
      .from("sales_fulfillment_items")
      .select("unit_price_snapshot, unit_cost_snapshot")
      .eq("fulfillment_id", fid!)
      .single();
    // 2 units: consumed cost round(799.33 × 2/5, 2) = ₱319.73 → ₱159.865 per unit
    expect(fi).toMatchObject({ unit_price_snapshot: 350, unit_cost_snapshot: 159.865 });
    expect((await order(oid!)).total_amount).toBe(700);
    // no RLS update policy on order items: direct writes affect zero rows
    expect(
      (
        await owner
          .from("sales_order_items")
          .update({ unit_price: 1 })
          .eq("order_id", oid!)
          .select("id")
      ).data,
    ).toEqual([]);
    expect(
      (await owner.from("sales_orders").update({ total_amount: 1 }).eq("id", oid!)).error?.message,
    ).toMatch(/sales functions/);
  });

  it("wholesale tier, roles and business isolation", async () => {
    const fg = await fiveBags();
    const cid = await customer("wholesale");
    const { data: oid } = await createOrder(sales, {
      customerId: cid,
      items: [{ product_variant_id: fg.variantId, quantity: 1, unit_price: "300" }],
      tier: "wholesale",
    });
    expect(oid).toBeTruthy(); // sales_staff can sell
    expect((await order(oid!)).price_tier).toBe("wholesale");
    expect(
      (
        await createOrder(viewer, {
          items: [{ product_variant_id: fg.variantId, quantity: 1, unit_price: "300" }],
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    expect(
      (await viewer.from("sales_order_summary_view").select("id").eq("id", oid!)).data,
    ).toHaveLength(1);
    expect((await other.from("sales_orders").select("id").eq("id", oid!)).data).toEqual([]);
    expect(
      (await other.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true })).error
        ?.message,
    ).toMatch(/FORBIDDEN/);
    expect(
      (await viewer.from("customers").insert({ business_id: businessId, name: uniq("C") })).error
        ?.code,
    ).toBe("42501");
    expect(
      (await sales.from("customers").insert({ business_id: businessId, name: uniq("C") })).error,
    ).toBeNull();
  });
});
