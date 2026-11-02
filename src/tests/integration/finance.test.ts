import { beforeAll, describe, expect, it } from "vitest";
import type { Json } from "@/types/database";
import {
  businessIdFor,
  createConfirmedPurchase,
  createMasterFixtures,
  createReceipt,
  fetchAll,
  lotsForReceipt,
  postReceipt,
  SEED,
  uniq,
  userClient,
  type Db,
} from "./helpers";

let owner: Db;
let viewer: Db;
let sales: Db;
let other: Db;
let businessId: string;
let roasterId: string;
let locationId: string;
let channelId: string;
let categoryId: string;

const DAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // today in Manila

beforeAll(async () => {
  [owner, viewer, sales, other] = await Promise.all([
    userClient(SEED.owner),
    userClient(SEED.viewer),
    userClient(SEED.sales),
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
  categoryId = (
    await owner
      .from("expense_categories")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", "Fuel & Gas")
      .single()
  ).data!.id;
});

/** Full chain: 10 kg green @ ₱450 → 1.5 kg roast (₱40 LPG) → 5 × 250 g bags (₱8 bag, ₱50 labor) → sell N @ ₱350. */
async function soldBags(qty: number, opts: { day?: string; discount?: number } = {}) {
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
    p_roast_date: opts.day ?? DAY,
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
      selling_price: 350,
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
  const { data: sid } = await owner.rpc("create_packaging_session", {
    p_business_id: businessId,
    p_location_id: locationId,
    p_packaged_at: opts.day ?? DAY,
    p_operator_id: null as unknown as string,
    p_inputs: [{ roast_batch_id: batchId, input_weight_g: 1250 }] as unknown as Json,
    p_outputs: [{ variant_id: variant!.id, quantity: 5 }] as unknown as Json,
    p_materials: [{ material_id: bag!.id, quantity: 5 }] as unknown as Json,
    p_labor_cost: 50,
    p_overhead_cost: 0,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("pk"),
  });
  await owner.rpc("complete_packaging_session", { p_session_id: sid! });
  const { data: oid } = await owner.rpc("create_sales_order", {
    p_business_id: businessId,
    p_customer_id: null as unknown as string,
    p_sales_channel_id: channelId,
    p_price_tier: "retail",
    p_ordered_at: opts.day ?? DAY,
    p_due_at: null as unknown as string,
    p_discount_amount: opts.discount ?? 0,
    p_notes: null as unknown as string,
    p_items: [
      { product_variant_id: variant!.id, quantity: qty, unit_price: "350", discount_amount: "0" },
    ] as unknown as Json,
    p_idempotency_key: uniq("so"),
  });
  await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
  const { data: fid } = await owner.rpc("fulfill_sales_order", {
    p_order_id: oid!,
    p_location_id: null as unknown as string,
    p_fulfilled_at: opts.day ?? DAY,
    p_items: null as unknown as Json,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("sf"),
  });
  return {
    orderId: oid!,
    fulfillmentId: fid!,
    batchId: batchId!,
    sessionId: sid!,
    variantId: variant!.id,
    coffee: fx.coffee,
  };
}

async function profit(db: Db, from = DAY, to = DAY) {
  const { data, error } = await db.rpc("report_profitability", {
    p_business_id: businessId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data![0];
}

async function expense(amount: string, treatment: string, day = DAY) {
  const { data, error } = await owner
    .from("expenses")
    .insert({
      business_id: businessId,
      expense_category_id: categoryId,
      amount: Number(amount),
      incurred_at: day,
      description: uniq("expense"),
      cost_treatment: treatment,
      idempotency_key: uniq("exp"),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

describe("finance & reporting", () => {
  it("sales report reconciles to source fulfilment lines and COGS snapshots", async () => {
    const before = await profit(owner);
    const s = await soldBags(3); // revenue ₱1,050; COGS 3 × ₱159.866667 = ₱479.60 (session ₱799.33 / 5)
    const { data: line } = await owner
      .from("report_sales_lines_view")
      .select("*")
      .eq("order_id", s.orderId)
      .single();
    expect(line).toMatchObject({
      net_units: 3,
      net_revenue: 1050,
      cogs: 479.6,
      unit_price_snapshot: 350,
    });
    expect(line?.origins).toBe("Philippines");
    const after = await profit(owner);
    expect(Math.round((after.net_sales - before.net_sales) * 100)).toBe(105_000);
    expect(Math.round((after.cogs - before.cogs) * 100)).toBe(47_960);
    expect(Math.round((after.gross_profit - before.gross_profit) * 100)).toBe(57_040);
    // source of truth: fulfilment item snapshot
    const { data: fi } = await owner
      .from("sales_fulfillment_items")
      .select("total_cost, unit_price_snapshot, quantity")
      .eq("fulfillment_id", s.fulfillmentId)
      .single();
    expect(fi!.total_cost).toBe(line!.cogs);
    expect(fi!.quantity * fi!.unit_price_snapshot!).toBe(line!.net_revenue);
  });

  it("production cost inheritance flows green → roast → packaging → COGS", async () => {
    const s = await soldBags(5);
    const { data: batch } = await owner
      .from("roast_batches")
      .select("green_cost, production_cost_total, roasted_cost_per_g")
      .eq("id", s.batchId)
      .single();
    expect(batch).toMatchObject({ green_cost: 675, production_cost_total: 715 }); // ₱0.45/g × 1500 + ₱40 LPG
    const { data: session } = await owner
      .from("packaging_sessions")
      .select("coffee_cost, material_cost, total_cost")
      .eq("id", s.sessionId)
      .single();
    expect(session).toMatchObject({ coffee_cost: 709.33, material_cost: 40, total_cost: 799.33 }); // 715 × 1250/1260 + 5 × ₱8 + ₱50 labor
    const { data: lines } = await owner
      .from("report_sales_lines_view")
      .select("cogs, net_units")
      .eq("order_id", s.orderId);
    expect(lines![0]).toMatchObject({ net_units: 5, cogs: 799.33 }); // selling all five returns the full session cost
  });

  it("classifies expenses once: operating treatments only; voided excluded; allocations bounded", async () => {
    const before = await profit(owner);
    await expense("40", "roast_production"); // LPG already in batch cost → not opex
    await expense("500", "administrative");
    await expense("25.50", "selling");
    const cap = await expense("10000", "capital");
    const voided = await expense("999", "other_operating");
    await owner
      .from("expenses")
      .update({ is_voided: true, void_reason: "dup" })
      .eq("id", voided.id);
    const after = await profit(owner);
    expect(Math.round((after.operating_expenses - before.operating_expenses) * 100)).toBe(52_550);
    expect(Math.round((after.operating_result - before.operating_result) * 100)).toBe(-52_550);
    const { data: cats } = await owner.rpc("report_expenses_by_category", {
      p_business_id: businessId,
      p_from: DAY,
      p_to: DAY,
    });
    const fuel = cats!.filter((c) => c.category === "Fuel & Gas");
    expect(fuel.reduce((a, c) => a + c.amount, 0)).toBeGreaterThanOrEqual(10_565.5);
    expect(fuel.find((c) => c.cost_treatment === "capital")?.operating_amount).toBe(0);
    // allocation bound
    const s = await soldBags(1);
    const lpg = await expense("40", "roast_production");
    expect(
      (
        await owner.from("cost_allocations").insert({
          business_id: businessId,
          expense_id: lpg.id,
          source_id: lpg.id,
          target_type: "roast_batch",
          target_id: s.batchId,
          amount: 30,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner.from("cost_allocations").insert({
          business_id: businessId,
          expense_id: lpg.id,
          source_id: lpg.id,
          target_type: "packaging_session",
          target_id: s.sessionId,
          amount: 20,
        })
      ).error?.message,
    ).toMatch(/exceed/);
    expect(
      (
        await owner.from("cost_allocations").insert({
          business_id: businessId,
          expense_id: cap.id,
          source_id: cap.id,
          target_type: "roast_batch",
          target_id: "00000000-0000-4000-8000-000000000000",
          amount: 1,
        })
      ).error,
    ).not.toBeNull();
    const { data: ev } = await owner
      .from("report_expenses_view")
      .select("allocated_amount, unallocated_amount, operating_amount")
      .eq("id", lpg.id)
      .single();
    expect(ev).toMatchObject({ allocated_amount: 30, unallocated_amount: 10, operating_amount: 0 });
  });

  it("refunds do not change net sales; restocked returns credit COGS and revenue; waste keeps COGS", async () => {
    const s = await soldBags(4);
    const before = await profit(owner);
    const { data: pid } = await owner.rpc("record_payment", {
      p_order_id: s.orderId,
      p_amount: 1400,
      p_method: "cash",
      p_reference: null as unknown as string,
      p_received_at: DAY,
      p_notes: null as unknown as string,
      p_idempotency_key: uniq("pay"),
    });
    await owner.rpc("issue_refund", {
      p_payment_id: pid!,
      p_amount: 350,
      p_reason: "goodwill",
      p_method: "cash",
      p_idempotency_key: uniq("rf"),
    });
    const afterRefund = await profit(owner);
    expect(afterRefund.net_sales).toBe(before.net_sales);
    expect(Math.round((afterRefund.refunds - before.refunds) * 100)).toBe(35_000);
    const { data: fi } = await owner
      .from("sales_fulfillment_items")
      .select("id")
      .eq("fulfillment_id", s.fulfillmentId)
      .single();
    await owner.rpc("create_sales_return", {
      p_order_id: s.orderId,
      p_location_id: null as unknown as string,
      p_reason: "unopened",
      p_received_at: DAY,
      p_notes: null as unknown as string,
      p_items: [
        { fulfillment_item_id: fi!.id, quantity: 1, condition: "sealed", disposition: "restock" },
        { fulfillment_item_id: fi!.id, quantity: 1, condition: "damaged", disposition: "waste" },
      ] as unknown as Json,
      p_idempotency_key: uniq("sr"),
    });
    const { data: line } = await owner
      .from("report_sales_lines_view")
      .select("net_units, net_revenue, cogs")
      .eq("order_id", s.orderId)
      .single();
    expect(line).toMatchObject({ net_units: 2, net_revenue: 700, cogs: 479.6 }); // COGS for 3 kept units (1 restocked credited)
    const afterReturn = await profit(owner);
    expect(Math.round((before.net_sales - afterReturn.net_sales) * 100)).toBe(70_000);
    expect(Math.round((before.cogs - afterReturn.cogs) * 100)).toBe(15_986); // ₱639.46 (4 units) − ₱479.60 (3 kept): per-unit snapshot ₱159.865
  });

  it("partial fulfilment reports only shipped units and never double counts across pages", async () => {
    const fx = await soldBags(1); // reuse chain for a variant with 4 bags left
    const { data: oid } = await owner.rpc("create_sales_order", {
      p_business_id: businessId,
      p_customer_id: null as unknown as string,
      p_sales_channel_id: channelId,
      p_price_tier: "retail",
      p_ordered_at: DAY,
      p_due_at: null as unknown as string,
      p_discount_amount: 0,
      p_notes: null as unknown as string,
      p_items: [
        { product_variant_id: fx.variantId, quantity: 4, unit_price: "350", discount_amount: "0" },
      ] as unknown as Json,
      p_idempotency_key: uniq("so"),
    });
    await owner.rpc("confirm_sales_order", { p_order_id: oid!, p_reserve: true });
    const { data: items } = await owner.from("sales_order_items").select("id").eq("order_id", oid!);
    const { data: lot } = await owner
      .from("finished_goods_inventory_view")
      .select("lot_id")
      .eq("variant_id", fx.variantId)
      .single();
    const before = await profit(owner);
    await owner.rpc("fulfill_sales_order", {
      p_order_id: oid!,
      p_location_id: null as unknown as string,
      p_fulfilled_at: DAY,
      p_items: [
        { order_item_id: items![0].id, finished_goods_lot_id: lot!.lot_id, quantity: 1 },
      ] as unknown as Json,
      p_notes: null as unknown as string,
      p_idempotency_key: uniq("sf"),
    });
    const mid = await profit(owner);
    expect(Math.round((mid.net_sales - before.net_sales) * 100)).toBe(35_000);
    await owner.rpc("fulfill_sales_order", {
      p_order_id: oid!,
      p_location_id: null as unknown as string,
      p_fulfilled_at: DAY,
      p_items: null as unknown as Json,
      p_notes: null as unknown as string,
      p_idempotency_key: uniq("sf"),
    });
    const after = await profit(owner);
    expect(Math.round((after.net_sales - before.net_sales) * 100)).toBe(140_000);
    const { data: lines } = await owner
      .from("report_sales_lines_view")
      .select("net_units")
      .eq("order_id", oid!);
    expect(lines!.reduce((a, l) => a + (l.net_units ?? 0), 0)).toBe(4);
    // date range consistency: a window excluding the day shows nothing for this order
    const { data: none } = await owner
      .from("report_sales_lines_view")
      .select("id:fulfillment_item_id")
      .eq("order_id", oid!)
      .gte("sold_at", "2026-12-01");
    expect(none).toEqual([]);
  });

  it("historical cost snapshots are immutable even when later costs change", async () => {
    const s = await soldBags(2);
    const { data: before } = await owner
      .from("report_sales_lines_view")
      .select("cogs, net_revenue")
      .eq("order_id", s.orderId)
      .single();
    // later price/cost changes elsewhere
    await owner.from("product_variants").update({ selling_price: 999 }).eq("id", s.variantId);
    await owner
      .from("packaging_materials")
      .update({ standard_unit_cost: 99 })
      .eq("business_id", businessId)
      .eq(
        "name",
        (
          await owner
            .from("packaging_materials")
            .select("name")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()
        ).data!.name,
      );
    await soldBags(1); // new chain at same prices creates new snapshots; old ones untouched
    const { data: after } = await owner
      .from("report_sales_lines_view")
      .select("cogs, net_revenue")
      .eq("order_id", s.orderId)
      .single();
    expect(after).toEqual(before);
    expect(
      (
        await owner
          .from("sales_fulfillment_items")
          .update({ unit_cost_snapshot: 1 })
          .eq("fulfillment_id", s.fulfillmentId)
          .select("id")
      ).data,
    ).toEqual([]);
  });

  it("inventory valuation equals remaining cost layers and dashboard metrics gate finance to owners", async () => {
    const { data: val } = await owner.rpc("report_inventory_valuation", {
      p_business_id: businessId,
    });
    const layers = await fetchAll((f, t) =>
      owner
        .from("inventory_cost_layers")
        .select("remaining_cost")
        .eq("business_id", businessId)
        .order("id")
        .range(f, t),
    );
    const total = (val ?? []).reduce((a, v) => a + v.value, 0);
    expect(Math.round(total * 100)).toBe(
      Math.round(layers.reduce((a, l) => a + l.remaining_cost, 0) * 100),
    );
    const { data: ownerMetrics } = await owner.rpc("dashboard_metrics", {
      p_business_id: businessId,
      p_from: DAY,
      p_to: DAY,
    });
    expect((ownerMetrics as Record<string, unknown>).finance).toBe(true);
    expect(typeof (ownerMetrics as Record<string, unknown>).net_sales).toBe("number");
    const { data: viewerMetrics } = await viewer.rpc("dashboard_metrics", {
      p_business_id: businessId,
      p_from: DAY,
      p_to: DAY,
    });
    expect((viewerMetrics as Record<string, unknown>).finance).toBe(false);
    expect((viewerMetrics as Record<string, unknown>).net_sales).toBeUndefined();
    expect(
      (
        await viewer.rpc("report_profitability", {
          p_business_id: businessId,
          p_from: DAY,
          p_to: DAY,
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    expect(
      (
        await sales.rpc("report_profitability", {
          p_business_id: businessId,
          p_from: DAY,
          p_to: DAY,
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    expect(
      (await other.rpc("dashboard_metrics", { p_business_id: businessId, p_from: DAY, p_to: DAY }))
        .error?.message,
    ).toMatch(/FORBIDDEN/);
    expect(
      (
        await viewer.from("expenses").insert({
          business_id: businessId,
          expense_category_id: categoryId,
          amount: 1,
          description: "x",
          cost_treatment: "selling",
        })
      ).error?.code,
    ).toBe("42501");
    expect(
      (await other.from("report_expenses_view").select("id").eq("business_id", businessId)).data,
    ).toEqual([]);
  });
});
