import { requireBusiness } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/permissions/policy";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_ITEMS } from "@/components/layout/nav";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireBusiness();
  const navItems = NAV_ITEMS.filter(
    (item) => !item.permission || roleHasPermission(ctx.business.role, item.permission),
  );

  return (
    <AppShell
      businessName={ctx.business.businessName}
      user={{ name: ctx.profile.fullName, email: ctx.profile.email, role: ctx.business.role }}
      navItems={navItems}
    >
      {children}
    </AppShell>
  );
}
