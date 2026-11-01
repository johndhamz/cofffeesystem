import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Paginated } from "@/types";
import type { ListQuery } from "@/lib/validation/common";
import { fromDatabaseError } from "@/lib/errors";

export const MASTER_TABLES = [
  "suppliers",
  "green_coffees",
  "roasters",
  "inventory_locations",
  "expense_categories",
  "sales_channels",
  "roast_profiles",
  "packaging_materials",
  "customers",
] as const;
export type MasterTable = (typeof MASTER_TABLES)[number];

export type MasterRow<T extends MasterTable> = Database["public"]["Tables"][T]["Row"];
export type MasterInsert<T extends MasterTable> = Database["public"]["Tables"][T]["Insert"];
export type MasterUpdate<T extends MasterTable> = Database["public"]["Tables"][T]["Update"];

interface ListOptions {
  searchColumns: string[];
  sortableColumns: string[];
  defaultSort: string;
}

/**
 * Generic repository for simple business-scoped master tables.
 * Every query is constrained by business_id in addition to RLS (defense in depth).
 */
export function masterDataRepository<T extends MasterTable>(db: SupabaseServerClient, table: T) {
  // Supabase's typed query builder does not accept a union table name generically; we narrow once here.
  const from = () => db.from(table as "suppliers");

  return {
    async list(
      businessId: string,
      query: ListQuery,
      options: ListOptions,
    ): Promise<Paginated<MasterRow<T>>> {
      const sort =
        query.sort && options.sortableColumns.includes(query.sort)
          ? query.sort
          : options.defaultSort;
      const fromIdx = (query.page - 1) * query.pageSize;
      const toIdx = fromIdx + query.pageSize - 1;

      let builder = from().select("*", { count: "exact" }).eq("business_id", businessId);
      if (query.status === "active") builder = builder.eq("is_active", true);
      if (query.status === "inactive") builder = builder.eq("is_active", false);
      if (query.q) {
        const term = `%${escapeLike(query.q)}%`;
        builder = builder.or(options.searchColumns.map((c) => `${c}.ilike.${term}`).join(","));
      }
      builder = builder
        .order(sort, { ascending: query.dir === "asc", nullsFirst: false })
        .range(fromIdx, toIdx);

      const { data, error, count } = await builder;
      if (error) throw fromDatabaseError(error);
      const total = count ?? 0;
      return {
        rows: (data ?? []) as unknown as MasterRow<T>[],
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    },

    async listActive(businessId: string): Promise<MasterRow<T>[]> {
      const { data, error } = await from()
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("name");
      if (error) throw fromDatabaseError(error);
      return (data ?? []) as unknown as MasterRow<T>[];
    },

    async getById(businessId: string, id: string): Promise<MasterRow<T> | null> {
      const { data, error } = await from()
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return (data as unknown as MasterRow<T>) ?? null;
    },

    async findByName(
      businessId: string,
      name: string,
      excludeId?: string,
    ): Promise<MasterRow<T> | null> {
      let builder = from().select("*").eq("business_id", businessId).ilike("name", name.trim());
      if (excludeId) builder = builder.neq("id", excludeId);
      const { data, error } = await builder.limit(1).maybeSingle();
      if (error) throw fromDatabaseError(error);
      return (data as unknown as MasterRow<T>) ?? null;
    },

    async create(values: MasterInsert<T>): Promise<MasterRow<T>> {
      const { data, error } = await from()
        .insert(values as never)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data as unknown as MasterRow<T>;
    },

    async update(businessId: string, id: string, values: MasterUpdate<T>): Promise<MasterRow<T>> {
      const { data, error } = await from()
        .update(values as never)
        .eq("business_id", businessId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data as unknown as MasterRow<T>;
    },

    async remove(businessId: string, id: string): Promise<void> {
      const { error } = await from().delete().eq("business_id", businessId).eq("id", id);
      if (error) throw fromDatabaseError(error);
    },
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, (m) => `\\${m}`);
}
