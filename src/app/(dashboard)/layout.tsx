import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/session";
import { getMfaStatus } from "@/lib/auth/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MfaRequiredBanner } from "@/features/security/mfa-required-banner";
import { roleHasPermission } from "@/lib/permissions/policy";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_ITEMS } from "@/components/layout/nav";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireBusiness();
  const db = await createSupabaseServerClient();
  const [{ data: settings }, mfa] = await Promise.all([
    db
      .from("business_settings")
      .select("require_mfa")
      .eq("business_id", ctx.business.businessId)
      .single(),
    getMfaStatus(),
  ]);
  const mfaRequired = (settings?.require_mfa ?? false) && mfa.factors.length === 0;
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (mfaRequired && pathname && !pathname.startsWith("/settings/security"))
    redirect("/settings/security");
  const navItems = NAV_ITEMS.filter(
    (item) => !item.permission || roleHasPermission(ctx.business.role, item.permission),
  );

  return (
    <AppShell
      businessName={ctx.business.businessName}
      user={{ name: ctx.profile.fullName, email: ctx.profile.email, role: ctx.business.role }}
      navItems={navItems}
    >
      {mfaRequired ? <MfaRequiredBanner /> : null}
      {children}
    </AppShell>
  );
}
