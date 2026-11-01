import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";
import { roleHasPermission, type Permission, type Role } from "@/lib/permissions/policy";

export interface BusinessContext {
  businessId: string;
  businessName: string;
  businessSlug: string;
  role: Role;
}

export interface SessionContext {
  user: User;
  profile: { id: string; email: string; fullName: string | null };
  business: BusinessContext | null;
  memberships: BusinessContext[];
}

/**
 * Resolves the signed-in user and their active business for the current request.
 * Cached per request (React cache) so layouts, pages and actions share one lookup.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase.rpc("my_memberships"),
    supabase.from("user_profiles").select("id, email, full_name").eq("id", user.id).maybeSingle(),
  ]);

  const list: BusinessContext[] = (memberships ?? []).map((m) => ({
    businessId: m.business_id,
    businessName: m.business_name,
    businessSlug: m.business_slug,
    role: m.role,
  }));

  // Single-business for now: the first membership is the active business.
  // (Future SaaS: select by cookie/subdomain here.)
  const business = list[0] ?? null;

  return {
    user,
    profile: {
      id: user.id,
      email: profile?.email ?? user.email ?? "",
      fullName: profile?.full_name ?? null,
    },
    business,
    memberships: list,
  };
});

/** For pages: redirect to login when signed out. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For pages: require a business membership as well. */
export async function requireBusiness(): Promise<SessionContext & { business: BusinessContext }> {
  const ctx = await requireSession();
  if (!ctx.business) redirect("/no-business");
  return ctx as SessionContext & { business: BusinessContext };
}

/**
 * For services/actions: throws AppError instead of redirecting so callers can return
 * structured results. Checks the permission against the central policy.
 */
export async function requirePermission(
  permission: Permission,
): Promise<SessionContext & { business: BusinessContext }> {
  const ctx = await getSessionContext();
  if (!ctx) throw Errors.unauthenticated();
  if (!ctx.business) throw Errors.forbidden("You are not a member of any business");
  if (!roleHasPermission(ctx.business.role, permission)) {
    throw Errors.forbidden(`Your role (${ctx.business.role}) cannot perform this action`);
  }
  return ctx as SessionContext & { business: BusinessContext };
}

export function can(ctx: SessionContext | null, permission: Permission): boolean {
  if (!ctx?.business) return false;
  return roleHasPermission(ctx.business.role, permission);
}
