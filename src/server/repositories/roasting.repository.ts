import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Database, Paginated } from "@/types";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

export type RoastBatchSummary = Database["public"]["Views"]["roast_batch_summary_view"]["Row"];

export interface RoastListQuery {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  roaster?: string;
  operator?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}

const SORTABLE = [
  "batch_number",
  "roast_date",
  "status",
  "green_weight_g",
  "roasted_weight_g",
  "roast_loss_pct",
  "roasted_cost_per_kg",
  "completed_at",
];

export function roastingRepository(db: SupabaseServerClient) {
  return {
    async list(businessId: string, q: RoastListQuery): Promise<Paginated<RoastBatchSummary>> {
      const sort = q.sort && SORTABLE.includes(q.sort) ? q.sort : "roast_date";
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("roast_batch_summary_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (q.status && q.status !== "all") b = b.eq("status", q.status as never);
      if (q.roaster) b = b.eq("roaster_id", q.roaster);
      if (q.operator) b = b.eq("operator_id", q.operator);
      if (q.from) b = b.gte("roast_date", q.from);
      if (q.to) b = b.lte("roast_date", q.to);
      if (q.q) {
        const term = `%${escapeLike(q.q)}%`;
        b = b.or(`batch_number.ilike.${term},coffee_names.ilike.${term},lot_codes.ilike.${term}`);
      }
      b = b
        .order(sort, { ascending: q.dir === "asc", nullsFirst: false })
        .order("batch_number", { ascending: false })
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

    async summary(businessId: string, range?: { from?: string; to?: string }) {
      let b = db
        .from("roast_batch_summary_view")
        .select(
          "green_weight_g, roasted_weight_g, roast_loss_pct, production_cost_total, roasted_on_hand_g, roasted_stock_value, status",
        )
        .eq("business_id", businessId);
      if (range?.from) b = b.gte("roast_date", range.from);
      if (range?.to) b = b.lte("roast_date", range.to);
      const { data, error } = await b;
      if (error) throw fromDatabaseError(error);
      const rows = data ?? [];
      const completed = rows.filter((r) => r.status === "completed");
      const greenG = completed.reduce((a, r) => a + r.green_weight_g, 0);
      const roastedG = completed.reduce((a, r) => a + (r.roasted_weight_g ?? 0), 0);
      return {
        batches: rows.length,
        completed: completed.length,
        inProgress: rows.filter((r) => r.status === "in_progress").length,
        drafts: rows.filter((r) => r.status === "draft").length,
        greenConsumedG: greenG,
        roastedOutputG: roastedG,
        avgLossPct: greenG > 0 ? Math.round(((greenG - roastedG) * 10000) / greenG) / 100 : null,
        productionCost: completed.reduce((a, r) => a + (r.production_cost_total ?? 0), 0),
        roastedOnHandG: rows.reduce((a, r) => a + (r.roasted_on_hand_g ?? 0), 0),
        roastedStockValue: rows.reduce((a, r) => a + (r.roasted_stock_value ?? 0), 0),
      };
    },

    async getSummary(businessId: string, id: string): Promise<RoastBatchSummary | null> {
      const { data, error } = await db
        .from("roast_batch_summary_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async getDetail(businessId: string, id: string) {
      const { data, error } = await db
        .from("roast_batches")
        .select(
          `*,
           roast_batch_inputs ( *, green_coffee_lots ( id, lot_code, green_coffees ( id, name ) ) ),
           roast_measurements ( * ),
           roast_events ( * ),
           roast_batch_costs ( * ),
           roast_attachments ( * )`,
        )
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async create(args: {
      businessId: string;
      roasterId: string;
      profileId: string | null;
      locationId: string;
      roastDate: string;
      operatorId: string | null;
      inputs: { green_lot_id: string; input_weight_g: number }[];
      notes: string | null;
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("create_roast_batch", {
        p_business_id: args.businessId,
        p_roaster_id: args.roasterId,
        p_roast_profile_id: args.profileId as string,
        p_location_id: args.locationId,
        p_roast_date: args.roastDate,
        p_operator_id: args.operatorId as string,
        p_inputs: args.inputs as unknown as Json,
        p_notes: args.notes as string,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updateDraft(args: {
      batchId: string;
      roasterId: string;
      profileId: string | null;
      locationId: string;
      roastDate: string;
      operatorId: string | null;
      inputs: { green_lot_id: string; input_weight_g: number }[];
      notes: string | null;
    }) {
      const { data, error } = await db.rpc("update_roast_batch_draft", {
        p_batch_id: args.batchId,
        p_roaster_id: args.roasterId,
        p_roast_profile_id: args.profileId as string,
        p_location_id: args.locationId,
        p_roast_date: args.roastDate,
        p_operator_id: args.operatorId as string,
        p_inputs: args.inputs as unknown as Json,
        p_notes: args.notes as string,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async start(batchId: string) {
      const { error } = await db.rpc("start_roast_batch", { p_batch_id: batchId });
      if (error) throw fromDatabaseError(error);
    },

    async complete(args: {
      batchId: string;
      roastedWeightG: number;
      roastLevel: string | null;
      totalDurationSeconds: number;
      firstCrackSeconds: number | null;
      chargeBtC: number | null;
      chargeEtC: number | null;
      firstCrackBtC: number | null;
      dropBtC: number | null;
      costs: { cost_type: string; amount: string; notes: string | null }[];
      notes: string | null;
    }) {
      const { data, error } = await db.rpc("complete_roast_batch", {
        p_batch_id: args.batchId,
        p_roasted_weight_g: args.roastedWeightG,
        p_roast_level: args.roastLevel as string,
        p_total_duration_seconds: args.totalDurationSeconds,
        p_first_crack_seconds: args.firstCrackSeconds as number,
        p_charge_bt_c: args.chargeBtC as number,
        p_charge_et_c: args.chargeEtC as number,
        p_first_crack_bt_c: args.firstCrackBtC as number,
        p_drop_bt_c: args.dropBtC as number,
        p_costs: args.costs as unknown as Json,
        p_notes: args.notes as string,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async void(batchId: string, reason: string, idempotencyKey: string) {
      const { error } = await db.rpc("void_roast_batch", {
        p_batch_id: batchId,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
    },

    async deleteDraft(businessId: string, id: string) {
      const { error } = await db
        .from("roast_batches")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw fromDatabaseError(error);
    },

    async upsertMeasurement(businessId: string, batchId: string, values: Record<string, unknown>) {
      const { data, error } = await db
        .from("roast_measurements")
        .upsert({ ...values, business_id: businessId, roast_batch_id: batchId } as never, {
          onConflict: "roast_batch_id,elapsed_seconds",
        })
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async deleteMeasurement(businessId: string, id: string) {
      const { error } = await db
        .from("roast_measurements")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) throw fromDatabaseError(error);
    },

    async addEvent(businessId: string, batchId: string, values: Record<string, unknown>) {
      const { data, error } = await db
        .from("roast_events")
        .insert({ ...values, business_id: businessId, roast_batch_id: batchId } as never)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async deleteEvent(businessId: string, id: string) {
      const { error } = await db
        .from("roast_events")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) throw fromDatabaseError(error);
    },

    async addAttachment(
      businessId: string,
      batchId: string,
      values: {
        storage_path: string;
        file_name: string;
        file_type: string;
        size_bytes: number;
        uploaded_by: string;
      },
    ) {
      const { data, error } = await db
        .from("roast_attachments")
        .insert({ ...values, business_id: businessId, roast_batch_id: batchId })
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async deleteAttachment(businessId: string, id: string) {
      const { data, error } = await db
        .from("roast_attachments")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .select("storage_path")
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async listProfiles(businessId: string) {
      const { data, error } = await db
        .from("roast_profiles")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("name");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async listMembers(businessId: string) {
      const { data, error } = await db
        .from("business_members")
        .select("user_id, role, user_profiles!business_members_user_id_fkey ( full_name, email )")
        .eq("business_id", businessId)
        .eq("is_active", true);
      if (error) throw fromDatabaseError(error);
      return (data ?? []).map((m) => ({
        id: m.user_id,
        name: m.user_profiles?.full_name ?? m.user_profiles?.email ?? m.user_id,
        role: m.role,
      }));
    },

    async roastedBulkList(businessId: string) {
      const { data, error } = await db
        .from("roast_batch_summary_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gt("roasted_on_hand_g", 0)
        .order("completed_at", { ascending: false });
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },
  };
}
