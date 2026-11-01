import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Database, Paginated } from "@/types";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

export type PackagingSessionSummary =
  Database["public"]["Views"]["packaging_session_summary_view"]["Row"];
export type FinishedGoodsRow = Database["public"]["Views"]["finished_goods_inventory_view"]["Row"];
export type MaterialInventoryRow =
  Database["public"]["Views"]["packaging_material_inventory_view"]["Row"];

export interface SessionListQuery {
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}

const SORTABLE = [
  "session_number",
  "packaged_at",
  "status",
  "output_units",
  "total_cost",
  "completed_at",
];

export function packagingRepository(db: SupabaseServerClient) {
  return {
    async listSessions(
      businessId: string,
      q: SessionListQuery,
    ): Promise<Paginated<PackagingSessionSummary>> {
      const sort = q.sort && SORTABLE.includes(q.sort) ? q.sort : "packaged_at";
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("packaging_session_summary_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (q.status && q.status !== "all") b = b.eq("status", q.status as never);
      if (q.q)
        b = b.or(
          `session_number.ilike.%${escapeLike(q.q)}%,product_names.ilike.%${escapeLike(q.q)}%,batch_numbers.ilike.%${escapeLike(q.q)}%`,
        );
      b = b
        .order(sort, { ascending: q.dir === "asc", nullsFirst: false })
        .order("session_number", { ascending: false })
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

    async getSession(businessId: string, id: string) {
      const [{ data: summary, error: e1 }, { data: detail, error: e2 }] = await Promise.all([
        db
          .from("packaging_session_summary_view")
          .select("*")
          .eq("business_id", businessId)
          .eq("id", id)
          .maybeSingle(),
        db
          .from("packaging_sessions")
          .select(
            `*,
             packaging_inputs ( *, roast_batches ( id, batch_number ) ),
             packaging_outputs ( *, product_variants ( id, sku, name, net_weight_g, products ( name ) ) ),
             packaging_material_usage ( *, packaging_materials ( id, name, base_unit ) )`,
          )
          .eq("business_id", businessId)
          .eq("id", id)
          .maybeSingle(),
      ]);
      if (e1) throw fromDatabaseError(e1);
      if (e2) throw fromDatabaseError(e2);
      return summary && detail ? { summary, detail } : null;
    },

    async create(args: {
      businessId: string;
      locationId: string;
      packagedAt: string;
      operatorId: string | null;
      inputs: { roast_batch_id: string; input_weight_g: number }[];
      outputs: {
        variant_id: string;
        quantity: number;
        lot_code: string | null;
        best_before_at: string | null;
      }[];
      materials: { material_id: string; quantity: number }[] | null;
      laborCost: string;
      overheadCost: string;
      notes: string | null;
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("create_packaging_session", {
        p_business_id: args.businessId,
        p_location_id: args.locationId,
        p_packaged_at: args.packagedAt,
        p_operator_id: args.operatorId as string,
        p_inputs: args.inputs as unknown as Json,
        p_outputs: args.outputs as unknown as Json,
        p_materials: args.materials as unknown as Json,
        p_labor_cost: Number(args.laborCost),
        p_overhead_cost: Number(args.overheadCost),
        p_notes: args.notes as string,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updateDraft(args: {
      sessionId: string;
      locationId: string;
      packagedAt: string;
      operatorId: string | null;
      inputs: { roast_batch_id: string; input_weight_g: number }[];
      outputs: {
        variant_id: string;
        quantity: number;
        lot_code: string | null;
        best_before_at: string | null;
      }[];
      materials: { material_id: string; quantity: number }[] | null;
      laborCost: string;
      overheadCost: string;
      notes: string | null;
    }) {
      const { data, error } = await db.rpc("update_packaging_session_draft", {
        p_session_id: args.sessionId,
        p_location_id: args.locationId,
        p_packaged_at: args.packagedAt,
        p_operator_id: args.operatorId as string,
        p_inputs: args.inputs as unknown as Json,
        p_outputs: args.outputs as unknown as Json,
        p_materials: args.materials as unknown as Json,
        p_labor_cost: Number(args.laborCost),
        p_overhead_cost: Number(args.overheadCost),
        p_notes: args.notes as string,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async complete(sessionId: string) {
      const { data, error } = await db.rpc("complete_packaging_session", {
        p_session_id: sessionId,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async void(sessionId: string, reason: string, idempotencyKey: string) {
      const { error } = await db.rpc("void_packaging_session", {
        p_session_id: sessionId,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
    },

    async deleteDraft(businessId: string, id: string) {
      const { error } = await db
        .from("packaging_sessions")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw fromDatabaseError(error);
    },

    async finishedGoods(
      businessId: string,
      opts: {
        q?: string;
        stock?: string;
        page: number;
        pageSize: number;
        sort?: string;
        dir: "asc" | "desc";
      },
    ): Promise<Paginated<FinishedGoodsRow>> {
      const sortable = [
        "product_name",
        "sku",
        "lot_code",
        "packaged_at",
        "best_before_at",
        "available",
        "unit_cost",
        "stock_value",
      ];
      const sort = opts.sort && sortable.includes(opts.sort) ? opts.sort : "packaged_at";
      const fromIdx = (opts.page - 1) * opts.pageSize;
      let b = db
        .from("finished_goods_inventory_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (opts.q)
        b = b.or(
          `product_name.ilike.%${escapeLike(opts.q)}%,sku.ilike.%${escapeLike(opts.q)}%,lot_code.ilike.%${escapeLike(opts.q)}%`,
        );
      if (opts.stock === "in_stock") b = b.gt("available", 0);
      if (opts.stock === "out_of_stock") b = b.lte("available", 0);
      b = b
        .order(sort, { ascending: opts.dir === "asc", nullsFirst: false })
        .order("lot_code")
        .range(fromIdx, fromIdx + opts.pageSize - 1);
      const { data, error, count } = await b;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: data ?? [],
        total,
        page: opts.page,
        pageSize: opts.pageSize,
        pageCount: Math.max(1, Math.ceil(total / opts.pageSize)),
      };
    },

    async finishedLot(businessId: string, lotId: string) {
      const { data, error } = await db
        .from("finished_goods_inventory_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("lot_id", lotId)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async finishedLotLineage(businessId: string, sessionId: string) {
      const { data, error } = await db
        .from("packaging_inputs")
        .select(
          "input_weight_g, inherited_cost, roast_batches ( id, batch_number, roast_date, roasted_weight_g, roast_level, roast_batch_inputs ( input_weight_g, allocated_green_cost, green_coffee_lots ( id, lot_code, green_coffees ( name, country, region ) ) ) )",
        )
        .eq("business_id", businessId)
        .eq("session_id", sessionId);
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async materialsInventory(businessId: string): Promise<MaterialInventoryRow[]> {
      const { data, error } = await db
        .from("packaging_material_inventory_view")
        .select("*")
        .eq("business_id", businessId)
        .order("name");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },
  };
}
