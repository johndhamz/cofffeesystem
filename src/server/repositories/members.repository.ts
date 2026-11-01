import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types";
import { fromDatabaseError } from "@/lib/errors";

export type MemberRow = Database["public"]["Views"]["business_member_directory_view"]["Row"];

export function membersRepository(db: SupabaseServerClient) {
  return {
    async list(businessId: string): Promise<MemberRow[]> {
      const { data, error } = await db
        .from("business_member_directory_view")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },
    async get(businessId: string, id: string): Promise<MemberRow | null> {
      const { data, error } = await db
        .from("business_member_directory_view")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },
    async findByUser(businessId: string, userId: string) {
      const { data, error } = await db
        .from("business_members")
        .select("id, role, is_active")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      return data;
    },
    async update(
      businessId: string,
      id: string,
      values: { role?: Database["public"]["Enums"]["member_role"]; is_active?: boolean },
    ) {
      const { data, error } = await db
        .from("business_members")
        .update(values)
        .eq("business_id", businessId)
        .eq("id", id)
        .select("id, role, is_active")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },
  };
}
