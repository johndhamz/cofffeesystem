import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, getSessionContext } from "@/lib/auth/session";
import { Errors, fromDatabaseError } from "@/lib/errors";
import { roleHasPermission } from "@/lib/permissions/policy";
import { REPORT_META, type ReportFilter, type ReportKey } from "@/features/reports/schemas";
import { escapeLike } from "@/server/repositories/master-data.repository";

type Range = { from: string; to: string };

/** Reports page gate: production/inventory need reports.read; money reports need finance.read (owner). */
async function gate(report: ReportKey) {
  const ctx = await requirePermission("reports.read");
  if (REPORT_META[report].finance && !roleHasPermission(ctx.business.role, "finance.read")) {
    throw Errors.forbidden("Financial reports are available to owners only.");
  }
  return ctx;
}

export async function canSeeFinance() {
  const ctx = await getSessionContext();
  return !!ctx?.business && roleHasPermission(ctx.business.role, "finance.read");
}

export async function getDashboardMetrics(range: Range) {
  const ctx = await requirePermission("reports.read");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("dashboard_metrics", {
    p_business_id: ctx.business.businessId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw fromDatabaseError(error);
  return data as Record<string, number | boolean | null>;
}

export async function getDashboardCharts(range: Range) {
  const ctx = await requirePermission("reports.read");
  const db = await createSupabaseServerClient();
  const bid = ctx.business.businessId;
  const finance = roleHasPermission(ctx.business.role, "finance.read");
  const [weekly, monthly, byOrigin, topProducts, byCategory] = await Promise.all([
    db.rpc("report_weekly_production", { p_business_id: bid, p_from: range.from, p_to: range.to }),
    finance
      ? db.rpc("report_monthly_sales", { p_business_id: bid, p_from: range.from, p_to: range.to })
      : Promise.resolve({ data: [], error: null }),
    finance
      ? db.rpc("report_sales_by_dimension", {
          p_business_id: bid,
          p_from: range.from,
          p_to: range.to,
          p_dimension: "origin",
        })
      : Promise.resolve({ data: [], error: null }),
    finance
      ? db.rpc("report_sales_by_dimension", {
          p_business_id: bid,
          p_from: range.from,
          p_to: range.to,
          p_dimension: "product",
        })
      : Promise.resolve({ data: [], error: null }),
    finance
      ? db.rpc("report_expenses_by_category", {
          p_business_id: bid,
          p_from: range.from,
          p_to: range.to,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [weekly, monthly, byOrigin, topProducts, byCategory])
    if (r.error) throw fromDatabaseError(r.error);
  return {
    finance,
    weekly: weekly.data ?? [],
    monthly: monthly.data ?? [],
    byOrigin: byOrigin.data ?? [],
    topProducts: (topProducts.data ?? []).slice(0, 8),
    byCategory: byCategory.data ?? [],
  };
}

export async function getReportFilterOptions() {
  const ctx = await requirePermission("reports.read");
  const db = await createSupabaseServerClient();
  const bid = ctx.business.businessId;
  const [coffees, products, customers, channels, members] = await Promise.all([
    db.from("green_coffees").select("country").eq("business_id", bid).not("country", "is", null),
    db.from("products").select("id, name").eq("business_id", bid).order("name"),
    db.from("customers").select("id, name").eq("business_id", bid).order("name"),
    db.from("sales_channels").select("id, name").eq("business_id", bid).order("name"),
    db
      .from("business_members")
      .select("user_id, user_profiles!business_members_user_id_fkey ( full_name, email )")
      .eq("business_id", bid)
      .eq("is_active", true),
  ]);
  return {
    origins: [...new Set((coffees.data ?? []).map((c) => c.country!).filter(Boolean))].sort(),
    products: products.data ?? [],
    customers: customers.data ?? [],
    channels: channels.data ?? [],
    operators: (members.data ?? []).map((m) => ({
      id: m.user_id,
      name: m.user_profiles?.full_name ?? m.user_profiles?.email ?? m.user_id,
    })),
  };
}

export interface ReportResult {
  key: ReportKey;
  title: string;
  description: string;
  range: Range;
  columns: {
    key: string;
    label: string;
    align?: "right";
    kind?: "money" | "weight" | "pct" | "int";
  }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  total: number;
  page: number;
  pageCount: number;
  note?: string;
}

/** Produces a report for the UI and for exports. Pagination applies to the UI; exports pass pageSize=200 pages until exhausted. */
export async function runReport(
  key: ReportKey,
  filter: ReportFilter & Range,
): Promise<ReportResult> {
  const ctx = await gate(key);
  const db = await createSupabaseServerClient();
  const bid = ctx.business.businessId;
  const meta = REPORT_META[key];
  const base = {
    key,
    title: meta.title,
    description: meta.description,
    range: { from: filter.from, to: filter.to },
    page: filter.page,
  };
  const fromIdx = (filter.page - 1) * filter.pageSize;
  const toIdx = fromIdx + filter.pageSize - 1;

  if (key === "production") {
    let b = db
      .from("roast_batch_summary_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .eq("status", "completed")
      .gte("roast_date", filter.from)
      .lte("roast_date", filter.to);
    if (filter.operator) b = b.eq("operator_id", filter.operator);
    if (filter.origin) b = b.ilike("coffee_names", `%${escapeLike(filter.origin)}%`);
    const { data, error, count } = await b
      .order("roast_date", { ascending: false })
      .order("batch_number", { ascending: false })
      .range(fromIdx, toIdx);
    if (error) throw fromDatabaseError(error);
    const rows = (data ?? []).map((r) => ({
      roast_date: r.roast_date,
      batch_number: r.batch_number,
      coffee: r.coffee_names,
      lots: r.lot_codes,
      operator: r.operator_name,
      green_g: r.green_weight_g,
      roasted_g: r.roasted_weight_g,
      loss_pct: r.roast_loss_pct,
      yield_pct: r.roast_yield_pct,
      cost_per_kg: r.roasted_cost_per_kg,
      production_cost: r.production_cost_total,
    }));
    const greenG = rows.reduce((a, r) => a + (r.green_g ?? 0), 0);
    const roastedG = rows.reduce((a, r) => a + (r.roasted_g ?? 0), 0);
    const cost = rows.reduce((a, r) => a + (r.production_cost ?? 0), 0);
    return {
      ...base,
      columns: [
        { key: "roast_date", label: "Date" },
        { key: "batch_number", label: "Batch" },
        { key: "coffee", label: "Coffee" },
        { key: "lots", label: "Green lots" },
        { key: "operator", label: "Operator" },
        { key: "green_g", label: "Green", align: "right", kind: "weight" },
        { key: "roasted_g", label: "Roasted", align: "right", kind: "weight" },
        { key: "loss_pct", label: "Loss", align: "right", kind: "pct" },
        { key: "yield_pct", label: "Yield", align: "right", kind: "pct" },
        { key: "cost_per_kg", label: "Cost / roasted kg", align: "right", kind: "money" },
        { key: "production_cost", label: "Production cost", align: "right", kind: "money" },
      ],
      rows,
      totals: {
        batch_number: `${count ?? 0} batches (page)`,
        green_g: greenG,
        roasted_g: roastedG,
        loss_pct: greenG > 0 ? Math.round(((greenG - roastedG) * 10000) / greenG) / 100 : null,
        cost_per_kg: roastedG > 0 ? Math.round((cost * 1000 * 100) / roastedG) / 100 : null,
        production_cost: cost,
      },
      total: count ?? 0,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / filter.pageSize)),
      note: "Completed batches only; costs are the snapshots taken at completion.",
    };
  }

  if (key === "green-inventory") {
    let b = db
      .from("green_lot_inventory_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid);
    if (filter.origin) b = b.ilike("country", filter.origin);
    const { data, error, count } = await b
      .order("coffee_name")
      .order("lot_code")
      .range(fromIdx, toIdx);
    if (error) throw fromDatabaseError(error);
    const rows = (data ?? []).map((r) => ({
      coffee: r.coffee_name,
      origin: [r.region, r.country].filter(Boolean).join(", "),
      supplier: r.supplier_name,
      lot: r.lot_code,
      received_g: r.received_quantity_g,
      available_g: r.available_g,
      cost_per_kg: r.cost_per_kg,
      value: r.stock_value,
      status: r.stock_status,
    }));
    return {
      ...base,
      columns: [
        { key: "coffee", label: "Coffee" },
        { key: "origin", label: "Origin" },
        { key: "supplier", label: "Supplier" },
        { key: "lot", label: "Lot" },
        { key: "received_g", label: "Received", align: "right", kind: "weight" },
        { key: "available_g", label: "Available", align: "right", kind: "weight" },
        { key: "cost_per_kg", label: "Cost / kg", align: "right", kind: "money" },
        { key: "value", label: "Valuation", align: "right", kind: "money" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        lot: `${count ?? 0} lots`,
        available_g: rows.reduce((a, r) => a + (r.available_g ?? 0), 0),
        value: rows.reduce((a, r) => a + (r.value ?? 0), 0),
      },
      total: count ?? 0,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / filter.pageSize)),
      note: "Current stock; valuation = remaining lot cost (purchase + landed).",
    };
  }

  if (key === "finished-goods") {
    let b = db
      .from("finished_goods_inventory_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .gt("on_hand", 0);
    if (filter.product) b = b.eq("product_id", filter.product);
    const { data, error, count } = await b
      .order("product_name")
      .order("lot_code")
      .range(fromIdx, toIdx);
    if (error) throw fromDatabaseError(error);
    const rows = (data ?? []).map((r) => ({
      product: `${r.product_name} ${r.variant_name}`,
      sku: r.sku,
      lot: r.lot_code,
      packaged_at: r.packaged_at,
      best_before: r.best_before_at,
      quantity: r.available,
      unit_cost: r.unit_cost,
      value: r.stock_value,
      roast_batches: r.roast_batch_numbers,
    }));
    return {
      ...base,
      columns: [
        { key: "product", label: "Product" },
        { key: "sku", label: "SKU" },
        { key: "lot", label: "Lot" },
        { key: "packaged_at", label: "Packaged" },
        { key: "best_before", label: "Best before" },
        { key: "quantity", label: "Quantity", align: "right", kind: "int" },
        { key: "unit_cost", label: "Unit cost", align: "right", kind: "money" },
        { key: "value", label: "Total value", align: "right", kind: "money" },
        { key: "roast_batches", label: "Roast batches" },
      ],
      rows,
      totals: {
        lot: `${count ?? 0} lots`,
        quantity: rows.reduce((a, r) => a + (r.quantity ?? 0), 0),
        value: rows.reduce((a, r) => a + (r.value ?? 0), 0),
      },
      total: count ?? 0,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / filter.pageSize)),
      note: "Lots with stock on hand; value = quantity × actual unit cost.",
    };
  }

  if (key === "sales") {
    let b = db
      .from("report_sales_lines_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .gte("sold_at", filter.from)
      .lte("sold_at", filter.to);
    if (filter.product) b = b.eq("product_id", filter.product);
    if (filter.customer) b = b.eq("customer_id", filter.customer);
    if (filter.channel) b = b.eq("channel_id", filter.channel);
    if (filter.origin) b = b.ilike("origins", `%${escapeLike(filter.origin)}%`);
    const { data, error, count } = await b
      .order("sold_at", { ascending: false })
      .order("order_number", { ascending: false })
      .range(fromIdx, toIdx);
    if (error) throw fromDatabaseError(error);
    const rows = (data ?? []).map((r) => ({
      sold_at: r.sold_at,
      order_number: r.order_number,
      product: `${r.product_name} ${r.variant_name}`,
      customer: r.customer_name ?? "Walk-in",
      channel: r.channel_name,
      origin: r.origins,
      quantity: r.net_units,
      revenue: r.net_revenue,
      cogs: r.cogs,
      gross_profit: Math.round(((r.net_revenue ?? 0) - (r.cogs ?? 0)) * 100) / 100,
    }));
    const rev = rows.reduce((a, r) => a + (r.revenue ?? 0), 0);
    const cogs = rows.reduce((a, r) => a + (r.cogs ?? 0), 0);
    return {
      ...base,
      columns: [
        { key: "sold_at", label: "Date" },
        { key: "order_number", label: "Order" },
        { key: "product", label: "Product" },
        { key: "customer", label: "Customer" },
        { key: "channel", label: "Channel" },
        { key: "origin", label: "Origin" },
        { key: "quantity", label: "Qty", align: "right", kind: "int" },
        { key: "revenue", label: "Revenue", align: "right", kind: "money" },
        { key: "cogs", label: "COGS", align: "right", kind: "money" },
        { key: "gross_profit", label: "Gross profit", align: "right", kind: "money" },
      ],
      rows,
      totals: {
        order_number: `${count ?? 0} lines`,
        quantity: rows.reduce((a, r) => a + (r.quantity ?? 0), 0),
        revenue: rev,
        cogs,
        gross_profit: Math.round((rev - cogs) * 100) / 100,
      },
      total: count ?? 0,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / filter.pageSize)),
      note: "Revenue recognised on fulfilment, net of discounts and returned units; COGS from the fulfilment cost snapshot (restocked returns credited).",
    };
  }

  if (key === "expenses") {
    const { data, error, count } = await db
      .from("report_expenses_view")
      .select("*", { count: "exact" })
      .eq("business_id", bid)
      .eq("is_voided", false)
      .gte("incurred_at", filter.from)
      .lte("incurred_at", filter.to)
      .order("incurred_at", { ascending: false })
      .range(fromIdx, toIdx);
    if (error) throw fromDatabaseError(error);
    const rows = (data ?? []).map((r) => ({
      incurred_at: r.incurred_at,
      expense_number: r.expense_number,
      category: r.category_name,
      classification: r.classification,
      treatment: r.cost_treatment,
      description: r.description,
      supplier: r.supplier_name,
      amount: r.amount,
      operating_amount: r.operating_amount,
    }));
    return {
      ...base,
      columns: [
        { key: "incurred_at", label: "Date" },
        { key: "expense_number", label: "No." },
        { key: "category", label: "Category" },
        { key: "classification", label: "Classification" },
        { key: "treatment", label: "Cost treatment" },
        { key: "description", label: "Description" },
        { key: "supplier", label: "Supplier" },
        { key: "amount", label: "Amount", align: "right", kind: "money" },
        { key: "operating_amount", label: "Operating expense", align: "right", kind: "money" },
      ],
      rows,
      totals: {
        expense_number: `${count ?? 0} expenses`,
        amount: rows.reduce((a, r) => a + (r.amount ?? 0), 0),
        operating_amount: rows.reduce((a, r) => a + (r.operating_amount ?? 0), 0),
      },
      total: count ?? 0,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / filter.pageSize)),
      note: "Only operating treatments count as period expenses; production and acquisition costs are recognised inside inventory cost (COGS).",
    };
  }

  // profitability
  const [{ data: p, error }, { data: monthly, error: e2 }] = await Promise.all([
    db.rpc("report_profitability", { p_business_id: bid, p_from: filter.from, p_to: filter.to }),
    db.rpc("report_monthly_sales", { p_business_id: bid, p_from: filter.from, p_to: filter.to }),
  ]);
  if (error) throw fromDatabaseError(error);
  if (e2) throw fromDatabaseError(e2);
  const prof = p?.[0];
  const rows = (monthly ?? []).map((m) => ({
    period: m.month,
    net_sales: m.net_sales,
    cogs: m.cogs,
    gross_profit: m.gross_profit,
    gross_margin_pct: m.gross_margin_pct,
    units: m.units,
  }));
  return {
    ...base,
    columns: [
      { key: "period", label: "Month" },
      { key: "units", label: "Units", align: "right", kind: "int" },
      { key: "net_sales", label: "Net sales", align: "right", kind: "money" },
      { key: "cogs", label: "COGS", align: "right", kind: "money" },
      { key: "gross_profit", label: "Gross profit", align: "right", kind: "money" },
      { key: "gross_margin_pct", label: "Gross margin", align: "right", kind: "pct" },
    ],
    rows,
    totals: {
      period: "Period",
      units: prof?.units_sold ?? 0,
      net_sales: prof?.net_sales ?? 0,
      cogs: prof?.cogs ?? 0,
      gross_profit: prof?.gross_profit ?? 0,
      gross_margin_pct: prof?.gross_margin_pct ?? null,
      operating_expenses: prof?.operating_expenses ?? 0,
      operating_result: prof?.operating_result ?? 0,
      refunds: prof?.refunds ?? 0,
      orders: prof?.orders ?? 0,
    },
    total: rows.length,
    pageCount: 1,
    note: "Management report, not a statutory financial statement. Net sales − COGS = gross profit; gross profit − operating expenses = operating result. Payments and receivables are tracked separately.",
  };
}

/** Collects all pages of a report for export (server-side only). */
export async function runReportAll(
  key: ReportKey,
  filter: ReportFilter & Range,
): Promise<ReportResult> {
  const first = await runReport(key, { ...filter, page: 1, pageSize: 200 });
  const rows = [...first.rows];
  for (let p = 2; p <= first.pageCount && p <= 50; p++) {
    const next = await runReport(key, { ...filter, page: p, pageSize: 200 });
    rows.push(...next.rows);
  }
  return { ...first, rows, totals: first.totals };
}
