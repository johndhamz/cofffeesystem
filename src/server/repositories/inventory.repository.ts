import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { GreenLotInventoryRow, InventoryMovementHistoryRow, Paginated } from "@/types";
import type { InventoryFilter } from "@/features/inventory/schemas";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

const LOT_SORTABLE = [
  "coffee_name",
  "lot_code",
  "country",
  "supplier_name",
  "received_quantity_g",
  "available_g",
  "cost_per_kg",
  "stock_value",
  "last_received_at",
  "received_at",
];

export function inventoryRepository(db: SupabaseServerClient) {
  return {
    async listGreenLots(
      businessId: string,
      filter: InventoryFilter,
    ): Promise<Paginated<GreenLotInventoryRow>> {
      const sort = filter.sort && LOT_SORTABLE.includes(filter.sort) ? filter.sort : "coffee_name";
      const fromIdx = (filter.page - 1) * filter.pageSize;
      let builder = db
        .from("green_lot_inventory_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (filter.q) {
        const term = `%${escapeLike(filter.q)}%`;
        builder = builder.or(
          `coffee_name.ilike.${term},lot_code.ilike.${term},supplier_name.ilike.${term}`,
        );
      }
      if (filter.country) builder = builder.ilike("country", filter.country);
      if (filter.supplier) builder = builder.eq("supplier_id", filter.supplier);
      if (filter.process) builder = builder.ilike("processing_method", filter.process);
      if (filter.lot) builder = builder.ilike("lot_code", `%${escapeLike(filter.lot)}%`);
      if (filter.stock !== "all") builder = builder.eq("stock_status", filter.stock);
      builder = builder
        .order(sort, { ascending: filter.dir === "asc", nullsFirst: false })
        .order("lot_code", { ascending: true })
        .range(fromIdx, fromIdx + filter.pageSize - 1);
      const { data, error, count } = await builder;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: data ?? [],
        total,
        page: filter.page,
        pageSize: filter.pageSize,
        pageCount: Math.max(1, Math.ceil(total / filter.pageSize)),
      };
    },

    async allGreenLots(businessId: string): Promise<GreenLotInventoryRow[]> {
      const { data, error } = await db
        .from("green_lot_inventory_view")
        .select("*")
        .eq("business_id", businessId)
        .order("coffee_name")
        .order("lot_code");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async getGreenLot(businessId: string, lotId: string): Promise<GreenLotInventoryRow | null> {
      const { data, error } = await db
        .from("green_lot_inventory_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("lot_id", lotId)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async getLotRecord(businessId: string, lotId: string) {
      const { data, error } = await db
        .from("green_coffee_lots")
        .select("*, green_coffees ( id, name ), suppliers ( id, name )")
        .eq("business_id", businessId)
        .eq("id", lotId)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updateLot(
      businessId: string,
      lotId: string,
      values: {
        moisture_pct?: number | null;
        density_g_per_100ml?: number | null;
        notes?: string | null;
      },
    ) {
      const { data, error } = await db
        .from("green_coffee_lots")
        .update(values)
        .eq("business_id", businessId)
        .eq("id", lotId)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updateItemThreshold(
      businessId: string,
      inventoryItemId: string,
      threshold: number | null,
    ) {
      const { error } = await db
        .from("inventory_items")
        .update({ low_stock_threshold: threshold })
        .eq("business_id", businessId)
        .eq("id", inventoryItemId);
      if (error) throw fromDatabaseError(error);
    },

    async balancesForItem(businessId: string, inventoryItemId: string) {
      const { data, error } = await db
        .from("inventory_balances")
        .select("*, inventory_locations ( id, name )")
        .eq("business_id", businessId)
        .eq("inventory_item_id", inventoryItemId);
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async costLayersForItem(businessId: string, inventoryItemId: string) {
      const { data, error } = await db
        .from("inventory_cost_layers")
        .select("*")
        .eq("business_id", businessId)
        .eq("inventory_item_id", inventoryItemId)
        .order("received_at");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async listMovements(
      businessId: string,
      args: {
        inventoryItemId?: string;
        page: number;
        pageSize: number;
        type?: string;
        from?: string;
        to?: string;
      },
    ): Promise<Paginated<InventoryMovementHistoryRow>> {
      const fromIdx = (args.page - 1) * args.pageSize;
      let builder = db
        .from("inventory_movement_history_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (args.inventoryItemId) builder = builder.eq("inventory_item_id", args.inventoryItemId);
      if (args.type) builder = builder.eq("movement_type", args.type as never);
      if (args.from) builder = builder.gte("posted_at", args.from);
      if (args.to) builder = builder.lte("posted_at", args.to);
      builder = builder
        .order("posted_at", { ascending: false })
        .range(fromIdx, fromIdx + args.pageSize - 1);
      const { data, error, count } = await builder;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: data ?? [],
        total,
        page: args.page,
        pageSize: args.pageSize,
        pageCount: Math.max(1, Math.ceil(total / args.pageSize)),
      };
    },

    async createInventoryAdjustment(args: {
      businessId: string;
      reason: string;
      notes: string | null;
      lines: {
        inventory_item_id: string;
        location_id: string;
        quantity_delta: number;
        unit_cost: string | null;
        notes: string | null;
      }[];
      idempotencyKey: string;
      post: boolean;
    }) {
      const { data, error } = await db.rpc("create_inventory_adjustment", {
        p_business_id: args.businessId,
        p_reason: args.reason,
        p_notes: args.notes as string,
        p_lines: args.lines as unknown as Json,
        p_idempotency_key: args.idempotencyKey,
        p_post: args.post,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async reverseInventoryAdjustment(adjustmentId: string, idempotencyKey: string) {
      const { data, error } = await db.rpc("reverse_inventory_adjustment", {
        p_adjustment_id: adjustmentId,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async listAdjustments(businessId: string, page: number, pageSize: number) {
      const fromIdx = (page - 1) * pageSize;
      const { data, error, count } = await db
        .from("inventory_adjustments")
        .select("*, inventory_adjustment_lines ( id )", { count: "exact" })
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .range(fromIdx, fromIdx + pageSize - 1);
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: data ?? [],
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      };
    },

    async getAdjustment(businessId: string, id: string) {
      const { data, error } = await db
        .from("inventory_adjustments")
        .select("*, inventory_adjustment_lines ( *, inventory_locations ( name ) )")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async reconciliation(businessId: string) {
      const { data, error } = await db
        .from("inventory_reconciliation_view")
        .select("*")
        .eq("business_id", businessId)
        .neq("difference", 0);
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async summary(businessId: string) {
      const { data, error } = await db
        .from("green_lot_inventory_view")
        .select("available_g, on_hand_g, reserved_g, stock_value, stock_status")
        .eq("business_id", businessId);
      if (error) throw fromDatabaseError(error);
      const rows = data ?? [];
      return {
        lots: rows.length,
        onHandG: rows.reduce((a, r) => a + (r.on_hand_g ?? 0), 0),
        reservedG: rows.reduce((a, r) => a + (r.reserved_g ?? 0), 0),
        availableG: rows.reduce((a, r) => a + (r.available_g ?? 0), 0),
        stockValue: rows.reduce((a, r) => a + (r.stock_value ?? 0), 0),
        lowStock: rows.filter((r) => r.stock_status === "low_stock").length,
        outOfStock: rows.filter((r) => r.stock_status === "out_of_stock").length,
      };
    },

    async filterOptions(businessId: string) {
      const { data, error } = await db
        .from("green_lot_inventory_view")
        .select("country, processing_method, supplier_id, supplier_name")
        .eq("business_id", businessId);
      if (error) throw fromDatabaseError(error);
      const rows = data ?? [];
      const countries = [...new Set(rows.map((r) => r.country).filter(Boolean))].sort() as string[];
      const processes = [
        ...new Set(rows.map((r) => r.processing_method).filter(Boolean)),
      ].sort() as string[];
      const supplierMap = new Map<string, string>();
      for (const r of rows)
        if (r.supplier_id && r.supplier_name) supplierMap.set(r.supplier_id, r.supplier_name);
      const suppliers = [...supplierMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { countries, processes, suppliers };
    },
  };
}
