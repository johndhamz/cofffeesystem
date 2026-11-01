import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Database, Paginated } from "@/types";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

export type SalesOrderSummary = Database["public"]["Views"]["sales_order_summary_view"]["Row"];
export type CustomerSummary = Database["public"]["Views"]["customer_summary_view"]["Row"];
export type VariantAvailability = Database["public"]["Views"]["variant_availability_view"]["Row"];

export interface OrderListQuery {
  q?: string;
  status?: string;
  payment?: string;
  customer?: string;
  channel?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
  sort?: string;
  dir: "asc" | "desc";
}

const SORTABLE = [
  "order_number",
  "ordered_at",
  "status",
  "payment_status",
  "total_amount",
  "outstanding_amount",
  "customer_name",
  "channel_name",
];

export function salesRepository(db: SupabaseServerClient) {
  return {
    async listOrders(businessId: string, q: OrderListQuery): Promise<Paginated<SalesOrderSummary>> {
      const sort = q.sort && SORTABLE.includes(q.sort) ? q.sort : "ordered_at";
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("sales_order_summary_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (q.status && q.status !== "all") b = b.eq("status", q.status as never);
      if (q.payment && q.payment !== "all") b = b.eq("payment_status", q.payment as never);
      if (q.customer) b = b.eq("customer_id", q.customer);
      if (q.channel) b = b.eq("sales_channel_id", q.channel);
      if (q.from) b = b.gte("ordered_at", q.from);
      if (q.to) b = b.lte("ordered_at", q.to);
      if (q.q)
        b = b.or(
          `order_number.ilike.%${escapeLike(q.q)}%,customer_name.ilike.%${escapeLike(q.q)}%,product_names.ilike.%${escapeLike(q.q)}%`,
        );
      b = b
        .order(sort, { ascending: q.dir === "asc", nullsFirst: false })
        .order("order_number", { ascending: false })
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

    async getOrder(businessId: string, id: string) {
      const [{ data: summary, error: e1 }, { data: detail, error: e2 }] = await Promise.all([
        db
          .from("sales_order_summary_view")
          .select("*")
          .eq("business_id", businessId)
          .eq("id", id)
          .maybeSingle(),
        db
          .from("sales_orders")
          .select(
            `*, customers ( id, name, customer_type, email, phone, address ), sales_channels ( id, name ),
             sales_order_items ( *, product_variants ( id, sku, name, net_weight_g, products ( name ) ),
               sales_order_allocations ( *, finished_goods_lots ( id, lot_code ) ) ),
             sales_fulfillments ( *, inventory_locations ( name ),
               sales_fulfillment_items ( *, finished_goods_lots ( id, lot_code ), sales_order_items ( product_variants ( sku, name, products ( name ) ) ) ) ),
             payments ( *, refunds ( * ) ),
             sales_returns ( *, sales_return_items ( *, sales_fulfillment_items ( finished_goods_lots ( lot_code ) ) ) )`,
          )
          .eq("business_id", businessId)
          .eq("id", id)
          .maybeSingle(),
      ]);
      if (e1) throw fromDatabaseError(e1);
      if (e2) throw fromDatabaseError(e2);
      return summary && detail ? { summary, detail } : null;
    },

    async createOrder(args: {
      businessId: string;
      customerId: string | null;
      channelId: string;
      priceTier: string;
      orderedAt: string;
      dueAt: string | null;
      discount: string;
      notes: string | null;
      items: {
        product_variant_id: string;
        quantity: number;
        unit_price: string;
        discount_amount: string;
      }[];
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("create_sales_order", {
        p_business_id: args.businessId,
        p_customer_id: args.customerId as string,
        p_sales_channel_id: args.channelId,
        p_price_tier: args.priceTier,
        p_ordered_at: args.orderedAt,
        p_due_at: args.dueAt as string,
        p_discount_amount: Number(args.discount),
        p_notes: args.notes as string,
        p_items: args.items as unknown as Json,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updateOrderDraft(args: {
      orderId: string;
      customerId: string | null;
      channelId: string;
      priceTier: string;
      orderedAt: string;
      dueAt: string | null;
      discount: string;
      notes: string | null;
      items: {
        product_variant_id: string;
        quantity: number;
        unit_price: string;
        discount_amount: string;
      }[];
    }) {
      const { data, error } = await db.rpc("update_sales_order_draft", {
        p_order_id: args.orderId,
        p_customer_id: args.customerId as string,
        p_sales_channel_id: args.channelId,
        p_price_tier: args.priceTier,
        p_ordered_at: args.orderedAt,
        p_due_at: args.dueAt as string,
        p_discount_amount: Number(args.discount),
        p_notes: args.notes as string,
        p_items: args.items as unknown as Json,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async confirm(orderId: string, reserve = true) {
      const { error } = await db.rpc("confirm_sales_order", {
        p_order_id: orderId,
        p_reserve: reserve,
      });
      if (error) throw fromDatabaseError(error);
    },

    async cancel(orderId: string, reason: string) {
      const { error } = await db.rpc("cancel_sales_order", {
        p_order_id: orderId,
        p_reason: reason,
      });
      if (error) throw fromDatabaseError(error);
    },

    async deleteDraft(businessId: string, id: string) {
      const { error } = await db
        .from("sales_orders")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw fromDatabaseError(error);
    },

    async fulfill(args: {
      orderId: string;
      locationId: string | null;
      fulfilledAt: string;
      items: { order_item_id: string; finished_goods_lot_id: string; quantity: number }[];
      notes: string | null;
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("fulfill_sales_order", {
        p_order_id: args.orderId,
        p_location_id: args.locationId as string,
        p_fulfilled_at: args.fulfilledAt,
        p_items: args.items as unknown as Json,
        p_notes: args.notes as string,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async recordPayment(args: {
      orderId: string;
      amount: string;
      method: string;
      reference: string | null;
      receivedAt: string;
      notes: string | null;
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("record_payment", {
        p_order_id: args.orderId,
        p_amount: Number(args.amount),
        p_method: args.method,
        p_reference: args.reference as string,
        p_received_at: args.receivedAt,
        p_notes: args.notes as string,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async issueRefund(args: {
      paymentId: string;
      amount: string;
      reason: string;
      method: string;
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("issue_refund", {
        p_payment_id: args.paymentId,
        p_amount: Number(args.amount),
        p_reason: args.reason,
        p_method: args.method,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async createReturn(args: {
      orderId: string;
      locationId: string | null;
      reason: string;
      receivedAt: string;
      notes: string | null;
      items: {
        fulfillment_item_id: string;
        quantity: number;
        condition: string;
        disposition: string;
      }[];
      idempotencyKey: string;
    }) {
      const { data, error } = await db.rpc("create_sales_return", {
        p_order_id: args.orderId,
        p_location_id: args.locationId as string,
        p_reason: args.reason,
        p_received_at: args.receivedAt,
        p_notes: args.notes as string,
        p_items: args.items as unknown as Json,
        p_idempotency_key: args.idempotencyKey,
      });
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async variantAvailability(businessId: string): Promise<VariantAvailability[]> {
      const { data, error } = await db
        .from("variant_availability_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("product_name")
        .order("net_weight_g");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async lotsForVariant(businessId: string, variantId: string) {
      const { data, error } = await db
        .from("finished_goods_inventory_view")
        .select(
          "lot_id, lot_code, available, on_hand, reserved, unit_cost, packaged_at, best_before_at",
        )
        .eq("business_id", businessId)
        .eq("variant_id", variantId)
        .gt("on_hand", 0)
        .order("packaged_at");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async customers(
      businessId: string,
      q: {
        q?: string;
        status?: string;
        page: number;
        pageSize: number;
        sort?: string;
        dir: "asc" | "desc";
      },
    ): Promise<Paginated<CustomerSummary>> {
      const sortable = [
        "name",
        "customer_type",
        "orders",
        "revenue",
        "outstanding",
        "last_order_at",
        "is_active",
      ];
      const sort = q.sort && sortable.includes(q.sort) ? q.sort : "name";
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("customer_summary_view")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);
      if (q.status === "active") b = b.eq("is_active", true);
      if (q.status === "inactive") b = b.eq("is_active", false);
      if (q.q)
        b = b.or(
          `name.ilike.%${escapeLike(q.q)}%,email.ilike.%${escapeLike(q.q)}%,phone.ilike.%${escapeLike(q.q)}%`,
        );
      b = b
        .order(sort, { ascending: q.dir === "asc", nullsFirst: false })
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

    async customer(businessId: string, id: string): Promise<CustomerSummary | null> {
      const { data, error } = await db
        .from("customer_summary_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async salesSummary(businessId: string, range?: { from?: string; to?: string }) {
      let b = db
        .from("sales_order_summary_view")
        .select(
          "status, payment_status, total_amount, outstanding_amount, total_cogs, fulfilled_units, ordered_at",
        )
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .neq("status", "draft");
      if (range?.from) b = b.gte("ordered_at", range.from);
      if (range?.to) b = b.lte("ordered_at", range.to);
      const { data, error } = await b;
      if (error) throw fromDatabaseError(error);
      const rows = data ?? [];
      const fulfilled = rows.filter((r) =>
        ["partially_fulfilled", "fulfilled", "completed", "returned"].includes(r.status),
      );
      return {
        orders: rows.length,
        open: rows.filter((r) =>
          ["confirmed", "reserved", "partially_fulfilled"].includes(r.status),
        ).length,
        revenue: fulfilled.reduce((a, r) => a + r.total_amount, 0),
        cogs: fulfilled.reduce((a, r) => a + (r.total_cogs ?? 0), 0),
        outstanding: rows.reduce((a, r) => a + Math.max(0, r.outstanding_amount ?? 0), 0),
        unitsSold: fulfilled.reduce((a, r) => a + (r.fulfilled_units ?? 0), 0),
      };
    },

    async salesHistory(
      businessId: string,
      q: { from?: string; to?: string; page: number; pageSize: number },
    ) {
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("sales_fulfillment_items")
        .select(
          "id, quantity, unit_price_snapshot, unit_cost_snapshot, total_cost, returned_quantity, finished_goods_lots ( lot_code ), sales_order_items ( product_variants ( sku, name, products ( name ) ) ), sales_fulfillments!inner ( fulfilled_at, fulfillment_number, status, sales_orders ( id, order_number, customers ( name ), sales_channels ( name ) ) )",
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .eq("sales_fulfillments.status", "posted");
      if (q.from) b = b.gte("sales_fulfillments.fulfilled_at", q.from);
      if (q.to) b = b.lte("sales_fulfillments.fulfilled_at", q.to);
      b = b.order("created_at", { ascending: false }).range(fromIdx, fromIdx + q.pageSize - 1);
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
  };
}
