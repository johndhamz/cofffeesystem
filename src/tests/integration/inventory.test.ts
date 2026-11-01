import { beforeAll, describe, expect, it } from "vitest";
import {
  businessIdFor,
  createConfirmedPurchase,
  createMasterFixtures,
  createReceipt,
  lotBalance,
  lotsForReceipt,
  movementCount,
  postReceipt,
  SEED,
  uniq,
  userClient,
  type Db,
} from "./helpers";

let owner: Db;
let viewer: Db;
let inventory: Db;
let other: Db;
let businessId: string;

beforeAll(async () => {
  [owner, viewer, inventory, other] = await Promise.all([
    userClient(SEED.owner),
    userClient(SEED.viewer),
    userClient(SEED.inventory),
    userClient(SEED.otherOwner),
  ]);
  businessId = await businessIdFor(owner);
});

async function setupPurchase(grams = 10_000, unitCost = "450", additionalCosts = "0") {
  const fx = await createMasterFixtures(owner, businessId);
  const po = await createConfirmedPurchase(owner, businessId, {
    supplierId: fx.supplier.id,
    coffeeId: fx.coffee.id,
    grams,
    unitCost,
    additionalCosts,
  });
  return { ...fx, ...po, item: po.items[0] };
}

describe("purchase workflow", () => {
  it("a purchase order alone does not increase stock", async () => {
    const { poId, coffee } = await setupPurchase();
    const { data: lots } = await owner
      .from("green_coffee_lots")
      .select("id")
      .eq("green_coffee_id", coffee.id);
    expect(lots).toEqual([]);
    const { data: po } = await owner
      .from("purchase_orders")
      .select("status, subtotal, total")
      .eq("id", poId)
      .single();
    expect(po).toMatchObject({ status: "confirmed", subtotal: 4500, total: 4500 });
  });

  it("draft items cannot be changed after confirmation", async () => {
    const { poId, item } = await setupPurchase();
    const upd = await owner
      .from("purchase_order_items")
      .update({ ordered_quantity_g: 1 })
      .eq("id", item.id)
      .select("id");
    // RLS has no update policy for purchase_order_items: zero rows affected
    expect(upd.data).toEqual([]);
    const { error } = await owner.rpc("update_purchase_order_draft", {
      p_purchase_order_id: poId,
      p_supplier_id: item.business_id,
      p_ordered_at: "2026-10-31",
      p_notes: null as unknown as string,
      p_additional_costs: 0,
      p_items: [],
    });
    expect(error?.message).toMatch(/only draft/);
  });

  it("receiving 10 kg posts exactly 10,000 g of green stock once", async () => {
    const { poId, item, location } = await setupPurchase(10_000, "450");
    const receiptId = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [
        { purchase_order_item_id: item.id, received_quantity_g: 10_000, lot_code: uniq("LOT") },
      ],
    });
    await postReceipt(owner, receiptId);

    const [lot] = await lotsForReceipt(owner, receiptId);
    const balance = await lotBalance(owner, lot.green_lot_id);
    expect(balance.on_hand_g).toBe(10_000);
    expect(balance.available_g).toBe(10_000);
    expect(balance.received_quantity_g).toBe(10_000);
    expect(balance.total_received_cost).toBe(4500);
    expect(balance.cost_per_kg).toBe(450);
    expect(balance.stock_value).toBe(4500);
    expect(await movementCount(owner, balance.inventory_item_id!)).toBe(1);

    const { data: po } = await owner
      .from("purchase_orders")
      .select("status")
      .eq("id", poId)
      .single();
    expect(po?.status).toBe("received");
    const { data: receipt } = await owner
      .from("goods_receipts")
      .select("status, posted_at, posted_by")
      .eq("id", receiptId)
      .single();
    expect(receipt?.status).toBe("posted");
    expect(receipt?.posted_by).not.toBeNull();
  });

  it("posting the same receipt repeatedly never duplicates inventory", async () => {
    const { poId, item, location } = await setupPurchase();
    const receiptId = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 10_000 }],
    });
    await postReceipt(owner, receiptId);
    await postReceipt(owner, receiptId);
    await postReceipt(owner, receiptId);
    const [lot] = await lotsForReceipt(owner, receiptId);
    const balance = await lotBalance(owner, lot.green_lot_id);
    expect(balance.on_hand_g).toBe(10_000);
    expect(await movementCount(owner, balance.inventory_item_id!)).toBe(1);
  });

  it("re-submitting a receipt with the same idempotency key returns the same receipt", async () => {
    const { poId, item, location } = await setupPurchase();
    const key = uniq("idem");
    const first = await createReceipt(owner, {
      poId,
      locationId: location.id,
      idempotencyKey: key,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 4000 }],
    });
    const second = await createReceipt(owner, {
      poId,
      locationId: location.id,
      idempotencyKey: key,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 4000 }],
    });
    expect(second).toBe(first);
    const { count } = await owner
      .from("goods_receipts")
      .select("id", { count: "exact", head: true })
      .eq("purchase_order_id", poId);
    expect(count).toBe(1);
  });

  it("concurrent posts of one receipt create exactly one movement", async () => {
    const { poId, item, location } = await setupPurchase();
    const receiptId = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 10_000 }],
    });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => postReceipt(owner, receiptId)),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const [lot] = await lotsForReceipt(owner, receiptId);
    const balance = await lotBalance(owner, lot.green_lot_id);
    expect(balance.on_hand_g).toBe(10_000);
    expect(await movementCount(owner, balance.inventory_item_id!)).toBe(1);
  });

  it("supports partial receipts and multiple receipts per purchase order", async () => {
    const { poId, item, location } = await setupPurchase(10_000, "450");
    const r1 = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 6000 }],
    });
    await postReceipt(owner, r1);
    let { data: po } = await owner.from("purchase_orders").select("status").eq("id", poId).single();
    expect(po?.status).toBe("partially_received");

    const r2 = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 4000 }],
    });
    await postReceipt(owner, r2);
    ({ data: po } = await owner.from("purchase_orders").select("status").eq("id", poId).single());
    expect(po?.status).toBe("received");

    const { data: poItem } = await owner
      .from("purchase_order_items")
      .select("received_quantity_g")
      .eq("id", item.id)
      .single();
    expect(poItem?.received_quantity_g).toBe(10_000);

    const lot1 = await lotBalance(owner, (await lotsForReceipt(owner, r1))[0].green_lot_id);
    const lot2 = await lotBalance(owner, (await lotsForReceipt(owner, r2))[0].green_lot_id);
    expect(lot1.on_hand_g).toBe(6000);
    expect(lot2.on_hand_g).toBe(4000);
    expect(lot1.total_received_cost).toBe(2700);
    expect(lot2.total_received_cost).toBe(1800);
  });

  it("rejects receiving more than ordered", async () => {
    const { poId, item, location } = await setupPurchase(10_000);
    const r1 = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 8000 }],
    });
    await postReceipt(owner, r1);
    const r2 = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: 3000 }],
    });
    await expect(postReceipt(owner, r2)).rejects.toMatchObject({
      message: expect.stringMatching(/OVER_RECEIPT/),
    });
    const { data: receipt } = await owner
      .from("goods_receipts")
      .select("status")
      .eq("id", r2)
      .single();
    expect(receipt?.status).toBe("draft");
  });

  it("allocates PO-level and receipt-level landed costs into lot cost and preserves them", async () => {
    // 10 kg @ ₱450 = ₱4,500; PO freight ₱300; receipt handling ₱50.25
    const { poId, item, location } = await setupPurchase(10_000, "450", "300");
    const receiptId = await createReceipt(owner, {
      poId,
      locationId: location.id,
      additionalCosts: "50.25",
      items: [
        {
          purchase_order_item_id: item.id,
          received_quantity_g: 10_000,
          allocated_landed_cost: "50.25",
        },
      ],
    });
    await postReceipt(owner, receiptId);
    const { data: line } = await owner
      .from("goods_receipt_items")
      .select("purchase_cost, po_cost_share, allocated_landed_cost, total_cost, green_lot_id")
      .eq("receipt_id", receiptId)
      .single();
    expect(line).toMatchObject({
      purchase_cost: 4500,
      po_cost_share: 300,
      allocated_landed_cost: 50.25,
      total_cost: 4850.25,
    });
    const balance = await lotBalance(owner, line!.green_lot_id);
    expect(balance.total_received_cost).toBe(4850.25);
    expect(balance.cost_per_kg).toBe(485.03);

    // A later purchase of the same coffee at a different price must not change this lot's cost.
    const po2 = await createConfirmedPurchase(owner, businessId, {
      supplierId: balance.supplier_id!,
      coffeeId: balance.green_coffee_id,
      grams: 5000,
      unitCost: "600",
    });
    const r2 = await createReceipt(owner, {
      poId: po2.poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: po2.items[0].id, received_quantity_g: 5000 }],
    });
    await postReceipt(owner, r2);
    const again = await lotBalance(owner, line!.green_lot_id);
    expect(again.total_received_cost).toBe(4850.25);
    expect(again.cost_per_kg).toBe(485.03);
    const second = await lotBalance(owner, (await lotsForReceipt(owner, r2))[0].green_lot_id);
    expect(second.cost_per_kg).toBe(600);
  });

  it("rejects a receipt whose allocated landed costs do not sum to the receipt total", async () => {
    const { poId, item, location } = await setupPurchase();
    await expect(
      createReceipt(owner, {
        poId,
        locationId: location.id,
        additionalCosts: "100",
        items: [
          {
            purchase_order_item_id: item.id,
            received_quantity_g: 1000,
            allocated_landed_cost: "40",
          },
        ],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/allocated landed costs/) });
  });

  it("cannot receive against a draft or cancelled purchase order", async () => {
    const fx = await createMasterFixtures(owner, businessId);
    const { data: poId } = await owner.rpc("create_purchase_order", {
      p_business_id: businessId,
      p_supplier_id: fx.supplier.id,
      p_ordered_at: "2026-10-31",
      p_notes: null as unknown as string,
      p_additional_costs: 0,
      p_items: [{ green_coffee_id: fx.coffee.id, ordered_quantity_g: 1000, unit_cost: "400" }],
      p_idempotency_key: uniq("po"),
    });
    const { data: items } = await owner
      .from("purchase_order_items")
      .select("id")
      .eq("purchase_order_id", poId!);
    await expect(
      createReceipt(owner, {
        poId: poId!,
        locationId: fx.location.id,
        items: [{ purchase_order_item_id: items![0].id, received_quantity_g: 1000 }],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/must be confirmed/) });
    await owner.rpc("cancel_purchase_order", { p_purchase_order_id: poId! });
    const { data: po } = await owner
      .from("purchase_orders")
      .select("status")
      .eq("id", poId!)
      .single();
    expect(po?.status).toBe("cancelled");
  });
});

describe("inventory ledger", () => {
  async function receivedLot(grams = 10_000) {
    const { poId, item, location, coffee } = await setupPurchase(grams, "450");
    const receiptId = await createReceipt(owner, {
      poId,
      locationId: location.id,
      items: [{ purchase_order_item_id: item.id, received_quantity_g: grams }],
    });
    await postReceipt(owner, receiptId);
    const [lot] = await lotsForReceipt(owner, receiptId);
    const balance = await lotBalance(owner, lot.green_lot_id);
    return {
      lotId: lot.green_lot_id,
      itemId: balance.inventory_item_id!,
      locationId: location.id,
      coffee,
    };
  }

  function adjust(
    db: Db,
    args: { itemId: string; locationId: string; delta: number; key?: string; unitCost?: string },
  ) {
    return db.rpc("create_inventory_adjustment", {
      p_business_id: businessId,
      p_reason: "count_correction",
      p_notes: null as unknown as string,
      p_lines: [
        {
          inventory_item_id: args.itemId,
          location_id: args.locationId,
          quantity_delta: args.delta,
          unit_cost: args.unitCost ?? null,
          notes: null,
        },
      ],
      p_idempotency_key: args.key ?? uniq("adj"),
      p_post: true,
    });
  }

  it("movements are immutable", async () => {
    const { itemId } = await receivedLot();
    const { data: movement } = await owner
      .from("inventory_movements")
      .select("id")
      .eq("inventory_item_id", itemId)
      .single();
    const upd = await owner
      .from("inventory_movements")
      .update({ notes: "x" })
      .eq("id", movement!.id)
      .select("id");
    expect(upd.data).toEqual([]); // no RLS update policy
    const del = await owner
      .from("inventory_movements")
      .delete()
      .eq("id", movement!.id)
      .select("id");
    expect(del.data).toEqual([]);
    // even the service role is blocked by the immutability trigger
    const { adminClient } = await import("./helpers");
    const adminDel = await adminClient()
      .from("inventory_movements")
      .delete()
      .eq("id", movement!.id);
    expect(adminDel.error?.message).toMatch(/immutable/);
  });

  it("authenticated users cannot write ledger tables directly", async () => {
    const { itemId, locationId } = await receivedLot();
    const ins = await owner.from("inventory_movements").insert({
      business_id: businessId,
      inventory_item_id: itemId,
      location_id: locationId,
      quantity_delta: 999,
      movement_type: "adjustment",
      source_type: "hack",
      source_id: itemId,
      idempotency_key: uniq("hack"),
    });
    expect(ins.error?.code).toBe("42501");
    const bal = await owner
      .from("inventory_balances")
      .update({ on_hand_quantity: 999999 })
      .eq("inventory_item_id", itemId)
      .select("id");
    expect(bal.data).toEqual([]);
  });

  it("prevents negative stock", async () => {
    const { itemId, locationId } = await receivedLot(1000);
    const { error } = await adjust(owner, { itemId, locationId, delta: -1001 });
    expect(error?.message).toMatch(/INSUFFICIENT_STOCK/);
    const { data: balance } = await owner
      .from("inventory_balances")
      .select("on_hand_quantity")
      .eq("inventory_item_id", itemId)
      .single();
    expect(balance?.on_hand_quantity).toBe(1000);
    // the failed adjustment left nothing behind (transaction rolled back)
    const { count } = await owner
      .from("inventory_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "draft");
    expect(count).toBe(0);
  });

  it("concurrent consumption never overconsumes stock", async () => {
    const { itemId, locationId } = await receivedLot(10_000);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => adjust(owner, { itemId, locationId, delta: -3000 })),
    );
    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && !(r.value as { error: unknown }).error,
    ).length;
    expect(succeeded).toBe(3);
    const { data: balance } = await owner
      .from("inventory_balances")
      .select("on_hand_quantity")
      .eq("inventory_item_id", itemId)
      .single();
    expect(balance?.on_hand_quantity).toBe(1000);
  });

  it("duplicate adjustment submissions are idempotent", async () => {
    const { itemId, locationId } = await receivedLot(10_000);
    const key = uniq("adj");
    const a = await adjust(owner, { itemId, locationId, delta: -500, key });
    const b = await adjust(owner, { itemId, locationId, delta: -500, key });
    expect(a.data).toBe(b.data);
    const { data: balance } = await owner
      .from("inventory_balances")
      .select("on_hand_quantity")
      .eq("inventory_item_id", itemId)
      .single();
    expect(balance?.on_hand_quantity).toBe(9500);
  });

  it("reversing an adjustment restores the balance with an opposite movement", async () => {
    const { itemId, locationId } = await receivedLot(10_000);
    const { data: adjId } = await adjust(owner, { itemId, locationId, delta: -2500 });
    const { data: reversalId, error } = await owner.rpc("reverse_inventory_adjustment", {
      p_adjustment_id: adjId!,
      p_idempotency_key: uniq("rev"),
    });
    expect(error).toBeNull();
    const { data: balance } = await owner
      .from("inventory_balances")
      .select("on_hand_quantity")
      .eq("inventory_item_id", itemId)
      .single();
    expect(balance?.on_hand_quantity).toBe(10_000);
    const { data: moves } = await owner
      .from("inventory_movements")
      .select("movement_type, quantity_delta")
      .eq("inventory_item_id", itemId)
      .order("created_at");
    expect(moves?.map((m) => [m.movement_type, m.quantity_delta])).toEqual([
      ["receipt", 10_000],
      ["adjustment", -2500],
      ["adjustment_reversal", 2500],
    ]);
    const { data: original } = await owner
      .from("inventory_adjustments")
      .select("status")
      .eq("id", adjId!)
      .single();
    expect(original?.status).toBe("reversed");
    const { data: reversal } = await owner
      .from("inventory_adjustments")
      .select("status, reversal_of_adjustment_id")
      .eq("id", reversalId!)
      .single();
    expect(reversal).toMatchObject({ status: "posted", reversal_of_adjustment_id: adjId });
    // reversing twice is rejected
    const again = await owner.rpc("reverse_inventory_adjustment", {
      p_adjustment_id: adjId!,
      p_idempotency_key: uniq("rev"),
    });
    expect(again.error?.message).toMatch(/only posted/);
  });

  it("negative adjustments consume cost layers and keep valuation consistent", async () => {
    const { itemId, locationId, lotId } = await receivedLot(10_000); // ₱4,500
    await adjust(owner, { itemId, locationId, delta: -2000 });
    const balance = await lotBalance(owner, lotId);
    expect(balance.on_hand_g).toBe(8000);
    expect(balance.stock_value).toBe(3600);
    expect(balance.cost_per_kg).toBe(450);
  });

  it("balances always reconcile to the movement ledger", async () => {
    const { itemId, locationId } = await receivedLot(5000);
    await adjust(owner, { itemId, locationId, delta: -1000 });
    await adjust(owner, { itemId, locationId, delta: 250, unitCost: "0.45" });
    const { data } = await owner
      .from("inventory_reconciliation_view")
      .select("*")
      .eq("inventory_item_id", itemId)
      .single();
    expect(data).toMatchObject({ on_hand_quantity: 4250, ledger_quantity: 4250, difference: 0 });
    const { data: all } = await owner
      .from("inventory_reconciliation_view")
      .select("difference")
      .eq("business_id", businessId)
      .neq("difference", 0);
    expect(all).toEqual([]);
  });

  it("low-stock thresholds drive stock status", async () => {
    const { itemId, locationId, lotId } = await receivedLot(1000);
    await owner.from("inventory_items").update({ low_stock_threshold: 500 }).eq("id", itemId);
    expect((await lotBalance(owner, lotId)).stock_status).toBe("in_stock");
    await adjust(owner, { itemId, locationId, delta: -600 });
    expect((await lotBalance(owner, lotId)).stock_status).toBe("low_stock");
    await adjust(owner, { itemId, locationId, delta: -400 });
    expect((await lotBalance(owner, lotId)).stock_status).toBe("out_of_stock");
  });

  it("reservations reduce availability and block over-consumption", async () => {
    const { itemId, locationId, lotId } = await receivedLot(1000);
    const { data: resId, error } = await owner.rpc("reserve_inventory", {
      p_inventory_item_id: itemId,
      p_location_id: locationId,
      p_quantity: 800,
      p_source_type: "test",
      p_source_id: itemId,
      p_idempotency_key: uniq("res"),
    });
    expect(error).toBeNull();
    expect((await lotBalance(owner, lotId)).available_g).toBe(200);
    expect((await adjust(owner, { itemId, locationId, delta: -300 })).error?.message).toMatch(
      /INSUFFICIENT_STOCK/,
    );
    await owner.rpc("release_inventory_reservation", { p_reservation_id: resId! });
    expect((await lotBalance(owner, lotId)).available_g).toBe(1000);
  });

  it("enforces roles and business isolation on inventory operations", async () => {
    const { itemId, locationId, lotId, coffee } = await receivedLot(1000);
    // viewer: read only
    expect(
      (await viewer.from("green_lot_inventory_view").select("lot_id").eq("lot_id", lotId)).data,
    ).toHaveLength(1);
    expect((await adjust(viewer, { itemId, locationId, delta: -1 })).error?.message).toMatch(
      /FORBIDDEN/,
    );
    // inventory staff can adjust
    expect((await adjust(inventory, { itemId, locationId, delta: -1 })).error).toBeNull();
    // another business sees nothing and cannot act
    expect(
      (await other.from("green_lot_inventory_view").select("lot_id").eq("lot_id", lotId)).data,
    ).toEqual([]);
    expect(
      (await other.from("inventory_movements").select("id").eq("inventory_item_id", itemId)).data,
    ).toEqual([]);
    expect((await adjust(other, { itemId, locationId, delta: -1 })).error?.message).toMatch(
      /FORBIDDEN/,
    );
    expect((await other.from("green_coffees").select("id").eq("id", coffee.id)).data).toEqual([]);
  });
});
