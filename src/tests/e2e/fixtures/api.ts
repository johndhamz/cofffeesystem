import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { TEST_USERS } from "./users";

/**
 * API-based test setup: builds business data directly through the same Postgres functions the
 * app uses (as the signed-in owner, so RLS and permissions apply). Faster and more isolated than
 * clicking through every screen when a spec only needs preconditions.
 */
export type Api = SupabaseClient<Database>;

export async function ownerApi(): Promise<Api> {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  const { error } = await client.auth.signInWithPassword(TEST_USERS.owner);
  if (error) throw new Error(`API sign-in failed: ${error.message}`);
  return client;
}

export async function businessId(api: Api): Promise<string> {
  const { data, error } = await api.rpc("my_memberships");
  if (error || !data?.[0]) throw new Error("no business membership");
  return data[0].business_id;
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Green lot received with `grams` at `unitCost` ₱/kg. Returns ids + codes. */
export async function receivedGreenLot(
  api: Api,
  bid: string,
  opts: { coffeeName?: string; grams?: number; unitCost?: string; lotCode?: string } = {},
) {
  const grams = opts.grams ?? 10_000;
  const { data: supplier } = await api
    .from("suppliers")
    .insert({ business_id: bid, name: uniq("API Supplier") })
    .select("id, name")
    .single();
  const { data: coffee } = await api
    .from("green_coffees")
    .insert({
      business_id: bid,
      name: opts.coffeeName ?? uniq("API Coffee"),
      country: "Philippines",
      processing_method: "Natural",
    })
    .select("id, name")
    .single();
  const { data: location } = await api
    .from("inventory_locations")
    .select("id")
    .eq("business_id", bid)
    .eq("is_active", true)
    .limit(1)
    .single();
  const { data: poId, error } = await api.rpc("create_purchase_order", {
    p_business_id: bid,
    p_supplier_id: supplier!.id,
    p_ordered_at: "2026-11-01",
    p_notes: null as unknown as string,
    p_additional_costs: 0,
    p_items: [
      { green_coffee_id: coffee!.id, ordered_quantity_g: grams, unit_cost: opts.unitCost ?? "450" },
    ] as unknown as Json,
    p_idempotency_key: uniq("po"),
  });
  if (error) throw error;
  await api.rpc("confirm_purchase_order", { p_purchase_order_id: poId! });
  const { data: items } = await api
    .from("purchase_order_items")
    .select("id")
    .eq("purchase_order_id", poId!);
  const lotCode = opts.lotCode ?? uniq("LOT-API").replace(/\s/g, "-");
  const { data: rid, error: rErr } = await api.rpc("create_goods_receipt", {
    p_purchase_order_id: poId!,
    p_location_id: location!.id,
    p_received_at: "2026-11-01",
    p_additional_costs: 0,
    p_notes: null as unknown as string,
    p_items: [
      {
        purchase_order_item_id: items![0].id,
        received_quantity_g: grams,
        allocated_landed_cost: "0",
        green_lot_id: null,
        new_lot: { lot_code: lotCode, moisture_pct: null, density_g_per_100ml: null, notes: null },
      },
    ] as unknown as Json,
    p_idempotency_key: uniq("grn"),
  });
  if (rErr) throw rErr;
  await api.rpc("post_goods_receipt", { p_receipt_id: rid! });
  const { data: lot } = await api
    .from("green_coffee_lots")
    .select("id")
    .eq("lot_code", lotCode)
    .single();
  return {
    supplierName: supplier!.name,
    coffeeName: coffee!.name,
    lotCode,
    lotId: lot!.id,
    locationId: location!.id,
    purchaseOrderId: poId!,
  };
}

/** Completed roast of `greenG` → `roastedG` from a lot. Returns the batch number. */
export async function completedRoast(
  api: Api,
  bid: string,
  lotId: string,
  locationId: string,
  greenG = 1500,
  roastedG = 1260,
) {
  const { data: roaster } = await api
    .from("roasters")
    .select("id")
    .eq("business_id", bid)
    .eq("is_active", true)
    .limit(1)
    .single();
  const { data: batchId, error } = await api.rpc("create_roast_batch", {
    p_business_id: bid,
    p_roaster_id: roaster!.id,
    p_roast_profile_id: null as unknown as string,
    p_location_id: locationId,
    p_roast_date: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: [{ green_lot_id: lotId, input_weight_g: greenG }] as unknown as Json,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("rb"),
  });
  if (error) throw error;
  const { error: cErr } = await api.rpc("complete_roast_batch", {
    p_batch_id: batchId!,
    p_roasted_weight_g: roastedG,
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
  if (cErr) throw cErr;
  const { data: b } = await api
    .from("roast_batches")
    .select("batch_number")
    .eq("id", batchId!)
    .single();
  return { batchId: batchId!, batchNumber: b!.batch_number };
}

/** Product with one 250 g variant (+ optional bag material with stock). */
export async function productWithVariant(
  api: Api,
  bid: string,
  opts: { name?: string; netWeightG?: number; price?: number; withBag?: boolean } = {},
) {
  const { data: product } = await api
    .from("products")
    .insert({ business_id: bid, name: opts.name ?? uniq("API Product") })
    .select("id, name")
    .single();
  const sku = uniq("API").replace(/\s/g, "-");
  const { data: variant } = await api
    .from("product_variants")
    .insert({
      business_id: bid,
      product_id: product!.id,
      sku,
      name: `${opts.netWeightG ?? 250} g bag`,
      net_weight_g: opts.netWeightG ?? 250,
      selling_price: opts.price ?? 350,
    })
    .select("id")
    .single();
  let materialName: string | undefined;
  if (opts.withBag) {
    const { data: bag } = await api
      .from("packaging_materials")
      .insert({ business_id: bid, name: uniq("API Bag"), base_unit: "pc", standard_unit_cost: 8 })
      .select("id, name")
      .single();
    materialName = bag!.name;
    await api.from("variant_materials").insert({
      business_id: bid,
      variant_id: variant!.id,
      material_id: bag!.id,
      quantity_per_unit: 1,
    });
    const { data: item } = await api
      .from("inventory_items")
      .select("id")
      .eq("item_type", "packaging_material")
      .eq("reference_id", bag!.id)
      .single();
    const { data: location } = await api
      .from("inventory_locations")
      .select("id")
      .eq("business_id", bid)
      .eq("is_active", true)
      .limit(1)
      .single();
    await api.rpc("create_inventory_adjustment", {
      p_business_id: bid,
      p_reason: "count_correction",
      p_notes: "api setup",
      p_lines: [
        {
          inventory_item_id: item!.id,
          location_id: location!.id,
          quantity_delta: 100,
          unit_cost: "8",
          notes: null,
        },
      ] as unknown as Json,
      p_idempotency_key: uniq("adj"),
      p_post: true,
    });
  }
  return {
    productId: product!.id,
    productName: product!.name,
    variantId: variant!.id,
    sku,
    materialName,
  };
}

/** Finished lot of `units` bags from a roast batch (session with ₱50 labor). */
export async function packagedBags(
  api: Api,
  bid: string,
  batchId: string,
  variantId: string,
  locationId: string,
  units = 5,
  lotCode?: string,
) {
  const code = lotCode ?? uniq("FG-API").replace(/\s/g, "-");
  const { data: sid, error } = await api.rpc("create_packaging_session", {
    p_business_id: bid,
    p_location_id: locationId,
    p_packaged_at: "2026-11-01",
    p_operator_id: null as unknown as string,
    p_inputs: [{ roast_batch_id: batchId, input_weight_g: units * 250 }] as unknown as Json,
    p_outputs: [{ variant_id: variantId, quantity: units, lot_code: code }] as unknown as Json,
    p_materials: null as unknown as Json,
    p_labor_cost: 50,
    p_overhead_cost: 0,
    p_notes: null as unknown as string,
    p_idempotency_key: uniq("pk"),
  });
  if (error) throw error;
  const { error: cErr } = await api.rpc("complete_packaging_session", { p_session_id: sid! });
  if (cErr) throw cErr;
  return { sessionId: sid!, lotCode: code };
}

export async function customer(api: Api, bid: string, name?: string) {
  const { data } = await api
    .from("customers")
    .insert({ business_id: bid, name: name ?? uniq("API Customer"), customer_type: "retail" })
    .select("id, name")
    .single();
  return data!;
}

export async function dashboardMetrics(
  api: Api,
  bid: string,
  from = "2026-01-01",
  to = "2026-12-31",
) {
  const { data, error } = await api.rpc("dashboard_metrics", {
    p_business_id: bid,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data as Record<string, number>;
}
