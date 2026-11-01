import { beforeAll, describe, expect, it } from "vitest";
import type { Json } from "@/types/database";
import {
  adminClient,
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

/**
 * Global inventory invariants, checked over EVERY row in the local database after a mixed
 * concurrent workload. These must hold regardless of what other test files did before.
 */
let owner: Db;
let admin: Db;
let businessId: string;
let roasterId: string;
let locationId: string;
let channelId: string;

beforeAll(async () => {
  owner = await userClient(SEED.owner);
  admin = adminClient();
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

async function chain() {
  const fx = await createMasterFixtures(owner, businessId);
  const po = await createConfirmedPurchase(owner, businessId, {
    supplierId: fx.supplier.id,
    coffeeId: fx.coffee.id,
    grams: 10_000,
    unitCost: "450",
    additionalCosts: "100",
  });
  const rid = await createReceipt(owner, {
    poId: po.poId,
    locationId,
    additionalCosts: "25",
    items: [
      {
        purchase_order_item_id: po.items[0].id,
        received_quantity_g: 10_000,
        allocated_landed_cost: "25",
      },
    ],
  });
  await postReceipt(owner, rid);
  const [line] = await lotsForReceipt(owner, rid);
  const batches = await Promise.all(
    Array.from({ length: 3 }, () =>
      owner.rpc("create_roast_batch", {
        p_business_id: businessId,
        p_roaster_id: roasterId,
        p_roast_profile_id: null as unknown as string,
        p_location_id: locationId,
        p_roast_date: "2026-11-01",
        p_operator_id: null as unknown as string,
        p_inputs: [{ green_lot_id: line.green_lot_id, input_weight_g: 1500 }] as unknown as Json,
        p_notes: null as unknown as string,
        p_idempotency_key: uniq("rb"),
      }),
    ),
  );
  // complete all three concurrently, twice each (duplicates)
  await Promise.all(
    batches.flatMap((b) =>
      [0, 1].map(() =>
        owner.rpc("complete_roast_batch", {
          p_batch_id: b.data!,
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
        }),
      ),
    ),
  );
  const { data: product } = await owner
    .from("products")
    .insert({ business_id: businessId, name: uniq("Inv Product") })
    .select("id")
    .single();
  const { data: variant } = await owner
    .from("product_variants")
    .insert({
      business_id: businessId,
      product_id: product!.id,
      sku: uniq("INV").replace(/\s/g, "-"),
      name: "250 g",
      net_weight_g: 250,
      selling_price: 350,
    })
    .select("id")
    .single();
  const sessions = await Promise.all(
    batches.map((b) =>
      owner.rpc("create_packaging_session", {
        p_business_id: businessId,
        p_location_id: locationId,
        p_packaged_at: "2026-11-01",
        p_operator_id: null as unknown as string,
        p_inputs: [{ roast_batch_id: b.data, input_weight_g: 1250 }] as unknown as Json,
        p_outputs: [{ variant_id: variant!.id, quantity: 5 }] as unknown as Json,
        p_materials: [] as unknown as Json,
        p_labor_cost: 50,
        p_overhead_cost: 0,
        p_notes: null as unknown as string,
        p_idempotency_key: uniq("pk"),
      }),
    ),
  );
  await Promise.all(
    sessions.flatMap((s) =>
      [0, 1].map(() => owner.rpc("complete_packaging_session", { p_session_id: s.data! })),
    ),
  );
  // 15 bags exist; 6 concurrent orders of 3 → only 5 can reserve
  const orders = await Promise.all(
    Array.from({ length: 6 }, () =>
      owner.rpc("create_sales_order", {
        p_business_id: businessId,
        p_customer_id: null as unknown as string,
        p_sales_channel_id: channelId,
        p_price_tier: "retail",
        p_ordered_at: "2026-11-01",
        p_due_at: null as unknown as string,
        p_discount_amount: 0,
        p_notes: null as unknown as string,
        p_items: [
          { product_variant_id: variant!.id, quantity: 3, unit_price: "350", discount_amount: "0" },
        ] as unknown as Json,
        p_idempotency_key: uniq("so"),
      }),
    ),
  );
  const confirms = await Promise.all(
    orders.map((o) => owner.rpc("confirm_sales_order", { p_order_id: o.data!, p_reserve: true })),
  );
  const reserved = orders.filter((_, i) => confirms[i].error === null);
  expect(reserved).toHaveLength(5);
  // fulfil all reserved orders concurrently, each twice with the same key
  await Promise.all(
    reserved.flatMap((o) => {
      const key = uniq("sf");
      return [0, 1].map(() =>
        owner.rpc("fulfill_sales_order", {
          p_order_id: o.data!,
          p_location_id: null as unknown as string,
          p_fulfilled_at: "2026-11-01",
          p_items: null as unknown as Json,
          p_notes: null as unknown as string,
          p_idempotency_key: key,
        }),
      );
    }),
  );
  // void one roast (should be refused: roasted stock consumed) and one order return
  const voidRes = await owner.rpc("void_roast_batch", {
    p_batch_id: batches[0].data!,
    p_reason: "test",
    p_idempotency_key: uniq("v"),
  });
  expect(voidRes.error?.message).toMatch(/already been used/);
  const { data: oi } = await owner
    .from("sales_order_items")
    .select("id")
    .eq("order_id", reserved[0].data!)
    .limit(1)
    .single();
  const { data: fi } = await owner
    .from("sales_fulfillment_items")
    .select("id")
    .eq("order_item_id", oi!.id)
    .limit(1)
    .single();
  await owner.rpc("create_sales_return", {
    p_order_id: reserved[0].data!,
    p_location_id: null as unknown as string,
    p_reason: "inv",
    p_received_at: "2026-11-02",
    p_notes: null as unknown as string,
    p_items: [
      { fulfillment_item_id: fi!.id, quantity: 1, condition: "sealed", disposition: "restock" },
    ] as unknown as Json,
    p_idempotency_key: uniq("sr"),
  });
  return {
    lotId: line.green_lot_id,
    batches: batches.map((b) => b.data!),
    sessions: sessions.map((s) => s.data!),
    variantId: variant!.id,
    reserved: reserved.map((o) => o.data!),
  };
}

describe("inventory invariants (whole database)", () => {
  let ctx: Awaited<ReturnType<typeof chain>>;
  beforeAll(async () => {
    ctx = await chain();
  });

  it("no balance is negative and reserved never exceeds on hand", async () => {
    const { data } = await admin
      .from("inventory_balances")
      .select("on_hand_quantity, reserved_quantity");
    expect(
      data!.every(
        (b) =>
          b.on_hand_quantity >= 0 &&
          b.reserved_quantity >= 0 &&
          b.reserved_quantity <= b.on_hand_quantity,
      ),
    ).toBe(true);
  });

  it("every balance equals the sum of its movements (ledger reconciliation)", async () => {
    const { data } = await admin
      .from("inventory_reconciliation_view")
      .select("difference")
      .neq("difference", 0);
    expect(data).toEqual([]);
  });

  it("movements are unique per idempotency key and immutable", async () => {
    const { data } = await admin.rpc("report_inventory_valuation", { p_business_id: businessId }); // sanity the function works for admin
    expect(data).toBeTruthy();
    const dup = await fetchAll((f, t) =>
      admin
        .from("inventory_movements")
        .select("business_id, idempotency_key")
        .order("id")
        .range(f, t),
    );
    const keys = new Set(dup.map((m) => `${m.business_id}:${m.idempotency_key}`));
    expect(keys.size).toBe(dup.length);
    const { data: one } = await admin.from("inventory_movements").select("id").limit(1).single();
    expect(
      (await admin.from("inventory_movements").update({ notes: "x" }).eq("id", one!.id)).error
        ?.message,
    ).toMatch(/immutable/);
  });

  it("each roast, packaging and fulfilment posts stock exactly once despite duplicate/concurrent calls", async () => {
    for (const b of ctx.batches) {
      const { count } = await admin
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("movement_type", "roast_output")
        .eq("source_id", b);
      expect(count).toBe(1);
      const { count: consume } = await admin
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("movement_type", "roast_consume")
        .eq("source_type", "roast_batch_input")
        .in(
          "source_id",
          (await admin.from("roast_batch_inputs").select("id").eq("roast_batch_id", b)).data!.map(
            (i) => i.id,
          ),
        );
      expect(consume).toBe(1);
    }
    for (const s of ctx.sessions) {
      const outs = (
        await admin.from("packaging_outputs").select("id").eq("session_id", s)
      ).data!.map((o) => o.id);
      const { count } = await admin
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("movement_type", "pack_output")
        .in("source_id", outs);
      expect(count).toBe(outs.length);
    }
    for (const o of ctx.reserved) {
      const { data: f } = await admin
        .from("sales_fulfillments")
        .select("id")
        .eq("order_id", o)
        .eq("status", "posted");
      expect(f).toHaveLength(1);
    }
  });

  it("green lot: 10 kg − 3 × 1.5 kg = 5.5 kg; roasted: 3 × 10 g; finished: 15 − 15 sold + 1 restocked", async () => {
    const { data: lot } = await admin
      .from("green_lot_inventory_view")
      .select("on_hand_g, received_quantity_g")
      .eq("lot_id", ctx.lotId)
      .single();
    expect(lot).toMatchObject({ received_quantity_g: 10_000, on_hand_g: 5_500 });
    const { data: roasted } = await admin
      .from("roast_batch_summary_view")
      .select("roasted_on_hand_g")
      .in("id", ctx.batches);
    expect(roasted!.map((r) => r.roasted_on_hand_g)).toEqual([10, 10, 10]);
    const { data: fg } = await admin
      .from("variant_availability_view")
      .select("on_hand, reserved, available")
      .eq("variant_id", ctx.variantId)
      .single();
    expect(fg).toEqual({ on_hand: 1, reserved: 0, available: 1 });
  });

  it("cost layers never go negative, never exceed received, and all consumption is costed", async () => {
    const layers = await fetchAll((f, t) =>
      admin
        .from("inventory_cost_layers")
        .select("received_quantity, remaining_quantity, original_cost, remaining_cost")
        .order("id")
        .range(f, t),
    );
    expect(
      layers.every(
        (l) =>
          l.remaining_quantity >= 0 &&
          l.remaining_quantity <= l.received_quantity &&
          l.remaining_cost >= 0 &&
          l.remaining_cost <= l.original_cost + 0.005,
      ),
    ).toBe(true);
    // for every inventory item: Σ remaining layer qty == on-hand (cost layers reconcile to balances)
    const items = await fetchAll((f, t) =>
      admin
        .from("inventory_items")
        .select("id")
        .eq("business_id", businessId)
        .order("id")
        .range(f, t),
    );
    for (const it of items) {
      const b = await fetchAll((f, t) =>
        admin
          .from("inventory_balances")
          .select("on_hand_quantity")
          .eq("inventory_item_id", it.id)
          .range(f, t),
      );
      const l = await fetchAll((f, t) =>
        admin
          .from("inventory_cost_layers")
          .select("remaining_quantity")
          .eq("inventory_item_id", it.id)
          .order("id")
          .range(f, t),
      );
      const onHand = b.reduce((a, x) => a + x.on_hand_quantity, 0);
      const layerQty = l.reduce((a, x) => a + x.remaining_quantity, 0);
      expect(layerQty, `item ${it.id}`).toBe(onHand);
    }
  });

  it("costs are inherited exactly along the chain", async () => {
    // green lot cost: 10 kg × ₱450 + ₱100 PO costs + ₱25 landed = ₱4,625 → ₱0.4625/g; roast: 1500 g → ₱693.75 + ₱40 = ₱733.75
    for (const b of ctx.batches) {
      const { data } = await admin
        .from("roast_batches")
        .select("green_cost, production_cost_total")
        .eq("id", b)
        .single();
      expect(data).toEqual({ green_cost: 693.75, production_cost_total: 733.75 });
    }
    // packaging: 1250/1260 × 733.75 = ₱727.93 + ₱50 labor = ₱777.93 → ₱155.586 per bag
    for (const s of ctx.sessions) {
      const { data } = await admin
        .from("packaging_sessions")
        .select("coffee_cost, total_cost")
        .eq("id", s)
        .single();
      expect(data).toEqual({ coffee_cost: 727.93, total_cost: 777.93 });
    }
    const { data: lines } = await admin
      .from("sales_fulfillment_items")
      .select("unit_cost_snapshot, total_cost")
      .in(
        "order_item_id",
        (await admin.from("sales_order_items").select("id").in("order_id", ctx.reserved)).data!.map(
          (i) => i.id,
        ),
      );
    // 5 orders × 3 bags; orders may span two lots (FIFO), so lines ≥ 5 but units and cost are exact
    const units = (
      await admin
        .from("sales_fulfillment_items")
        .select("quantity")
        .in(
          "id",
          lines!.map(() => "").length
            ? (
                await admin
                  .from("sales_fulfillment_items")
                  .select("id")
                  .in(
                    "order_item_id",
                    (
                      await admin
                        .from("sales_order_items")
                        .select("id")
                        .in("order_id", ctx.reserved)
                    ).data!.map((i) => i.id),
                  )
              ).data!.map((x) => x.id)
            : [],
        )
    ).data!.reduce((a, x) => a + x.quantity, 0);
    expect(units).toBe(15);
    for (const l of lines!)
      expect(
        Math.abs(l.unit_cost_snapshot! - 155.586) < 0.01,
        `unit cost ${l.unit_cost_snapshot}`,
      ).toBe(true);
    const totalCogs = lines!.reduce((a, l) => a + (l.total_cost ?? 0), 0);
    expect(Math.abs(totalCogs - 15 * 155.586) < 0.05).toBe(true);
  });

  it("every finished lot traces back to roast batches and green lots", async () => {
    const { data: lots } = await admin
      .from("finished_goods_inventory_view")
      .select("lot_id, roast_batch_numbers, green_lot_codes")
      .eq("business_id", businessId)
      .not("packaging_session_id", "is", null);
    expect(lots!.length).toBeGreaterThan(0);
    expect(
      lots!.every(
        (l) => (l.roast_batch_numbers ?? "").length > 0 && (l.green_lot_codes ?? "").length > 0,
      ),
    ).toBe(true);
    const { data: orphans } = await admin
      .from("finished_goods_lots")
      .select("id")
      .eq("business_id", businessId)
      .is("packaging_session_id", null);
    expect(orphans).toEqual([]);
  });

  it("documents that moved stock are immutable; reversals are explicit", async () => {
    expect(
      (await admin.from("roast_batches").update({ roasted_weight_g: 1 }).eq("id", ctx.batches[0]))
        .error?.message,
    ).toMatch(/immutable/);
    expect(
      (await admin.from("packaging_sessions").update({ total_cost: 1 }).eq("id", ctx.sessions[0]))
        .error?.message,
    ).toMatch(/immutable/);
    expect(
      (await admin.from("sales_orders").update({ total_amount: 1 }).eq("id", ctx.reserved[0])).error
        ?.message,
    ).toMatch(/sales functions/);
    const { data: fl } = await admin
      .from("finished_goods_lots")
      .select("id")
      .eq("variant_id", ctx.variantId)
      .limit(1)
      .single();
    expect(
      (await admin.from("finished_goods_lots").update({ unit_cost: 1 }).eq("id", fl!.id)).error
        ?.message,
    ).toMatch(/immutable/);
    const { data: moves } = await admin
      .from("inventory_movements")
      .select("movement_type")
      .in("source_type", ["sales_return_item"])
      .order("created_at", { ascending: false })
      .limit(1);
    expect(moves![0].movement_type).toBe("sale_return");
  });
});
