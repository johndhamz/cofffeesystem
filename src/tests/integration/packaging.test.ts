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
let viewer: Db;
let other: Db;
let businessId: string;
let roasterId: string;
let locationId: string;

beforeAll(async () => {
  [owner, viewer, other] = await Promise.all([
    userClient(SEED.owner),
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
});

/** Green 10 kg @ ₱450/kg → roast 1.5 kg → 1.26 kg roasted costing ₱775 (₱675 green + ₱100 costs). */
async function roastedBatch(
  opts: {
    greenCost?: string;
    costs?: { cost_type: string; amount: string }[];
    roastedG?: number;
    greenG?: number;
  } = {},
) {
  const fx = await createMasterFixtures(owner, businessId);
  const po = await createConfirmedPurchase(owner, businessId, {
    supplierId: fx.supplier.id,
    coffeeId: fx.coffee.id,
    grams: 10_000,
    unitCost: opts.greenCost ?? "450",
  });
  const rid = await createReceipt(owner, {
    poId: po.poId,
    locationId,
    items: [{ purchase_order_item_id: po.items[0].id, received_quantity_g: 10_000 }],
  });
  await postReceipt(owner, rid);
  const [line] = await lotsForReceipt(owner, rid);
  const { data: batchId, error } = await owner.rpc("create_roast_batch", {
    p_business_id: businessId,
    p_roaster_id: roasterId,
    p_roast_profile_id: null as unknown as string,
    p_location_id: locationId,
    p_roast_date: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: [
      { green_lot_id: line.green_lot_id, input_weight_g: opts.greenG ?? 1500 },
    ] as unknown as Json,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("rb"),
  });
  if (error) throw error;
  const { error: cErr } = await owner.rpc("complete_roast_batch", {
    p_batch_id: batchId!,
    p_roasted_weight_g: opts.roastedG ?? 1260,
    p_roast_level: "medium",
    p_total_duration_seconds: 600,
    p_first_crack_seconds: 480,
    p_charge_bt_c: null as unknown as number,
    p_charge_et_c: null as unknown as number,
    p_first_crack_bt_c: null as unknown as number,
    p_drop_bt_c: null as unknown as number,
    p_costs: (opts.costs ?? [
      { cost_type: "lpg", amount: "40" },
      { cost_type: "labor", amount: "60" },
    ]) as unknown as Json,
    p_notes: null as unknown as string,
  });
  if (cErr) throw cErr;
  const { data: item } = await owner
    .from("inventory_items")
    .select("id")
    .eq("item_type", "roasted_bulk")
    .eq("reference_id", batchId!)
    .single();
  return {
    batchId: batchId!,
    roastedItemId: item!.id,
    greenLotId: line.green_lot_id,
    coffee: fx.coffee,
  };
}

async function productWithVariant(
  netWeightG = 250,
  materials: { material_id: string; quantity_per_unit: number }[] = [],
) {
  const { data: product } = await owner
    .from("products")
    .insert({ business_id: businessId, name: uniq("Product"), category: "single_origin" })
    .select("id")
    .single();
  const { data: variant } = await owner
    .from("product_variants")
    .insert({
      business_id: businessId,
      product_id: product!.id,
      sku: uniq("SKU").replace(/\s/g, "-"),
      name: `${netWeightG} g bag`,
      net_weight_g: netWeightG,
      selling_price: 350,
    })
    .select("id")
    .single();
  if (materials.length)
    await owner
      .from("variant_materials")
      .insert(materials.map((m) => ({ business_id: businessId, variant_id: variant!.id, ...m })));
  return { productId: product!.id, variantId: variant!.id };
}

/** Creates a packaging material and receives `qty` units at `unitCost` via an adjustment. */
async function material(qty: number, unitCost = "8") {
  const { data: m } = await owner
    .from("packaging_materials")
    .insert({
      business_id: businessId,
      name: uniq("Bag"),
      base_unit: "pc",
      reorder_level: 10,
      standard_unit_cost: 9,
    })
    .select("id")
    .single();
  const { data: item } = await owner
    .from("inventory_items")
    .select("id")
    .eq("item_type", "packaging_material")
    .eq("reference_id", m!.id)
    .single();
  if (qty > 0) {
    const { error } = await owner.rpc("create_inventory_adjustment", {
      p_business_id: businessId,
      p_reason: "count_correction",
      p_notes: "received bags",
      p_lines: [
        {
          inventory_item_id: item!.id,
          location_id: locationId,
          quantity_delta: qty,
          unit_cost: unitCost,
          notes: null,
        },
      ] as unknown as Json,
      p_idempotency_key: uniq("adj"),
      p_post: true,
    });
    if (error) throw error;
  }
  return { materialId: m!.id, itemId: item!.id };
}

function createSession(
  db: Db,
  args: {
    inputs: { roast_batch_id: string; input_weight_g: number }[];
    outputs: { variant_id: string; quantity: number; lot_code?: string }[];
    materials?: { material_id: string; quantity: number }[] | null;
    labor?: number;
    overhead?: number;
    key?: string;
  },
) {
  return db.rpc("create_packaging_session", {
    p_business_id: businessId,
    p_location_id: locationId,
    p_packaged_at: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: args.inputs as unknown as Json,
    p_outputs: args.outputs as unknown as Json,
    p_materials: (args.materials === undefined ? null : args.materials) as unknown as Json,
    p_labor_cost: args.labor ?? 0,
    p_overhead_cost: args.overhead ?? 0,
    p_notes: null as unknown as string,
    p_idempotency_key: args.key ?? uniq("pk"),
  });
}

async function onHand(itemId: string) {
  const { data } = await owner
    .from("inventory_balances")
    .select("on_hand_quantity")
    .eq("inventory_item_id", itemId);
  return (data ?? []).reduce((a, r) => a + r.on_hand_quantity, 0);
}

async function finishedLots(sessionId: string) {
  const { data } = await owner
    .from("finished_goods_inventory_view")
    .select("*")
    .eq("packaging_session_id", sessionId)
    .order("lot_code");
  return data ?? [];
}

describe("packaging workflow", () => {
  it("1260 g roasted → five 250 g bags: 10 g remains, 5 units exist, materials consumed, unit cost correct, lineage intact", async () => {
    const r = await roastedBatch(); // 1260 g @ ₱775 → ₱0.615079/g
    const bag = await material(100, "8");
    const { variantId } = await productWithVariant(250, [
      { material_id: bag.materialId, quantity_per_unit: 1 },
    ]);
    const { data: sid, error } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 1250 }],
      outputs: [{ variant_id: variantId, quantity: 5 }],
      labor: 50,
    });
    expect(error).toBeNull();
    const { data: draft } = await owner
      .from("packaging_sessions")
      .select("status, required_weight_g, input_weight_g")
      .eq("id", sid!)
      .single();
    expect(draft).toMatchObject({ status: "draft", required_weight_g: 1250, input_weight_g: 1250 });
    expect(await onHand(r.roastedItemId)).toBe(1260); // draft does not move stock
    const { data: usage } = await owner
      .from("packaging_material_usage")
      .select("material_id, quantity")
      .eq("session_id", sid!);
    expect(usage).toEqual([{ material_id: bag.materialId, quantity: 5 }]); // derived from BOM

    const { error: cErr } = await owner.rpc("complete_packaging_session", { p_session_id: sid! });
    expect(cErr).toBeNull();

    expect(await onHand(r.roastedItemId)).toBe(10);
    expect(await onHand(bag.itemId)).toBe(95);
    const lots = await finishedLots(sid!);
    expect(lots).toHaveLength(1);
    const lot = lots[0];
    expect(lot.available).toBe(5);
    expect(lot.packaged_quantity).toBe(5);
    // coffee: 1250 g of a 1260 g layer costing ₱775 → round(775 × 1250 / 1260, 2) = ₱768.85; bags 5 × ₱8 = ₱40; labor ₱50 → ₱858.85
    const { data: s } = await owner
      .from("packaging_sessions")
      .select("coffee_cost, material_cost, total_cost, status")
      .eq("id", sid!)
      .single();
    expect(s).toMatchObject({
      status: "completed",
      coffee_cost: 768.85,
      material_cost: 40,
      total_cost: 858.85,
    });
    expect(lot.total_cost).toBe(858.85);
    expect(lot.unit_cost).toBe(171.77);
    expect(lot.stock_value).toBe(858.85);
    // lineage
    const { data: batch } = await owner
      .from("roast_batches")
      .select("batch_number")
      .eq("id", r.batchId)
      .single();
    expect(lot.roast_batch_numbers).toBe(batch!.batch_number);
    expect(lot.coffee_names).toBe(r.coffee.name);
    const { data: greenLot } = await owner
      .from("green_coffee_lots")
      .select("lot_code")
      .eq("id", r.greenLotId)
      .single();
    expect(lot.green_lot_codes).toBe(greenLot!.lot_code);
    // roasted stock value left = ₱775 − ₱768.85 = ₱6.15 for 10 g
    const { data: layer } = await owner
      .from("inventory_cost_layers")
      .select("remaining_quantity, remaining_cost")
      .eq("inventory_item_id", r.roastedItemId)
      .single();
    expect(layer).toMatchObject({ remaining_quantity: 10, remaining_cost: 6.15 });
    const { data: recon } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(recon).toEqual([]);
  });

  it("combines multiple roast batches and allocates cost across outputs exactly", async () => {
    const a = await roastedBatch({ greenCost: "400", costs: [] }); // 1260 g @ ₱600 (1500 g × ₱0.40)
    const b = await roastedBatch({ greenCost: "600", costs: [] }); // 1260 g @ ₱900
    const v250 = await productWithVariant(250);
    const v500 = await productWithVariant(500);
    const { data: sid } = await createSession(owner, {
      inputs: [
        { roast_batch_id: a.batchId, input_weight_g: 1000 },
        { roast_batch_id: b.batchId, input_weight_g: 1000 },
      ],
      outputs: [
        { variant_id: v250.variantId, quantity: 6 },
        { variant_id: v500.variantId, quantity: 1 },
      ], // 1500 + 500 = 2000 g
      materials: [],
    });
    expect(
      (await owner.rpc("complete_packaging_session", { p_session_id: sid! })).error,
    ).toBeNull();
    const { data: inputs } = await owner
      .from("packaging_inputs")
      .select("roast_batch_id, inherited_cost")
      .eq("session_id", sid!);
    const byBatch = Object.fromEntries(
      (inputs ?? []).map((i) => [i.roast_batch_id, i.inherited_cost]),
    );
    expect(byBatch[a.batchId]).toBe(476.19); // 600 × 1000/1260
    expect(byBatch[b.batchId]).toBe(714.29); // 900 × 1000/1260
    const lots = await finishedLots(sid!);
    const total = lots.reduce((s, l) => s + l.total_cost, 0);
    expect(Math.round(total * 100)).toBe(Math.round((476.19 + 714.29) * 100));
    const l250 = lots.find((l) => l.net_weight_g === 250)!;
    const l500 = lots.find((l) => l.net_weight_g === 500)!;
    expect(l250.total_cost).toBe(892.86); // 75% of 1190.48
    expect(l500.total_cost).toBe(297.62); // remainder
    expect(l250.roast_batch_numbers?.split(", ")).toHaveLength(2);
    expect(await onHand(a.roastedItemId)).toBe(260);
    expect(await onHand(b.roastedItemId)).toBe(260);
  });

  it("rejects packaging more coffee than available and more materials than available; nothing is created", async () => {
    const r = await roastedBatch();
    const bag = await material(2);
    const { variantId } = await productWithVariant(250, [
      { material_id: bag.materialId, quantity_per_unit: 1 },
    ]);
    // input exceeds roasted stock (1260 g)
    const { data: s1 } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 1500 }],
      outputs: [{ variant_id: variantId, quantity: 5 }],
      materials: [],
    });
    expect(
      (await owner.rpc("complete_packaging_session", { p_session_id: s1! })).error?.message,
    ).toMatch(/INSUFFICIENT_STOCK/);
    expect(await onHand(r.roastedItemId)).toBe(1260);
    expect(await finishedLots(s1!)).toEqual([]);
    expect(
      (await owner.from("packaging_sessions").select("status").eq("id", s1!).single()).data?.status,
    ).toBe("draft");
    // materials short (needs 5 bags, has 2)
    const { data: s2 } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 1250 }],
      outputs: [{ variant_id: variantId, quantity: 5 }],
    });
    expect(
      (await owner.rpc("complete_packaging_session", { p_session_id: s2! })).error?.message,
    ).toMatch(/INSUFFICIENT_STOCK/);
    expect(await onHand(r.roastedItemId)).toBe(1260);
    expect(await onHand(bag.itemId)).toBe(2);
    expect(await finishedLots(s2!)).toEqual([]);
    // output needs more coffee than input
    const { error } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 1000 }],
      outputs: [{ variant_id: variantId, quantity: 5 }],
      materials: [],
    });
    expect(error?.message).toMatch(/less than the coffee required/);
    // quantity must be positive integer
    const { error: qErr } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 1000 }],
      outputs: [{ variant_id: variantId, quantity: 0 }],
      materials: [],
    });
    expect(qErr?.message).toMatch(/positive integer/);
  });

  it("duplicate and concurrent completions and idempotent creation move stock once", async () => {
    const r = await roastedBatch();
    const { variantId } = await productWithVariant(250);
    const key = uniq("pk");
    const a = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
      outputs: [{ variant_id: variantId, quantity: 2 }],
      materials: [],
      key,
    });
    const b = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
      outputs: [{ variant_id: variantId, quantity: 2 }],
      materials: [],
      key,
    });
    expect(a.data).toBe(b.data);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        owner.rpc("complete_packaging_session", { p_session_id: a.data! }),
      ),
    );
    expect(results.every((x) => x.error === null)).toBe(true);
    expect(await onHand(r.roastedItemId)).toBe(760);
    const lots = await finishedLots(a.data!);
    expect(lots).toHaveLength(1);
    expect(lots[0].available).toBe(2);
    const { count } = await owner
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "packaging_output");
    expect(count).toBeGreaterThan(0);
    const { count: outMoves } = await owner
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("movement_type", "pack_output")
      .eq("inventory_item_id", lots[0].inventory_item_id!);
    expect(outMoves).toBe(1);
  });

  it("concurrent sessions on one batch cannot overconsume roasted stock", async () => {
    const r = await roastedBatch(); // 1260 g
    const { variantId } = await productWithVariant(250);
    const sessions = await Promise.all(
      Array.from({ length: 4 }, () =>
        createSession(owner, {
          inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
          outputs: [{ variant_id: variantId, quantity: 2 }],
          materials: [],
        }),
      ),
    );
    const results = await Promise.all(
      sessions.map((s) => owner.rpc("complete_packaging_session", { p_session_id: s.data! })),
    );
    expect(results.filter((x) => x.error === null)).toHaveLength(2);
    expect(results.filter((x) => x.error?.message.includes("INSUFFICIENT_STOCK"))).toHaveLength(2);
    expect(await onHand(r.roastedItemId)).toBe(260);
  });

  it("completed sessions are immutable; void reverses stock and cost; refused once finished goods moved", async () => {
    const r = await roastedBatch();
    const bag = await material(20, "8");
    const { variantId } = await productWithVariant(250, [
      { material_id: bag.materialId, quantity_per_unit: 1 },
    ]);
    const { data: sid } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 1250 }],
      outputs: [{ variant_id: variantId, quantity: 5 }],
      labor: 50,
    });
    await owner.rpc("complete_packaging_session", { p_session_id: sid! });
    expect(
      (await owner.from("packaging_sessions").update({ labor_cost: 1 }).eq("id", sid!)).error
        ?.message,
    ).toMatch(/immutable/);
    expect(
      (
        await owner.rpc("update_packaging_session_draft", {
          p_session_id: sid!,
          p_location_id: locationId,
          p_packaged_at: "2026-11-01",
          p_operator_id: null as unknown as string,
          p_inputs: [] as unknown as Json,
          p_outputs: [] as unknown as Json,
          p_materials: null as unknown as Json,
          p_labor_cost: 0,
          p_overhead_cost: 0,
          p_notes: null as unknown as string,
        })
      ).error?.message,
    ).toMatch(/cannot be edited/);
    const [lot] = await finishedLots(sid!);
    const { data: roastedLayerBefore } = await owner
      .from("inventory_cost_layers")
      .select("remaining_cost")
      .eq("inventory_item_id", r.roastedItemId)
      .single();
    expect(roastedLayerBefore?.remaining_cost).toBe(6.15);

    const key = uniq("void");
    expect(
      (
        await owner.rpc("void_packaging_session", {
          p_session_id: sid!,
          p_reason: "Mislabeled",
          p_idempotency_key: key,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner.rpc("void_packaging_session", {
          p_session_id: sid!,
          p_reason: "again",
          p_idempotency_key: key,
        })
      ).error,
    ).toBeNull();
    expect(await onHand(r.roastedItemId)).toBe(1260);
    expect(await onHand(bag.itemId)).toBe(20);
    expect(await onHand(lot.inventory_item_id!)).toBe(0);
    const { data: layers } = await owner
      .from("inventory_cost_layers")
      .select("remaining_cost")
      .eq("inventory_item_id", r.roastedItemId);
    expect(Math.round((layers ?? []).reduce((a, l) => a + l.remaining_cost, 0) * 100)).toBe(77500); // ₱6.15 + ₱768.85 restored
    expect(
      (await owner.from("packaging_sessions").select("status").eq("id", sid!).single()).data
        ?.status,
    ).toBe("voided");

    // sold-out lot blocks void
    const { data: sid2 } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
      outputs: [{ variant_id: variantId, quantity: 2 }],
      materials: [],
    });
    await owner.rpc("complete_packaging_session", { p_session_id: sid2! });
    const [lot2] = await finishedLots(sid2!);
    await owner.rpc("create_inventory_adjustment", {
      p_business_id: businessId,
      p_reason: "sample",
      p_notes: null as unknown as string,
      p_lines: [
        {
          inventory_item_id: lot2.inventory_item_id,
          location_id: locationId,
          quantity_delta: -1,
          unit_cost: null,
          notes: null,
        },
      ] as unknown as Json,
      p_idempotency_key: uniq("adj"),
      p_post: true,
    });
    expect(
      (
        await owner.rpc("void_packaging_session", {
          p_session_id: sid2!,
          p_reason: "late",
          p_idempotency_key: uniq("void"),
        })
      ).error?.message,
    ).toMatch(/sold or moved/);
    const { data: recon } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(recon).toEqual([]);
  });

  it("uses standard material cost when no received cost layers exist", async () => {
    const r = await roastedBatch({ costs: [] });
    const { data: m } = await owner
      .from("packaging_materials")
      .insert({
        business_id: businessId,
        name: uniq("Label"),
        base_unit: "pc",
        standard_unit_cost: 1.5,
      })
      .select("id")
      .single();
    // receive 10 labels with no unit cost (cost layer 0) → falls back to standard cost
    const { data: item } = await owner
      .from("inventory_items")
      .select("id")
      .eq("item_type", "packaging_material")
      .eq("reference_id", m!.id)
      .single();
    await owner.rpc("create_inventory_adjustment", {
      p_business_id: businessId,
      p_reason: "count_correction",
      p_notes: null as unknown as string,
      p_lines: [
        {
          inventory_item_id: item!.id,
          location_id: locationId,
          quantity_delta: 10,
          unit_cost: "0",
          notes: null,
        },
      ] as unknown as Json,
      p_idempotency_key: uniq("adj"),
      p_post: true,
    });
    const { variantId } = await productWithVariant(250, [
      { material_id: m!.id, quantity_per_unit: 1 },
    ]);
    const { data: sid } = await createSession(owner, {
      inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
      outputs: [{ variant_id: variantId, quantity: 2 }],
    });
    await owner.rpc("complete_packaging_session", { p_session_id: sid! });
    const { data: s } = await owner
      .from("packaging_sessions")
      .select("material_cost")
      .eq("id", sid!)
      .single();
    expect(s?.material_cost).toBe(3);
  });

  it("enforces roles and business isolation", async () => {
    const r = await roastedBatch();
    const { variantId } = await productWithVariant(250);
    expect(
      (
        await createSession(viewer, {
          inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
          outputs: [{ variant_id: variantId, quantity: 2 }],
          materials: [],
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    expect(
      (await viewer.from("products").insert({ business_id: businessId, name: uniq("Nope") })).error
        ?.code,
    ).toBe("42501");
    expect(
      (await viewer.from("finished_goods_inventory_view").select("lot_id").limit(1)).error,
    ).toBeNull();
    expect((await other.from("product_variants").select("id").eq("id", variantId)).data).toEqual(
      [],
    );
    expect(
      (
        await createSession(other, {
          inputs: [{ roast_batch_id: r.batchId, input_weight_g: 500 }],
          outputs: [{ variant_id: variantId, quantity: 2 }],
          materials: [],
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    // SKU uniqueness per business
    const { data: v } = await owner
      .from("product_variants")
      .select("sku, product_id")
      .eq("id", variantId)
      .single();
    expect(
      (
        await owner.from("product_variants").insert({
          business_id: businessId,
          product_id: v!.product_id,
          sku: v!.sku.toLowerCase(),
          name: "dup",
          net_weight_g: 100,
        })
      ).error?.code,
    ).toBe("23505");
  });
});
