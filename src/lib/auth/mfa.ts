import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";

export interface MfaStatus {
  /** verified TOTP factors on the account */
  factors: { id: string; friendlyName: string | null; createdAt: string }[];
  /** 'aal1' = password only, 'aal2' = second factor verified in this session */
  currentLevel: "aal1" | "aal2" | null;
  /** highest level the account can reach */
  nextLevel: "aal1" | "aal2" | null;
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createSupabaseServerClient();
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return {
    factors: (factors?.totp ?? [])
      .filter((f) => f.status === "verified")
      .map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null, createdAt: f.created_at })),
    currentLevel: (aal?.currentLevel as MfaStatus["currentLevel"]) ?? null,
    nextLevel: (aal?.nextLevel as MfaStatus["nextLevel"]) ?? null,
  };
}

/**
 * Where a freshly signed-in user should land. Resolved in the sign-in actions themselves (not only
 * in the proxy/layout) because a redirect chained behind a server-action redirect leaves the
 * browser on the wrong URL.
 */
export async function resolvePostLoginPath(next: string): Promise<string> {
  const status = await getMfaStatus();
  if (status.nextLevel === "aal2" && status.currentLevel !== "aal2") {
    return `/mfa?next=${encodeURIComponent(next)}`;
  }
  if (status.factors.length === 0) {
    const ctx = await getSessionContext();
    if (ctx?.business) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("business_settings")
        .select("require_mfa")
        .eq("business_id", ctx.business.businessId)
        .maybeSingle();
      if (data?.require_mfa) return "/settings/security";
    }
  }
  return next;
}
