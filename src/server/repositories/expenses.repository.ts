import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Paginated, Tables } from "@/types";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

export type ExpenseRow = Database["public"]["Views"]["report_expenses_view"]["Row"];

export interface ExpenseListQuery {
  q?: string;
  category?: string;
  treatment?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}

const SORTABLE = ["incurred_at", "amount", "category_name", "cost_treatment", "expense_number"];

export function expensesRepository(db: SupabaseServerClient) {
  return {
    async list(businessId: string, q: ExpenseListQuery): Promise<Paginated<ExpenseRow>> {
      const sort = q.sort && SORTABLE.includes(q.sort) ? q.sort : "incurred_at";
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("report_expenses_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (q.category) b = b.eq("category_id", q.category);
      if (q.treatment && q.treatment !== "all") b = b.eq("cost_treatment", q.treatment);
      if (q.from) b = b.gte("incurred_at", q.from);
      if (q.to) b = b.lte("incurred_at", q.to);
      if (q.q)
        b = b.or(
          `description.ilike.%${escapeLike(q.q)}%,expense_number.ilike.%${escapeLike(q.q)}%,supplier_name.ilike.%${escapeLike(q.q)}%`,
        );
      b = b
        .order(sort, { ascending: q.dir === "asc", nullsFirst: false })
        .order("expense_number", { ascending: false })
        .range(fromIdx, fromIdx + q.pageSize - 1);
      const { data, error, count } = await b;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: data ?? [],
        total,
        page: q.page,
        pageSize: q.pageSize,
        pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
      };
    },

    async get(businessId: string, id: string) {
      const [{ data: row, error }, { data: allocations, error: e2 }] = await Promise.all([
        db
          .from("report_expenses_view")
          .select("*")
          .eq("business_id", businessId)
          .eq("id", id)
          .maybeSingle(),
        db.from("cost_allocations").select("*").eq("expense_id", id).order("created_at"),
      ]);
      if (error) throw fromDatabaseError(error);
      if (e2) throw fromDatabaseError(e2);
      return row ? { row, allocations: allocations ?? [] } : null;
    },

    async raw(businessId: string, id: string): Promise<Tables<"expenses"> | null> {
      const { data, error } = await db
        .from("expenses")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async create(values: Record<string, unknown>) {
      const { data, error } = await db
        .from("expenses")
        .insert(values as never)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async update(businessId: string, id: string, values: Record<string, unknown>) {
      const { data, error } = await db
        .from("expenses")
        .update(values as never)
        .eq("business_id", businessId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async addAllocation(values: {
      business_id: string;
      expense_id: string;
      source_id: string;
      target_type: string;
      target_id: string;
      amount: string;
      notes: string | null;
      created_by: string;
    }) {
      const { data, error } = await db
        .from("cost_allocations")
        .insert(values as never)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async removeAllocation(businessId: string, id: string) {
      const { error } = await db
        .from("cost_allocations")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) throw fromDatabaseError(error);
    },

    async allocationTargets(businessId: string) {
      const [{ data: batches }, { data: sessions }, { data: receipts }] = await Promise.all([
        db
          .from("roast_batches")
          .select("id, batch_number, roast_date")
          .eq("business_id", businessId)
          .neq("status", "voided")
          .order("roast_date", { ascending: false })
          .limit(100),
        db
          .from("packaging_sessions")
          .select("id, session_number, packaged_at")
          .eq("business_id", businessId)
          .neq("status", "voided")
          .order("packaged_at", { ascending: false })
          .limit(100),
        db
          .from("goods_receipts")
          .select("id, receipt_number, received_at")
          .eq("business_id", businessId)
          .eq("status", "posted")
          .order("received_at", { ascending: false })
          .limit(100),
      ]);
      return {
        roast_batch: (batches ?? []).map((b) => ({
          id: b.id,
          label: `${b.batch_number} (${b.roast_date})`,
        })),
        packaging_session: (sessions ?? []).map((s) => ({
          id: s.id,
          label: `${s.session_number} (${s.packaged_at})`,
        })),
        goods_receipt: (receipts ?? []).map((r) => ({
          id: r.id,
          label: `${r.receipt_number} (${r.received_at})`,
        })),
      };
    },
  };
}
