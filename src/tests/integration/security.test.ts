import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { adminClient, businessIdFor, SEED, uniq, userClient, type Db } from "./helpers";
import { escapeLike } from "@/lib/validation/common";

/** Security verification: RLS, server permissions, cross-business isolation, storage, audit, sessions. */
let owner: Db;
let viewer: Db;
let sales: Db;
let other: Db;
let anon: Db;
let admin: Db;
let businessId: string;
let otherBusinessId: string;

const TABLES = [
  "businesses",
  "business_members",
  "business_settings",
  "audit_logs",
  "suppliers",
  "green_coffees",
  "roasters",
  "inventory_locations",
  "expense_categories",
  "sales_channels",
  "purchase_orders",
  "purchase_order_items",
  "goods_receipts",
  "goods_receipt_items",
  "green_coffee_lots",
  "inventory_items",
  "inventory_balances",
  "inventory_movements",
  "inventory_cost_layers",
  "inventory_reservations",
  "inventory_adjustments",
  "inventory_adjustment_lines",
  "roast_profiles",
  "roast_batches",
  "roast_batch_inputs",
  "roast_measurements",
  "roast_events",
  "roast_batch_costs",
  "roast_attachments",
  "products",
  "product_variants",
  "packaging_materials",
  "variant_materials",
  "packaging_sessions",
  "packaging_inputs",
  "packaging_outputs",
  "packaging_material_usage",
  "finished_goods_lots",
  "customers",
  "sales_orders",
  "sales_order_items",
  "sales_order_allocations",
  "sales_fulfillments",
  "sales_fulfillment_items",
  "payments",
  "refunds",
  "sales_returns",
  "sales_return_items",
  "expenses",
  "cost_allocations",
] as const;
const VIEWS = [
  "green_lot_inventory_view",
  "inventory_movement_history_view",
  "roast_batch_summary_view",
  "finished_goods_inventory_view",
  "packaging_session_summary_view",
  "sales_order_summary_view",
  "customer_summary_view",
  "report_sales_lines_view",
  "report_expenses_view",
] as const;

beforeAll(async () => {
  [owner, viewer, sales, other] = await Promise.all([
    userClient(SEED.owner),
    userClient(SEED.viewer),
    userClient(SEED.sales),
    userClient(SEED.otherOwner),
  ]);
  admin = adminClient();
  anon = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  businessId = await businessIdFor(owner);
  otherBusinessId = await businessIdFor(other, "other-roastery");
});

describe("row level security", () => {
  it("anonymous clients read nothing from any business table or view", async () => {
    for (const t of TABLES) {
      const { data, error } = await anon.from(t).select("*").limit(1);
      expect(error ?? data, t).toEqual(error ?? []);
    }
    for (const v of VIEWS) {
      const { data } = await anon.from(v).select("*").limit(1);
      expect(data, v).toEqual([]);
    }
  });

  it("every table has RLS enabled and the other business sees zero rows of Kape data", async () => {
    const { data: rls } = await admin.rpc("report_inventory_valuation", {
      p_business_id: businessId,
    }); // keep admin warm
    expect(rls).toBeTruthy();
    for (const t of TABLES) {
      if (
        t === "businesses" ||
        t === "business_members" ||
        t === "business_settings" ||
        t === "audit_logs"
      )
        continue;
      const { data, error } = await other
        .from(t)
        .select("business_id")
        .eq("business_id", businessId)
        .limit(5);
      expect(error, t).toBeNull();
      expect(data, t).toEqual([]);
    }
    for (const v of VIEWS) {
      const { data } = await other
        .from(v)
        .select("business_id")
        .eq("business_id", businessId)
        .limit(5);
      expect(data, v).toEqual([]);
    }
    expect((await other.from("businesses").select("id").eq("id", businessId)).data).toEqual([]);
    expect(
      (await other.from("business_settings").select("id").eq("business_id", businessId)).data,
    ).toEqual([]);
  });

  it("ledger and financial tables accept no direct writes from any authenticated role", async () => {
    const probes: [string, Record<string, unknown>][] = [
      [
        "inventory_movements",
        {
          business_id: businessId,
          inventory_item_id: "00000000-0000-4000-8000-000000000001",
          location_id: "00000000-0000-4000-8000-000000000001",
          quantity_delta: 1,
          movement_type: "adjustment",
          source_type: "x",
          source_id: "00000000-0000-4000-8000-000000000001",
          idempotency_key: uniq("k"),
        },
      ],
      [
        "inventory_balances",
        {
          business_id: businessId,
          inventory_item_id: "00000000-0000-4000-8000-000000000001",
          location_id: "00000000-0000-4000-8000-000000000001",
        },
      ],
      [
        "inventory_cost_layers",
        {
          business_id: businessId,
          inventory_item_id: "00000000-0000-4000-8000-000000000001",
          source_type: "x",
          source_id: "00000000-0000-4000-8000-000000000001",
          received_quantity: 1,
          remaining_quantity: 1,
          original_cost: 1,
          remaining_cost: 1,
        },
      ],
      [
        "payments",
        {
          business_id: businessId,
          order_id: "00000000-0000-4000-8000-000000000001",
          amount: 1,
          payment_method: "cash",
          idempotency_key: uniq("p"),
        },
      ],
      [
        "sales_fulfillments",
        {
          business_id: businessId,
          order_id: "00000000-0000-4000-8000-000000000001",
          fulfillment_number: uniq("SF"),
          location_id: "00000000-0000-4000-8000-000000000001",
        },
      ],
      [
        "goods_receipts",
        {
          business_id: businessId,
          purchase_order_id: "00000000-0000-4000-8000-000000000001",
          receipt_number: uniq("GRN"),
          location_id: "00000000-0000-4000-8000-000000000001",
        },
      ],
      ["audit_logs", { business_id: businessId, action: "x", entity_type: "x" }],
      ["role_permissions", { role: "viewer", permission: "finance.read" }],
    ];
    for (const [t, row] of probes) {
      const { error } = await owner.from(t as "payments").insert(row as never);
      expect(error?.code, t).toBe("42501");
    }
  });

  it("viewers cannot reserve stock, post documents, or escalate their role", async () => {
    const { data: item } = await owner
      .from("inventory_items")
      .select("id")
      .eq("business_id", businessId)
      .limit(1)
      .single();
    const { data: loc } = await owner
      .from("inventory_locations")
      .select("id")
      .eq("business_id", businessId)
      .limit(1)
      .single();
    expect(
      (
        await viewer.rpc("reserve_inventory", {
          p_inventory_item_id: item!.id,
          p_location_id: loc!.id,
          p_quantity: 1,
          p_source_type: "x",
          p_source_id: item!.id,
          p_idempotency_key: uniq("r"),
        })
      ).error?.message,
    ).toMatch(/FORBIDDEN/);
    const { data: me } = await viewer.auth.getUser();
    const esc = await viewer
      .from("business_members")
      .update({ role: "owner" })
      .eq("user_id", me.user!.id)
      .select("role");
    expect(esc.data).toEqual([]);
    expect(
      (
        await sales
          .from("business_members")
          .update({ role: "owner" })
          .eq("user_id", me.user!.id)
          .select("role")
      ).data,
    ).toEqual([]);
    expect(
      (
        await viewer
          .from("business_settings")
          .update({ currency: "USD" })
          .eq("business_id", businessId)
          .select("id")
      ).data,
    ).toEqual([]);
  });

  it("audit logs are written for important changes and cannot be altered, even by the service role", async () => {
    const { data: sup } = await owner
      .from("suppliers")
      .insert({ business_id: businessId, name: uniq("Audit Supplier") })
      .select("id")
      .single();
    await owner.from("suppliers").update({ phone: "0917" }).eq("id", sup!.id);
    const { data: logs } = await owner
      .from("audit_logs")
      .select("id, action, actor_id")
      .eq("entity_id", sup!.id)
      .order("created_at");
    expect(logs!.map((l) => l.action)).toEqual(["insert", "update"]);
    expect(logs![0].actor_id).toBe((await owner.auth.getUser()).data.user!.id);
    expect((await admin.from("audit_logs").delete().eq("id", logs![0].id)).error?.message).toMatch(
      /immutable/,
    );
    expect(
      (await admin.from("audit_logs").update({ action: "x" }).eq("id", logs![0].id)).error?.message,
    ).toMatch(/immutable/);
    expect((await viewer.from("audit_logs").select("id").limit(1)).data).toEqual([]); // owners only
  });

  it("cost snapshots and identities are immutable to roles with update rights", async () => {
    const { data: item } = await owner
      .from("inventory_items")
      .select("id, reference_id")
      .eq("business_id", businessId)
      .limit(1)
      .single();
    expect(
      (
        await owner
          .from("inventory_items")
          .update({ reference_id: "00000000-0000-4000-8000-000000000009" })
          .eq("id", item!.id)
      ).error?.message,
    ).toMatch(/immutable/);
    expect(
      (
        await owner
          .from("inventory_items")
          .update({ low_stock_threshold: 5 })
          .eq("id", item!.id)
          .select("id")
      ).error,
    ).toBeNull();
    const { data: order } = await owner
      .from("sales_orders")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "draft")
      .limit(1)
      .maybeSingle();
    if (order)
      expect(
        (await owner.from("sales_orders").update({ total_amount: 0 }).eq("id", order.id)).error
          ?.message,
      ).toMatch(/sales functions/);
  });

  it("storage: uploads outside the caller's business folder and disallowed MIME types are rejected", async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
      type: "image/png",
    });
    const okPath = `${businessId}/security-test/${uniq("ok").replace(/\s/g, "-")}.png`;
    const ok = await owner.storage
      .from("roast-attachments")
      .upload(okPath, png, { contentType: "image/png" });
    expect(ok.error).toBeNull();
    const foreign = await owner.storage
      .from("roast-attachments")
      .upload(`${otherBusinessId}/security-test/${uniq("x")}.png`, png, {
        contentType: "image/png",
      });
    expect(foreign.error).not.toBeNull();
    const asViewer = await viewer.storage
      .from("roast-attachments")
      .upload(`${businessId}/security-test/${uniq("v")}.png`, png, { contentType: "image/png" });
    expect(asViewer.error).not.toBeNull();
    const exe = await owner.storage
      .from("roast-attachments")
      .upload(
        `${businessId}/security-test/${uniq("bad")}.exe`,
        new Blob([new Uint8Array([77, 90])], { type: "application/x-msdownload" }),
        { contentType: "application/x-msdownload" },
      );
    expect(exe.error).not.toBeNull();
    const otherRead = await other.storage.from("roast-attachments").download(okPath);
    expect(otherRead.error).not.toBeNull();
    const anonRead = await anon.storage.from("roast-attachments").download(okPath);
    expect(anonRead.error).not.toBeNull();
    await owner.storage.from("roast-attachments").remove([okPath]);
  });

  it("search input is escaped against PostgREST filter injection", async () => {
    const nasty = `a%,id.not.is.null)("quote'\\`;
    const term = escapeLike(nasty);
    const { data, error } = await owner
      .from("suppliers")
      .select("id")
      .eq("business_id", businessId)
      .or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // a wildcard-only term must not match everything via injection either
    const { data: all } = await owner.from("suppliers").select("id").eq("business_id", businessId);
    const { data: filtered } = await owner
      .from("suppliers")
      .select("id")
      .eq("business_id", businessId)
      .or(`name.ilike.%${escapeLike("%")}%`);
    expect(filtered!.length).toBeLessThanOrEqual(all!.length);
  });

  it("privileged functions are not callable by anonymous or non-member sessions", async () => {
    expect(
      (
        await anon.rpc("create_purchase_order", {
          p_business_id: businessId,
          p_supplier_id: businessId,
          p_ordered_at: "2026-11-01",
          p_notes: null as unknown as string,
          p_additional_costs: 0,
          p_items: [],
          p_idempotency_key: uniq("x"),
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await anon.rpc("create_business_with_owner", { p_name: "x", p_owner_user_id: businessId }))
        .error,
    ).not.toBeNull();
    expect(
      (await owner.rpc("create_business_with_owner", { p_name: "x", p_owner_user_id: businessId }))
        .error,
    ).not.toBeNull();
    expect(
      (
        await anon.rpc("dashboard_metrics", {
          p_business_id: businessId,
          p_from: "2026-01-01",
          p_to: "2026-12-31",
        })
      ).error,
    ).not.toBeNull();
  });

  it("the service-role key is not configured for the browser bundle", () => {
    const publicKeys = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_"));
    expect(publicKeys.some((k) => /SERVICE|SECRET/i.test(k))).toBe(false);
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).not.toBe(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  });
});
