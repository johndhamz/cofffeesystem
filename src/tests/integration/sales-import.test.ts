import { beforeAll, describe, expect, it } from "vitest";
import { businessIdFor, SEED, uniq, userClient, type Db } from "./helpers";

/** import_sales_history: opening lots + backdated fulfilled orders in one transaction, idempotent. */
let owner: Db;
let viewer: Db;
let businessId: string;
let locationId: string;
let channelId: string;

async function variant(name: string, price = 350) {
  const { data: product } = await owner
    .from("products")
    .insert({ business_id: businessId, name: uniq(name) })
    .select("id")
    .single();
  const { data: v, error } = await owner
    .from("product_variants")
    .insert({
      business_id: businessId,
      product_id: product!.id,
      sku: uniq("SKU").replace(/\s/g, "-"),
      name: "250 g",
      net_weight_g: 250,
      selling_price: price,
    })
    .select("id")
    .single();
  if (error) throw error;
  return v!.id;
}

beforeAll(async () => {
  owner = await userClient(SEED.owner);
  viewer = await userClient(SEED.viewer);
  businessId = await businessIdFor(owner);
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
      .eq("is_active", true)
      .limit(1)
      .single()
  ).data!.id;
});

describe("import_sales_history", () => {
  it("creates opening stock, fulfilled backdated orders, payments and customers; re-running is a no-op", async () => {
    const v1 = await variant("Import Blend");
    const batch = uniq("b")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12);
    const customerName = uniq("Import Cafe");
    const args = {
      p_business_id: businessId,
      p_batch_key: batch,
      p_location_id: locationId,
      p_opening: [{ variant_id: v1, quantity: 8, unit_cost: 180, packaged_at: "2026-09-01" }],
      p_orders: [
        {
          key: "1",
          ordered_at: "2026-09-03",
          sales_channel_id: channelId,
          customer_name: null,
          notes: null,
          payment_method: "cash",
          payment_reference: null,
          paid_amount: 700,
          items: [{ product_variant_id: v1, quantity: 2, unit_price: 350 }],
        },
        {
          key: "2",
          ordered_at: "2026-09-05",
          sales_channel_id: channelId,
          customer_name: customerName,
          notes: "terms",
          payment_method: "bank_transfer",
          payment_reference: "INV-1",
          paid_amount: 0,
          items: [{ product_variant_id: v1, quantity: 5, unit_price: 300 }],
        },
      ],
    };
    const { data, error } = await owner.rpc("import_sales_history", args);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      orders_created: 2,
      orders_skipped: 0,
      lots_created: 1,
      units: 7,
      revenue: 2200,
    });

    // opening lot, consumed by the two orders: 8 in, 7 sold, 1 left
    const { data: lot } = await owner
      .from("finished_goods_lots")
      .select("id, lot_code, quantity, unit_cost, packaging_session_id")
      .eq("variant_id", v1)
      .single();
    expect(lot).toMatchObject({ quantity: 8, unit_cost: 180, packaging_session_id: null });
    expect(lot!.lot_code).toMatch(/^OPEN-/);
    const { data: avail } = await owner
      .from("variant_availability_view")
      .select("on_hand, available")
      .eq("variant_id", v1)
      .single();
    expect(avail).toMatchObject({ on_hand: 1, available: 1 });

    // orders are fulfilled on their own dates, with COGS from the opening cost
    const { data: created } = await owner
      .from("sales_orders")
      .select("id")
      .like("idempotency_key", `import:${batch}:order:%`);
    const { data: orders } = await owner
      .from("sales_order_summary_view")
      .select("status, payment_status, ordered_at, total_amount, total_cogs")
      .in(
        "id",
        created!.map((o) => o.id),
      )
      .order("ordered_at");
    expect(
      orders!.map((o) => [
        o.status,
        o.ordered_at,
        Number(o.total_amount),
        Number(o.total_cogs),
        o.payment_status,
      ]),
    ).toEqual([
      ["completed", "2026-09-03", 700, 360, "paid"],
      ["fulfilled", "2026-09-05", 1500, 900, "unpaid"],
    ]);
    const { data: cust } = await owner
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", customerName);
    expect(cust).toHaveLength(1);

    // profitability for September includes the imported revenue and cost
    const { data: lines } = await owner
      .from("report_sales_lines_view")
      .select("net_revenue, cogs")
      .eq("variant_id", v1);
    expect(lines!.reduce((s, l) => s + Number(l.net_revenue), 0)).toBe(2200);
    expect(lines!.reduce((s, l) => s + Number(l.cogs), 0)).toBe(1260);

    // same batch again: nothing duplicated
    const again = await owner.rpc("import_sales_history", args);
    expect(again.error).toBeNull();
    expect(again.data).toMatchObject({ orders_created: 0, orders_skipped: 2, lots_created: 0 });
    expect(
      (await owner.from("finished_goods_lots").select("id").eq("variant_id", v1)).data,
    ).toHaveLength(1);
    expect((await owner.from("customers").select("id").eq("name", customerName)).data).toHaveLength(
      1,
    );
    expect(
      (
        await owner
          .from("variant_availability_view")
          .select("on_hand")
          .eq("variant_id", v1)
          .single()
      ).data?.on_hand,
    ).toBe(1);
  });

  it("is all-or-nothing: a bad order rolls back the opening stock", async () => {
    const v = await variant("Rollback Blend");
    const batch = uniq("r")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12);
    const { error } = await owner.rpc("import_sales_history", {
      p_business_id: businessId,
      p_batch_key: batch,
      p_location_id: locationId,
      p_opening: [{ variant_id: v, quantity: 1, unit_cost: 100, packaged_at: "2026-09-01" }],
      p_orders: [
        {
          key: "1",
          ordered_at: "2026-09-03",
          sales_channel_id: channelId,
          customer_name: null,
          notes: null,
          payment_method: "cash",
          payment_reference: null,
          paid_amount: 0,
          items: [{ product_variant_id: v, quantity: 3, unit_price: 10 }],
        },
      ],
    });
    expect(error?.message).toMatch(/INSUFFICIENT_STOCK/);
    expect((await owner.from("finished_goods_lots").select("id").eq("variant_id", v)).data).toEqual(
      [],
    );
    expect(
      (await owner.from("sales_order_items").select("id").eq("product_variant_id", v)).data,
    ).toEqual([]);
  });

  it("requires sales.manage and inventory.adjust", async () => {
    const { error } = await viewer.rpc("import_sales_history", {
      p_business_id: businessId,
      p_batch_key: "viewer-batch",
      p_location_id: locationId,
      p_opening: [],
      p_orders: [],
    });
    expect(error?.message).toMatch(/FORBIDDEN/);
  });
});
