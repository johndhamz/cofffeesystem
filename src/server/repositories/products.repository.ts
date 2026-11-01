import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Paginated, Tables } from "@/types";
import type { ListQuery } from "@/lib/validation/common";
import { fromDatabaseError } from "@/lib/errors";
import { escapeLike } from "./master-data.repository";

export type ProductRow = Tables<"products"> & { product_variants: Tables<"product_variants">[] };

export function productsRepository(db: SupabaseServerClient) {
  return {
    async list(businessId: string, q: ListQuery): Promise<Paginated<ProductRow>> {
      const sort = ["name", "category", "is_active", "created_at"].includes(q.sort ?? "")
        ? q.sort!
        : "name";
      const fromIdx = (q.page - 1) * q.pageSize;
      let b = db
        .from("products")
        .select("*, product_variants ( * )", { count: "exact" })
        .eq("business_id", businessId);
      if (q.status === "active") b = b.eq("is_active", true);
      if (q.status === "inactive") b = b.eq("is_active", false);
      if (q.q) b = b.or(`name.ilike.%${escapeLike(q.q)}%,description.ilike.%${escapeLike(q.q)}%`);
      b = b.order(sort, { ascending: q.dir === "asc" }).range(fromIdx, fromIdx + q.pageSize - 1);
      const { data, error, count } = await b;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: (data ?? []) as ProductRow[],
        total,
        page: q.page,
        pageSize: q.pageSize,
        pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
      };
    },

    async get(businessId: string, id: string) {
      const { data, error } = await db
        .from("products")
        .select(
          "*, product_variants ( *, variant_materials ( *, packaging_materials ( id, name, base_unit ) ) )",
        )
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async findByName(businessId: string, name: string, excludeId?: string) {
      let b = db
        .from("products")
        .select("id")
        .eq("business_id", businessId)
        .ilike("name", name.trim());
      if (excludeId) b = b.neq("id", excludeId);
      const { data, error } = await b.limit(1).maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async create(
      values: Tables<"products">["business_id"] extends string ? Record<string, unknown> : never,
    ) {
      const { data, error } = await db
        .from("products")
        .insert(values as never)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async update(businessId: string, id: string, values: Record<string, unknown>) {
      const { data, error } = await db
        .from("products")
        .update(values as never)
        .eq("business_id", businessId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async findVariantBySku(businessId: string, sku: string, excludeId?: string) {
      let b = db
        .from("product_variants")
        .select("id")
        .eq("business_id", businessId)
        .ilike("sku", sku.trim());
      if (excludeId) b = b.neq("id", excludeId);
      const { data, error } = await b.limit(1).maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async upsertVariant(
      businessId: string,
      productId: string,
      id: string | null,
      values: Record<string, unknown>,
      materials: { material_id: string; quantity_per_unit: number }[],
    ) {
      let variantId = id;
      if (variantId) {
        const { error } = await db
          .from("product_variants")
          .update(values as never)
          .eq("business_id", businessId)
          .eq("id", variantId);
        if (error) throw fromDatabaseError(error);
      } else {
        const { data, error } = await db
          .from("product_variants")
          .insert({ ...values, business_id: businessId, product_id: productId } as never)
          .select("id")
          .single();
        if (error) throw fromDatabaseError(error);
        variantId = data.id;
      }
      const { error: delErr } = await db
        .from("variant_materials")
        .delete()
        .eq("variant_id", variantId);
      if (delErr) throw fromDatabaseError(delErr);
      const rows = materials
        .filter((m) => m.quantity_per_unit > 0)
        .map((m) => ({
          business_id: businessId,
          variant_id: variantId!,
          material_id: m.material_id,
          quantity_per_unit: m.quantity_per_unit,
        }));
      if (rows.length) {
        const { error } = await db.from("variant_materials").insert(rows);
        if (error) throw fromDatabaseError(error);
      }
      return variantId;
    },

    async setVariantActive(businessId: string, id: string, isActive: boolean) {
      const { error } = await db
        .from("product_variants")
        .update({ is_active: isActive })
        .eq("business_id", businessId)
        .eq("id", id);
      if (error) throw fromDatabaseError(error);
    },

    async activeVariants(businessId: string) {
      const { data, error } = await db
        .from("product_variants")
        .select(
          "id, sku, name, net_weight_g, selling_price, product_id, products!inner ( name, is_active ), variant_materials ( material_id, quantity_per_unit )",
        )
        .eq("business_id", businessId)
        .eq("is_active", true)
        .eq("products.is_active", true)
        .order("sku");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },
  };
}
