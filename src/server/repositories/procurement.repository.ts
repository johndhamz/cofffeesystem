import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Paginated, PurchaseOrderStatus } from "@/types";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

export interface PurchaseOrderListQuery {
  q?: string;
  status?: PurchaseOrderStatus | "all";
  supplier?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}

const PO_SORTABLE = ["purchase_number", "ordered_at", "status", "total", "created_at"];

export function procurementRepository(db: SupabaseServerClient) {
  return {
    async listPurchaseOrders(businessId: string, query: PurchaseOrderListQuery) {
      const sort = query.sort && PO_SORTABLE.includes(query.sort) ? query.sort : "ordered_at";
      const fromIdx = (query.page - 1) * query.pageSize;
      let builder = db
        .from("purchase_orders")
        .select("*, suppliers!inner ( id, name )", { count: "exact" })
        .eq("business_id", businessId);
      if (query.status && query.status !== "all") builder = builder.eq("status", query.status);
      if (query.supplier) builder = builder.eq("supplier_id", query.supplier);
      if (query.q) builder = builder.ilike("purchase_number", `%${escapeLike(query.q)}%`);
      builder = builder
        .order(sort, { ascending: query.dir === "asc" })
        .order("created_at", { ascending: false })
        .range(fromIdx, fromIdx + query.pageSize - 1);
      const { data, error, count } = await builder;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      const result: Paginated<NonNullable<typeof data>[number]> = {
        rows: data ?? [],
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      };
      return result;
    },

    async getPurchaseOrder(businessId: string, id: string) {
      const { data, error } = await db
        .from("purchase_orders")
        .select(
          `*, suppliers ( id, name ),
           purchase_order_items ( *, green_coffees ( id, name, country, processing_method ) ),
           goods_receipts ( *, inventory_locations ( id, name ),
             goods_receipt_items ( *, green_coffee_lots ( id, lot_code ) ) )`,
        )
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async createPurchaseOrder(args: {
      businessId: string;
      supplierId: string;
      orderedAt: string;
      notes: string | null;
      additionalCosts: string;
      items: { green_coffee_id: string; ordered_quantity_g: number; unit_cost: string }[];
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("create_purchase_order", {
        p_business_id: args.businessId,
        p_supplier_id: args.supplierId,
        p_ordered_at: args.orderedAt,
        p_notes: args.notes as string,
        p_additional_costs: Number(args.additionalCosts),
        p_items: args.items as unknown as Json,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updatePurchaseOrderDraft(args: {
      purchaseOrderId: string;
      supplierId: string;
      orderedAt: string;
      notes: string | null;
      additionalCosts: string;
      items: { green_coffee_id: string; ordered_quantity_g: number; unit_cost: string }[];
    }) {
      const { data, error } = await db.rpc("update_purchase_order_draft", {
        p_purchase_order_id: args.purchaseOrderId,
        p_supplier_id: args.supplierId,
        p_ordered_at: args.orderedAt,
        p_notes: args.notes as string,
        p_additional_costs: Number(args.additionalCosts),
        p_items: args.items as unknown as Json,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async confirmPurchaseOrder(id: string) {
      const { error } = await db.rpc("confirm_purchase_order", { p_purchase_order_id: id });
      if (error) throw fromDatabaseError(error);
    },

    async cancelPurchaseOrder(id: string) {
      const { error } = await db.rpc("cancel_purchase_order", { p_purchase_order_id: id });
      if (error) throw fromDatabaseError(error);
    },

    async deleteDraftPurchaseOrder(businessId: string, id: string) {
      const { error } = await db
        .from("purchase_orders")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw fromDatabaseError(error);
    },

    async createGoodsReceipt(args: {
      purchaseOrderId: string;
      locationId: string;
      receivedAt: string;
      additionalCosts: string;
      notes: string | null;
      items: {
        purchase_order_item_id: string;
        received_quantity_g: number;
        allocated_landed_cost: string;
        green_lot_id: string | null;
        new_lot: {
          lot_code: string | null;
          moisture_pct: number | null;
          density_g_per_100ml: number | null;
          notes: string | null;
        } | null;
      }[];
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("create_goods_receipt", {
        p_purchase_order_id: args.purchaseOrderId,
        p_location_id: args.locationId,
        p_received_at: args.receivedAt,
        p_additional_costs: Number(args.additionalCosts),
        p_notes: args.notes as string,
        p_items: args.items as unknown as Json,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async postGoodsReceipt(receiptId: string) {
      const { data, error } = await db.rpc("post_goods_receipt", { p_receipt_id: receiptId });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async getGoodsReceipt(businessId: string, id: string) {
      const { data, error } = await db
        .from("goods_receipts")
        .select(
          `*, inventory_locations ( id, name ), purchase_orders ( id, purchase_number, suppliers ( name ) ),
           goods_receipt_items ( *, green_coffee_lots ( id, lot_code ), purchase_order_items ( id, unit_cost, green_coffees ( name ) ) )`,
        )
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },
  };
}
