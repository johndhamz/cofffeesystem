import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessSettings, TablesUpdate } from "@/types";
import { fromDatabaseError, Errors } from "@/lib/errors";

export function settingsRepository(db: SupabaseServerClient) {
  return {
    async getByBusiness(businessId: string): Promise<BusinessSettings> {
      const { data, error } = await db
        .from("business_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) throw fromDatabaseError(error);
      if (!data) throw Errors.notFound("Business settings");
      return data;
    },

    async update(
      businessId: string,
      values: TablesUpdate<"business_settings">,
    ): Promise<BusinessSettings> {
      const { data, error } = await db
        .from("business_settings")
        .update(values)
        .eq("business_id", businessId)
        .select("*")
        .single();
      if (error) throw fromDatabaseError(error);
      return data;
    },

    async updateBusinessName(businessId: string, name: string): Promise<void> {
      const { error } = await db.from("businesses").update({ name }).eq("id", businessId);
      if (error) throw fromDatabaseError(error);
    },

    async listMembers(businessId: string) {
      const { data, error } = await db
        .from("business_members")
        .select(
          "id, role, is_active, created_at, user_profiles!business_members_user_id_fkey ( id, email, full_name )",
        )
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },

    async recentAuditLogs(businessId: string, limit = 50) {
      const { data, error } = await db
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, actor_id, created_at, before_data, after_data")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw fromDatabaseError(error);
      return data ?? [];
    },
  };
}
