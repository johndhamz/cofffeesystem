import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireServiceRoleKey, serverEnv } from "@/lib/env/server";

/**
 * Service-role client. Bypasses RLS.
 * Use ONLY for administrative tasks (provisioning, scripts, tests). Never in request handlers
 * that act on behalf of a user.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(serverEnv.NEXT_PUBLIC_SUPABASE_URL, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
