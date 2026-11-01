import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const SEED = {
  business: { name: "Kape Roastery", slug: "kape-roastery" },
  owner: { email: "owner@coffee.test", password: "OwnerPass123!" },
  roaster: { email: "roaster@coffee.test", password: "RoasterPass123!" },
  inventory: { email: "inventory@coffee.test", password: "InventoryPass123!" },
  sales: { email: "sales@coffee.test", password: "SalesPass123!" },
  viewer: { email: "viewer@coffee.test", password: "ViewerPass123!" },
  otherOwner: { email: "other-owner@coffee.test", password: "OtherPass123!" },
} as const;

export function adminClient(): Db {
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function userClient(user: { email: string; password: string }): Promise<Db> {
  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword(user);
  if (error) throw new Error(`Sign-in failed for ${user.email}: ${error.message}`);
  return client;
}

export async function businessIdFor(db: Db, slug: string = SEED.business.slug): Promise<string> {
  const { data, error } = await db.from("businesses").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id;
}

export function uniq(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates an isolated supplier + green coffee pair for a test (owned by the Kape business). */
export async function createMasterFixtures(db: Db, businessId: string) {
  const { data: supplier, error: sErr } = await db
    .from("suppliers")
    .insert({ business_id: businessId, name: uniq("Supplier") })
    .select("*")
    .single();
  if (sErr) throw sErr;
  const { data: coffee, error: cErr } = await db
    .from("green_coffees")
    .insert({
      business_id: businessId,
      name: uniq("Coffee"),
      country: "Philippines",
      processing_method: "Washed",
    })
    .select("*")
    .single();
  if (cErr) throw cErr;
  const { data: location, error: lErr } = await db
    .from("inventory_locations")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .single();
  if (lErr) throw lErr;
  return { supplier, coffee, location };
}

export async function createConfirmedPurchase(
  db: Db,
  businessId: string,
  args: {
    supplierId: string;
    coffeeId: string;
    grams: number;
    unitCost: string;
    additionalCosts?: string;
  },
) {
  const { data: poId, error } = await db.rpc("create_purchase_order", {
    p_business_id: businessId,
    p_supplier_id: args.supplierId,
    p_ordered_at: "2026-10-31",
    p_notes: null as unknown as string,
    p_additional_costs: Number(args.additionalCosts ?? "0"),
    p_items: [
      { green_coffee_id: args.coffeeId, ordered_quantity_g: args.grams, unit_cost: args.unitCost },
    ],
    p_idempotency_key: uniq("po"),
  });
  if (error) throw error;
  const { error: cErr } = await db.rpc("confirm_purchase_order", { p_purchase_order_id: poId });
  if (cErr) throw cErr;
  const { data: items, error: iErr } = await db
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", poId);
  if (iErr) throw iErr;
  return { poId, items };
}

export async function createReceipt(
  db: Db,
  args: {
    poId: string;
    locationId: string;
    items: {
      purchase_order_item_id: string;
      received_quantity_g: number;
      allocated_landed_cost?: string;
      lot_code?: string;
    }[];
    additionalCosts?: string;
    idempotencyKey?: string;
  },
) {
  const { data, error } = await db.rpc("create_goods_receipt", {
    p_purchase_order_id: args.poId,
    p_location_id: args.locationId,
    p_received_at: "2026-10-31",
    p_additional_costs: Number(args.additionalCosts ?? "0"),
    p_notes: null as unknown as string,
    p_items: args.items.map((i) => ({
      purchase_order_item_id: i.purchase_order_item_id,
      received_quantity_g: i.received_quantity_g,
      allocated_landed_cost: i.allocated_landed_cost ?? "0",
      green_lot_id: null,
      new_lot: {
        lot_code: i.lot_code ?? null,
        moisture_pct: null,
        density_g_per_100ml: null,
        notes: null,
      },
    })),
    p_idempotency_key: args.idempotencyKey ?? uniq("grn"),
  });
  if (error) throw error;
  return data;
}

export async function postReceipt(db: Db, receiptId: string) {
  const { data, error } = await db.rpc("post_goods_receipt", { p_receipt_id: receiptId });
  if (error) throw error;
  return data;
}

export async function lotBalance(db: Db, lotId: string) {
  const { data, error } = await db
    .from("green_lot_inventory_view")
    .select("*")
    .eq("lot_id", lotId)
    .single();
  if (error) throw error;
  return data;
}

export async function lotsForReceipt(db: Db, receiptId: string) {
  const { data, error } = await db
    .from("goods_receipt_items")
    .select("green_lot_id, received_quantity_g, total_cost")
    .eq("receipt_id", receiptId);
  if (error) throw error;
  return data;
}

export async function movementCount(db: Db, inventoryItemId: string) {
  const { count, error } = await db
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("inventory_item_id", inventoryItemId);
  if (error) throw error;
  return count ?? 0;
}

/** PostgREST returns at most 1,000 rows per request; page through everything for whole-table checks. */
export async function fetchAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}
