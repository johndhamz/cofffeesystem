/**
 * Performance harness (STEP 6). Measures real latencies against the running local stack with the
 * owner session (RLS applies). Prints a markdown table and writes JSON to perf-results.json.
 * Budgets are stated in docs/PERFORMANCE.md; this script never fabricates numbers.
 *
 * Usage: npm run perf  (requires `npm run db:start && npm run env:local`)
 */
import path from "node:path";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/types/database";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const dbUrl = process.env.DATABASE_URL ?? "";

type Row = {
  metric: string;
  budgetMs: number;
  p50: number;
  p95: number;
  max: number;
  n: number;
  note?: string;
  pass: boolean;
};
const rows: Row[] = [];
const uniq = (p: string) =>
  `${p} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function pct(values: number[], p: number) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function measure(
  metric: string,
  budgetMs: number,
  n: number,
  fn: () => PromiseLike<unknown>,
  note?: string,
) {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await fn();
    times.push(performance.now() - t);
  }
  const r = {
    metric,
    budgetMs,
    p50: Math.round(pct(times, 50)),
    p95: Math.round(pct(times, 95)),
    max: Math.round(Math.max(...times)),
    n,
    note,
    pass: pct(times, 95) <= budgetMs,
  };
  rows.push(r);
  console.log(
    `${r.pass ? "PASS" : "FAIL"}  ${metric}: p50 ${r.p50} ms, p95 ${r.p95} ms, max ${r.max} ms (budget p95 ≤ ${budgetMs} ms)`,
  );
}

async function main() {
  const api = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authErr } = await api.auth.signInWithPassword({
    email: "owner@coffee.test",
    password: "OwnerPass123!",
  });
  if (authErr) throw authErr;
  const bid = (await api.rpc("my_memberships")).data![0].business_id;
  const loc = (
    await api
      .from("inventory_locations")
      .select("id")
      .eq("business_id", bid)
      .eq("is_active", true)
      .limit(1)
      .single()
  ).data!.id;
  const roasterId = (
    await api
      .from("roasters")
      .select("id")
      .eq("business_id", bid)
      .eq("name", "Yoshan DY-2kg")
      .single()
  ).data!.id;

  // ---- dataset: one large lot + 5,000 extra movements (adjustments with 100 lines each) ----
  const { data: supplier } = await api
    .from("suppliers")
    .insert({ business_id: bid, name: uniq("Perf Supplier") })
    .select("id")
    .single();
  const { data: coffee } = await api
    .from("green_coffees")
    .insert({ business_id: bid, name: uniq("Perf Coffee"), country: "Philippines" })
    .select("id")
    .single();
  const { data: poId } = await api.rpc("create_purchase_order", {
    p_business_id: bid,
    p_supplier_id: supplier!.id,
    p_ordered_at: "2026-11-01",
    p_notes: null as unknown as string,
    p_additional_costs: 0,
    p_items: [
      { green_coffee_id: coffee!.id, ordered_quantity_g: 5_000_000, unit_cost: "450" },
    ] as unknown as Json,
    p_idempotency_key: uniq("po"),
  });
  await api.rpc("confirm_purchase_order", { p_purchase_order_id: poId! });
  const item = (
    await api.from("purchase_order_items").select("id").eq("purchase_order_id", poId!).single()
  ).data!.id;
  const { data: rid } = await api.rpc("create_goods_receipt", {
    p_purchase_order_id: poId!,
    p_location_id: loc,
    p_received_at: "2026-11-01",
    p_additional_costs: 0,
    p_notes: null as unknown as string,
    p_items: [
      {
        purchase_order_item_id: item,
        received_quantity_g: 5_000_000,
        allocated_landed_cost: "0",
        green_lot_id: null,
        new_lot: {
          lot_code: uniq("PERF").replace(/\s/g, "-"),
          moisture_pct: null,
          density_g_per_100ml: null,
          notes: null,
        },
      },
    ] as unknown as Json,
    p_idempotency_key: uniq("grn"),
  });
  await api.rpc("post_goods_receipt", { p_receipt_id: rid! });
  const lotId = (
    await api.from("goods_receipt_items").select("green_lot_id").eq("receipt_id", rid!).single()
  ).data!.green_lot_id;
  const lotItem = (
    await api
      .from("inventory_items")
      .select("id")
      .eq("item_type", "green_coffee_lot")
      .eq("reference_id", lotId)
      .single()
  ).data!.id;
  const before =
    (
      await api
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
    ).count ?? 0;
  console.log(`existing movements: ${before}; adding 5,000 …`);
  const t0 = performance.now();
  for (let batch = 0; batch < 50; batch++) {
    const lines = Array.from({ length: 100 }, (_, i) => ({
      inventory_item_id: lotItem,
      location_id: loc,
      quantity_delta: i % 2 === 0 ? -10 : 10,
      unit_cost: null,
      notes: null,
    }));
    const { error } = await api.rpc("create_inventory_adjustment", {
      p_business_id: bid,
      p_reason: "count_correction",
      p_notes: "perf",
      p_lines: lines as unknown as Json,
      p_idempotency_key: uniq("perf"),
      p_post: true,
    });
    if (error) throw error;
  }
  const after =
    (
      await api
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
    ).count ?? 0;
  console.log(
    `movements now: ${after} (+${after - before}) in ${Math.round(performance.now() - t0)} ms`,
  );

  // ---- read paths ----
  await measure("dashboard_metrics (RPC, full year)", 800, 20, () =>
    api.rpc("dashboard_metrics", { p_business_id: bid, p_from: "2026-01-01", p_to: "2026-12-31" }),
  );
  await measure("green_lot_inventory_view page (25 rows)", 400, 20, () =>
    api
      .from("green_lot_inventory_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .order("coffee_name")
      .range(0, 24),
  );
  await measure("inventory_movement_history_view page (50 rows)", 400, 20, () =>
    api
      .from("inventory_movement_history_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .order("posted_at", { ascending: false })
      .range(0, 49),
  );
  await measure("movement history for one item with 5,000+ rows (page 1)", 400, 20, () =>
    api
      .from("inventory_movement_history_view")
      .select("*", { count: "exact" })
      .eq("inventory_item_id", lotItem)
      .order("posted_at", { ascending: false })
      .range(0, 49),
  );
  await measure("inventory_reconciliation_view (all balances)", 800, 10, () =>
    api
      .from("inventory_reconciliation_view")
      .select("*")
      .eq("business_id", bid)
      .neq("difference", 0),
  );
  await measure("report_profitability (year)", 800, 10, () =>
    api.rpc("report_profitability", {
      p_business_id: bid,
      p_from: "2026-01-01",
      p_to: "2026-12-31",
    }),
  );
  await measure("report_sales_lines_view export page (200 rows)", 1000, 10, () =>
    api
      .from("report_sales_lines_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .gte("sold_at", "2026-01-01")
      .lte("sold_at", "2026-12-31")
      .range(0, 199),
  );
  await measure("report_monthly_sales + by_dimension(product) + weekly_production", 1200, 10, () =>
    Promise.all([
      api.rpc("report_monthly_sales", {
        p_business_id: bid,
        p_from: "2026-01-01",
        p_to: "2026-12-31",
      }),
      api.rpc("report_sales_by_dimension", {
        p_business_id: bid,
        p_from: "2026-01-01",
        p_to: "2026-12-31",
        p_dimension: "product",
      }),
      api.rpc("report_weekly_production", {
        p_business_id: bid,
        p_from: "2026-01-01",
        p_to: "2026-12-31",
      }),
    ]),
  );

  // ---- concurrency ----
  const { data: product } = await api
    .from("products")
    .insert({ business_id: bid, name: uniq("Perf Product") })
    .select("id")
    .single();
  const { data: variant } = await api
    .from("product_variants")
    .insert({
      business_id: bid,
      product_id: product!.id,
      sku: uniq("PERF").replace(/\s/g, "-"),
      name: "250 g",
      net_weight_g: 250,
      selling_price: 350,
    })
    .select("id")
    .single();
  const channel = (
    await api.from("sales_channels").select("id").eq("business_id", bid).limit(1).single()
  ).data!.id;
  const batchIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const { data: b } = await api.rpc("create_roast_batch", {
      p_business_id: bid,
      p_roaster_id: roasterId,
      p_roast_profile_id: null as unknown as string,
      p_location_id: loc,
      p_roast_date: "2026-11-01",
      p_operator_id: null as unknown as string,
      p_inputs: [{ green_lot_id: lotId, input_weight_g: 2000 }] as unknown as Json,
      p_notes: null as unknown as string,
      p_idempotency_key: uniq("rb"),
    });
    batchIds.push(b!);
  }
  await measure(
    "5 concurrent roast completions (same green lot)",
    1500,
    1,
    async () => {
      const res = await Promise.all(
        batchIds.map((id) =>
          api.rpc("complete_roast_batch", {
            p_batch_id: id,
            p_roasted_weight_g: 1700,
            p_roast_level: "medium",
            p_total_duration_seconds: 600,
            p_first_crack_seconds: 480,
            p_charge_bt_c: null as unknown as number,
            p_charge_et_c: null as unknown as number,
            p_first_crack_bt_c: null as unknown as number,
            p_drop_bt_c: null as unknown as number,
            p_costs: [] as unknown as Json,
            p_notes: null as unknown as string,
          }),
        ),
      );
      if (res.some((r) => r.error)) throw res.find((r) => r.error)!.error;
    },
    "all 5 must succeed; serialised on the lot's balance row",
  );
  for (const b of batchIds) {
    const { data: s } = await api.rpc("create_packaging_session", {
      p_business_id: bid,
      p_location_id: loc,
      p_packaged_at: "2026-11-01",
      p_operator_id: null as unknown as string,
      p_inputs: [{ roast_batch_id: b, input_weight_g: 1500 }] as unknown as Json,
      p_outputs: [{ variant_id: variant!.id, quantity: 6 }] as unknown as Json,
      p_materials: [] as unknown as Json,
      p_labor_cost: 0,
      p_overhead_cost: 0,
      p_notes: null as unknown as string,
      p_idempotency_key: uniq("pk"),
    });
    await api.rpc("complete_packaging_session", { p_session_id: s! });
  }
  const orderIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const { data: o } = await api.rpc("create_sales_order", {
      p_business_id: bid,
      p_customer_id: null as unknown as string,
      p_sales_channel_id: channel,
      p_price_tier: "retail",
      p_ordered_at: "2026-11-01",
      p_due_at: null as unknown as string,
      p_discount_amount: 0,
      p_notes: null as unknown as string,
      p_items: [
        { product_variant_id: variant!.id, quantity: 3, unit_price: "350", discount_amount: "0" },
      ] as unknown as Json,
      p_idempotency_key: uniq("so"),
    });
    await api.rpc("confirm_sales_order", { p_order_id: o!, p_reserve: true });
    orderIds.push(o!);
  }
  await measure(
    "10 concurrent order fulfilments (30 bags across 5 lots)",
    2000,
    1,
    async () => {
      const res = await Promise.all(
        orderIds.map((id) =>
          api.rpc("fulfill_sales_order", {
            p_order_id: id,
            p_location_id: null as unknown as string,
            p_fulfilled_at: "2026-11-01",
            p_items: null as unknown as Json,
            p_notes: null as unknown as string,
            p_idempotency_key: uniq("sf"),
          }),
        ),
      );
      if (res.some((r) => r.error)) throw res.find((r) => r.error)!.error;
    },
    "all 10 must succeed; each locks only its own lot balance rows",
  );

  // ---- connections ----
  let conn = "n/a";
  if (dbUrl) {
    try {
      conn = execSync(
        `psql "${dbUrl}" -Atc "select count(*) || ' total, ' || count(*) filter (where state='active') || ' active, max ' || current_setting('max_connections') from pg_stat_activity where datname='postgres';"`,
      )
        .toString()
        .trim();
    } catch {
      conn = "psql unavailable";
    }
  }
  console.log(`database connections during run: ${conn}`);

  const { data: recon } = await api
    .from("inventory_reconciliation_view")
    .select("difference")
    .eq("business_id", bid)
    .neq("difference", 0);
  console.log(`reconciliation differences after load: ${recon?.length ?? "?"}`);

  const out = {
    generated_at: new Date().toISOString(),
    environment: "local docker supabase + supabase-js over HTTP (PostgREST)",
    movements_total: after,
    connections: conn,
    reconciliation_differences: recon?.length ?? null,
    results: rows,
  };
  writeFileSync(path.resolve(process.cwd(), "perf-results.json"), JSON.stringify(out, null, 2));
  console.log(
    "\n| Metric | Budget (p95) | p50 | p95 | max | n | Result |\n|---|---|---|---|---|---|---|",
  );
  for (const r of rows)
    console.log(
      `| ${r.metric} | ${r.budgetMs} ms | ${r.p50} ms | ${r.p95} ms | ${r.max} ms | ${r.n} | ${r.pass ? "PASS" : "FAIL"} |`,
    );
  if (rows.some((r) => !r.pass)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
