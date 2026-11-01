import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { unique } from "./users";

/**
 * Service-role helpers for test accounts. Only used by Playwright's Node side (never the browser)
 * to create/delete throwaway users so MFA and invitation specs never touch the seeded roles.
 */
function admin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function testEmail(prefix: string) {
  return `${unique(prefix).replace(/\s+/g, "-").toLowerCase()}@coffee.test`;
}

/** Creates a confirmed user and an active membership in the given business. */
export async function createMemberUser(
  businessId: string,
  role: Database["public"]["Enums"]["member_role"] = "roaster",
) {
  const db = admin();
  const email = testEmail("e2e-user");
  const password = "E2EUserPass123!";
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: mErr } = await db
    .from("business_members")
    .insert({ business_id: businessId, user_id: data.user.id, role });
  if (mErr) throw mErr;
  return { id: data.user.id, email, password };
}

export async function deleteUserByEmail(email: string) {
  const db = admin();
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return;
  await db.from("business_members").delete().eq("user_id", user.id);
  await db.auth.admin.deleteUser(user.id);
}

export async function setRequireMfa(businessId: string, value: boolean) {
  const { error } = await admin()
    .from("business_settings")
    .update({ require_mfa: value })
    .eq("business_id", businessId);
  if (error) throw error;
}

/** Undo anything a crashed earlier run may have left behind (MFA policy, throwaway users). */
export async function resetTestState() {
  const db = admin();
  await db.from("business_settings").update({ require_mfa: false }).eq("require_mfa", true);
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (/^(e2e-user|invitee)-/.test(u.email ?? "")) {
      await db.from("business_members").delete().eq("user_id", u.id);
      await db.auth.admin.deleteUser(u.id);
    }
  }
}
