import { beforeAll, describe, expect, it } from "vitest";
import type { Json } from "@/types/database";
import {
  adminClient,
  businessIdFor,
  createConfirmedPurchase,
  createMasterFixtures,
  createReceipt,
  lotBalance,
  lotsForReceipt,
  postReceipt,
  SEED,
  uniq,
  userClient,
  type Db,
} from "./helpers";

let owner: Db;
let roaster: Db;
let viewer: Db;
let other: Db;
let businessId: string;
let roasterId: string;

beforeAll(async () => {
  [owner, roaster, viewer, other] = await Promise.all([
    userClient(SEED.owner),
    userClient(SEED.roaster),
    userClient(SEED.viewer),
    userClient(SEED.otherOwner),
  ]);
  businessId = await businessIdFor(owner);
  const { data } = await owner
    .from("roasters")
    .select("id")
    .eq("business_id", businessId)
    .eq("name", "Yoshan DY-2kg")
    .single();
  roasterId = data!.id;
});

/** Receives `grams` of green coffee at `unitCost` ₱/kg and returns the lot + inventory item. */
async function greenLot(grams: number, unitCost = "450") {
  const fx = await createMasterFixtures(owner, businessId);
  const po = await createConfirmedPurchase(owner, businessId, {
    supplierId: fx.supplier.id,
    coffeeId: fx.coffee.id,
    grams,
    unitCost,
  });
  const receiptId = await createReceipt(owner, {
    poId: po.poId,
    locationId: fx.location.id,
    items: [{ purchase_order_item_id: po.items[0].id, received_quantity_g: grams }],
  });
  await postReceipt(owner, receiptId);
  const [line] = await lotsForReceipt(owner, receiptId);
  const bal = await lotBalance(owner, line.green_lot_id);
  return {
    lotId: line.green_lot_id,
    itemId: bal.inventory_item_id!,
    locationId: fx.location.id,
    coffee: fx.coffee,
  };
}

async function createBatch(
  db: Db,
  inputs: { green_lot_id: string; input_weight_g: number }[],
  locationId: string,
  key = uniq("rb"),
) {
  const { data, error } = await db.rpc("create_roast_batch", {
    p_business_id: businessId,
    p_roaster_id: roasterId,
    p_roast_profile_id: null as unknown as string,
    p_location_id: locationId,
    p_roast_date: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: inputs as unknown as Json,
    p_notes: null as unknown as string,
    p_idempotency_key: key,
  });
  if (error) throw error;
  return data!;
}

function complete(
  db: Db,
  batchId: string,
  roastedG: number,
  extra: Partial<{
    duration: number;
    fc: number | null;
    costs: { cost_type: string; amount: string }[];
  }> = {},
) {
  return db.rpc("complete_roast_batch", {
    p_batch_id: batchId,
    p_roasted_weight_g: roastedG,
    p_roast_level: "medium",
    p_total_duration_seconds: extra.duration ?? 600,
    p_first_crack_seconds: (extra.fc === undefined ? 480 : extra.fc) as number,
    p_charge_bt_c: 200,
    p_charge_et_c: 220,
    p_first_crack_bt_c: 196,
    p_drop_bt_c: 212,
    p_costs: (extra.costs ?? [
      { cost_type: "lpg", amount: "40" },
      { cost_type: "labor", amount: "60" },
    ]) as unknown as Json,
    p_notes: null as unknown as string,
  });
}

async function roastedItem(batchId: string) {
  const { data } = await owner
    .from("inventory_items")
    .select("id")
    .eq("item_type", "roasted_bulk")
    .eq("reference_id", batchId)
    .maybeSingle();
  return data?.id ?? null;
}

async function onHand(itemId: string) {
  const { data } = await owner
    .from("inventory_balances")
    .select("on_hand_quantity")
    .eq("inventory_item_id", itemId);
  return (data ?? []).reduce((a, r) => a + r.on_hand_quantity, 0);
}

describe("roast batch lifecycle", () => {
  it("1.5 kg green → 1.26 kg roasted: consumes green, creates roasted stock, 16% loss, 84% yield, cost inherited", async () => {
    const g = await greenLot(10_000, "450"); // ₱4,500 → ₱0.45/g
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1500 }],
      g.locationId,
    );
    expect((await owner.rpc("start_roast_batch", { p_batch_id: batchId })).error).toBeNull();
    const { error } = await complete(owner, batchId, 1260);
    expect(error).toBeNull();

    const { data: b } = await owner.from("roast_batches").select("*").eq("id", batchId).single();
    expect(b).toMatchObject({
      status: "completed",
      green_weight_g: 1500,
      roasted_weight_g: 1260,
      roast_loss_pct: 16,
      roast_yield_pct: 84,
      development_seconds: 120,
      development_ratio_pct: 20,
      green_cost: 675, // 1500 g × ₱0.45
      production_cost_total: 775, // + 40 + 60
      roasted_cost_per_g: 0.615079,
    });
    expect((await lotBalance(owner, g.lotId)).on_hand_g).toBe(8500);
    const rItem = await roastedItem(batchId);
    expect(rItem).not.toBeNull();
    expect(await onHand(rItem!)).toBe(1260);

    const { data: inputs } = await owner
      .from("roast_batch_inputs")
      .select("allocated_green_cost")
      .eq("roast_batch_id", batchId);
    expect(inputs?.[0].allocated_green_cost).toBe(675);
    const { data: layer } = await owner
      .from("inventory_cost_layers")
      .select("received_quantity, original_cost, remaining_cost")
      .eq("inventory_item_id", rItem!)
      .single();
    expect(layer).toMatchObject({
      received_quantity: 1260,
      original_cost: 775,
      remaining_cost: 775,
    });
    const { data: summary } = await owner
      .from("roast_batch_summary_view")
      .select("roasted_cost_per_kg, roasted_on_hand_g")
      .eq("id", batchId)
      .single();
    expect(summary).toMatchObject({ roasted_cost_per_kg: 615.08, roasted_on_hand_g: 1260 });

    // ledger reconciles
    const { data: recon } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(recon).toEqual([]);
  });

  it("a draft or in-progress batch never touches stock", async () => {
    const g = await greenLot(2000);
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1500 }],
      g.locationId,
    );
    expect((await lotBalance(owner, g.lotId)).on_hand_g).toBe(2000);
    await owner.rpc("start_roast_batch", { p_batch_id: batchId });
    expect((await lotBalance(owner, g.lotId)).on_hand_g).toBe(2000);
    expect(await roastedItem(batchId)).toBeNull();
  });

  it("supports multiple green lots in one roast with per-lot cost allocation", async () => {
    const a = await greenLot(2000, "400"); // ₱0.40/g
    const b = await greenLot(2000, "600"); // ₱0.60/g
    const batchId = await createBatch(
      owner,
      [
        { green_lot_id: a.lotId, input_weight_g: 1000 },
        { green_lot_id: b.lotId, input_weight_g: 500 },
      ],
      a.locationId,
    );
    const { error } = await complete(owner, batchId, 1275, { costs: [] });
    expect(error).toBeNull();
    const { data: inputs } = await owner
      .from("roast_batch_inputs")
      .select("green_lot_id, allocated_green_cost")
      .eq("roast_batch_id", batchId);
    const byLot = Object.fromEntries(
      (inputs ?? []).map((i) => [i.green_lot_id, i.allocated_green_cost]),
    );
    expect(byLot[a.lotId]).toBe(400);
    expect(byLot[b.lotId]).toBe(300);
    const { data: batch } = await owner
      .from("roast_batches")
      .select("green_cost, production_cost_total, roast_loss_pct")
      .eq("id", batchId)
      .single();
    expect(batch).toMatchObject({
      green_cost: 700,
      production_cost_total: 700,
      roast_loss_pct: 15,
    });
    expect((await lotBalance(owner, a.lotId)).on_hand_g).toBe(1000);
    expect((await lotBalance(owner, b.lotId)).on_hand_g).toBe(1500);
  });

  it("duplicate and concurrent completion requests change stock exactly once", async () => {
    const g = await greenLot(5000);
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1500 }],
      g.locationId,
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () => complete(owner, batchId, 1260)),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    await complete(owner, batchId, 1200); // later call with different numbers is ignored
    const { data: b } = await owner
      .from("roast_batches")
      .select("roasted_weight_g")
      .eq("id", batchId)
      .single();
    expect(b?.roasted_weight_g).toBe(1260);
    expect((await lotBalance(owner, g.lotId)).on_hand_g).toBe(3500);
    expect(await onHand((await roastedItem(batchId))!)).toBe(1260);
    const { count } = await owner
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "roast_batch")
      .eq("source_id", batchId);
    expect(count).toBe(1);
  });

  it("concurrent roasts cannot overconsume a lot", async () => {
    const g = await greenLot(3000);
    const batches = await Promise.all(
      Array.from({ length: 4 }, () =>
        createBatch(owner, [{ green_lot_id: g.lotId, input_weight_g: 1000 }], g.locationId),
      ),
    );
    const results = await Promise.all(batches.map((id) => complete(owner, id, 850)));
    const ok = results.filter((r) => r.error === null).length;
    const failed = results.filter((r) => r.error?.message.includes("INSUFFICIENT_STOCK")).length;
    expect(ok).toBe(3);
    expect(failed).toBe(1);
    expect((await lotBalance(owner, g.lotId)).on_hand_g).toBe(0);
    const { data: statuses } = await owner.from("roast_batches").select("status").in("id", batches);
    expect(statuses?.filter((s) => s.status === "completed")).toHaveLength(3);
    expect(statuses?.filter((s) => s.status === "draft")).toHaveLength(1);
  });

  it("rolls back completely when green stock is insufficient (no roasted stock created)", async () => {
    const g = await greenLot(1000);
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1000 }],
      g.locationId,
    );
    // drain the lot after the draft was made
    await owner.rpc("create_inventory_adjustment", {
      p_business_id: businessId,
      p_reason: "sample",
      p_notes: null as unknown as string,
      p_lines: [
        {
          inventory_item_id: g.itemId,
          location_id: g.locationId,
          quantity_delta: -200,
          unit_cost: null,
          notes: null,
        },
      ] as unknown as Json,
      p_idempotency_key: uniq("adj"),
      p_post: true,
    });
    const { error } = await complete(owner, batchId, 850);
    expect(error?.message).toMatch(/INSUFFICIENT_STOCK/);
    const { data: b } = await owner
      .from("roast_batches")
      .select("status, roasted_weight_g, production_cost_total")
      .eq("id", batchId)
      .single();
    expect(b).toMatchObject({
      status: "draft",
      roasted_weight_g: null,
      production_cost_total: null,
    });
    expect(await roastedItem(batchId)).toBeNull();
    expect((await lotBalance(owner, g.lotId)).on_hand_g).toBe(800);
    const { count } = await owner
      .from("roast_batch_costs")
      .select("id", { count: "exact", head: true })
      .eq("roast_batch_id", batchId);
    expect(count).toBe(0);
  });

  it("validates completion inputs", async () => {
    const g = await greenLot(3000);
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1500 }],
      g.locationId,
    );
    expect((await complete(owner, batchId, 0)).error?.message).toMatch(
      /roasted output must be greater than zero/,
    );
    expect((await complete(owner, batchId, 1501)).error?.message).toMatch(
      /cannot exceed green input/,
    );
    expect((await complete(owner, batchId, 1260, { duration: 0 })).error?.message).toMatch(
      /duration/,
    );
    expect(
      (await complete(owner, batchId, 1260, { duration: 600, fc: 601 })).error?.message,
    ).toMatch(/first crack/i);
    expect(
      (await complete(owner, batchId, 1260, { costs: [{ cost_type: "lpg", amount: "-5" }] })).error
        ?.message,
    ).toMatch(/negative/);
    // measurement range checks at the database
    const bad = await owner.from("roast_measurements").insert({
      business_id: businessId,
      roast_batch_id: batchId,
      elapsed_seconds: 30,
      airflow_pct: 120,
    });
    expect(bad.error?.code).toBe("23514");
    const neg = await owner.from("roast_measurements").insert({
      business_id: businessId,
      roast_batch_id: batchId,
      elapsed_seconds: 30,
      gas_kpa: -1,
    });
    expect(neg.error?.code).toBe("23514");
    const okm = await owner.from("roast_measurements").insert({
      business_id: businessId,
      roast_batch_id: batchId,
      elapsed_seconds: 30,
      bt_c: 150.5,
      gas_kpa: 1.2,
      airflow_pct: 50,
      drum_speed_pct: 60,
    });
    expect(okm.error).toBeNull();
    // still completes fine with no first crack (unknown values allowed)
    expect((await complete(owner, batchId, 1260, { fc: null })).error).toBeNull();
    const { data: b } = await owner
      .from("roast_batches")
      .select("development_ratio_pct, first_crack_seconds")
      .eq("id", batchId)
      .single();
    expect(b).toMatchObject({ development_ratio_pct: null, first_crack_seconds: null });
  });

  it("warns on over-capacity drafts but only blocks at completion when the roaster policy says so", async () => {
    const g = await greenLot(6000);
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 2500 }],
      g.locationId,
    ); // > 2000 g capacity
    const { data: draft } = await owner
      .from("roast_batches")
      .select("status, green_weight_g")
      .eq("id", batchId)
      .single();
    expect(draft).toMatchObject({ status: "draft", green_weight_g: 2500 });
    await owner.from("roasters").update({ capacity_policy: "block" }).eq("id", roasterId);
    try {
      expect((await complete(owner, batchId, 2100)).error?.message).toMatch(
        /exceeds roaster capacity/,
      );
    } finally {
      await owner.from("roasters").update({ capacity_policy: "warn" }).eq("id", roasterId);
    }
    expect((await complete(owner, batchId, 2100)).error).toBeNull();
  });

  it("completed batches are immutable for stock-affecting fields and inputs", async () => {
    const g = await greenLot(3000);
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1500 }],
      g.locationId,
    );
    await complete(owner, batchId, 1260);
    const upd = await owner
      .from("roast_batches")
      .update({ roasted_weight_g: 1000 })
      .eq("id", batchId);
    expect(upd.error?.message).toMatch(/immutable/);
    const upd2 = await owner.from("roast_batches").update({ status: "draft" }).eq("id", batchId);
    expect(upd2.error?.message).toMatch(/immutable/);
    const notes = await owner
      .from("roast_batches")
      .update({ notes: "cupping: sweet, clean" })
      .eq("id", batchId)
      .select("notes")
      .single();
    expect(notes.data?.notes).toBe("cupping: sweet, clean");
    const { data: inputs } = await owner
      .from("roast_batch_inputs")
      .select("id")
      .eq("roast_batch_id", batchId);
    const admin = adminClient();
    const del = await admin.from("roast_batch_inputs").delete().eq("id", inputs![0].id);
    expect(del.error?.message).toMatch(/cannot be modified/);
    const edit = await owner.rpc("update_roast_batch_draft", {
      p_batch_id: batchId,
      p_roaster_id: roasterId,
      p_roast_profile_id: null as unknown as string,
      p_location_id: g.locationId,
      p_roast_date: "2026-11-01",
      p_operator_id: null as unknown as string,
      p_inputs: [{ green_lot_id: g.lotId, input_weight_g: 100 }] as unknown as Json,
      p_notes: null as unknown as string,
    });
    expect(edit.error?.message).toMatch(/cannot be edited/);
  });

  it("voiding a completed roast reverses stock and restores green cost; idempotent; refused once roasted stock is used", async () => {
    const g = await greenLot(3000, "500");
    const batchId = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1500 }],
      g.locationId,
    );
    await complete(owner, batchId, 1260, { costs: [{ cost_type: "lpg", amount: "25" }] });
    const before = await lotBalance(owner, g.lotId);
    expect(before.on_hand_g).toBe(1500);
    expect(before.stock_value).toBe(750);

    const key = uniq("void");
    expect(
      (
        await owner.rpc("void_roast_batch", {
          p_batch_id: batchId,
          p_reason: "",
          p_idempotency_key: key,
        })
      ).error?.message,
    ).toMatch(/reason/);
    expect(
      (
        await owner.rpc("void_roast_batch", {
          p_batch_id: batchId,
          p_reason: "Wrong lot selected",
          p_idempotency_key: key,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner.rpc("void_roast_batch", {
          p_batch_id: batchId,
          p_reason: "again",
          p_idempotency_key: key,
        })
      ).error,
    ).toBeNull();

    const after = await lotBalance(owner, g.lotId);
    expect(after.on_hand_g).toBe(3000);
    expect(after.stock_value).toBe(1500); // ₱750 restored
    expect(await onHand((await roastedItem(batchId))!)).toBe(0);
    const { data: b } = await owner
      .from("roast_batches")
      .select("status, void_reason")
      .eq("id", batchId)
      .single();
    expect(b).toMatchObject({ status: "voided", void_reason: "Wrong lot selected" });
    const { data: moves } = await owner
      .from("inventory_movements")
      .select("movement_type")
      .eq("source_id", batchId)
      .order("created_at");
    expect(moves?.map((m) => m.movement_type)).toEqual(["roast_output", "roast_void_consume"]);

    // a second completed roast whose roasted stock has been partly consumed cannot be voided
    const batch2 = await createBatch(
      owner,
      [{ green_lot_id: g.lotId, input_weight_g: 1000 }],
      g.locationId,
    );
    await complete(owner, batch2, 850, { costs: [] });
    const rItem = await roastedItem(batch2);
    await owner.rpc("create_inventory_adjustment", {
      p_business_id: businessId,
      p_reason: "sample",
      p_notes: null as unknown as string,
      p_lines: [
        {
          inventory_item_id: rItem,
          location_id: g.locationId,
          quantity_delta: -50,
          unit_cost: null,
          notes: null,
        },
      ] as unknown as Json,
      p_idempotency_key: uniq("adj"),
      p_post: true,
    });
    expect(
      (
        await owner.rpc("void_roast_batch", {
          p_batch_id: batch2,
          p_reason: "late",
          p_idempotency_key: uniq("void"),
        })
      ).error?.message,
    ).toMatch(/already been used/);
    const { data: recon } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(recon).toEqual([]);
  });

  it("enforces roles and business isolation", async () => {
    const g = await greenLot(2000);
    const batchId = await createBatch(
      roaster,
      [{ green_lot_id: g.lotId, input_weight_g: 1000 }],
      g.locationId,
    );
    expect(batchId).toBeTruthy(); // roaster role can create
    expect(
      (await viewer.from("roast_batch_summary_view").select("id").eq("id", batchId)).data,
    ).toHaveLength(1);
    const asViewer = await createBatch(
      viewer,
      [{ green_lot_id: g.lotId, input_weight_g: 100 }],
      g.locationId,
    ).catch((e) => e);
    expect(String(asViewer.message)).toMatch(/FORBIDDEN/);
    expect(
      (
        await viewer.rpc("complete_roast_batch", {
          p_batch_id: batchId,
          p_roasted_weight_g: 850,
          p_roast_level: null as unknown as string,
          p_total_duration_seconds: 600,
          p_first_crack_seconds: null as unknown as number,
          p_charge_bt_c: null as unknown as number,
          p_charge_et_c: null as unknown as number,
          p_first_crack_bt_c: null as unknown as number,
          p_drop_bt_c: null as unknown as number,
          p_costs: [] as unknown as Json,
          p_notes: null as unknown as string,
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    expect((await other.from("roast_batches").select("id").eq("id", batchId)).data).toEqual([]);
    const foreign = await createBatch(
      other,
      [{ green_lot_id: g.lotId, input_weight_g: 100 }],
      g.locationId,
    ).catch((e) => e);
    expect(String(foreign.message)).toMatch(/FORBIDDEN/);
  });
});
