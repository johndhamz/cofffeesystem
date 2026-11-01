import type { Metadata } from "next";
import Link from "next/link";
import {
  BeanIcon,
  FlameIcon,
  MapPinIcon,
  ReceiptIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getSessionContext, can } from "@/lib/auth/session";
import { getBusinessSettings, listBusinessMembers } from "@/server/services/settings.service";
import { BusinessSettingsForm } from "@/features/settings/business-settings-form";
import { ROLE_LABELS } from "@/lib/permissions/policy";
import { ActiveBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Settings" };

const LINKS = [
  {
    href: "/settings/suppliers",
    label: "Suppliers",
    icon: TruckIcon,
    description: "Who you buy from",
  },
  {
    href: "/green-coffee",
    label: "Green coffee catalog",
    icon: BeanIcon,
    description: "Coffees you purchase",
  },
  {
    href: "/settings/roasters",
    label: "Roasters",
    icon: FlameIcon,
    description: "Machines and capacity",
  },
  {
    href: "/settings/locations",
    label: "Inventory locations",
    icon: MapPinIcon,
    description: "Where stock is kept",
  },
  {
    href: "/settings/expense-categories",
    label: "Expense categories",
    icon: ReceiptIcon,
    description: "Expense grouping",
  },
  {
    href: "/settings/sales-channels",
    label: "Sales channels",
    icon: StoreIcon,
    description: "Where you sell",
  },
];

export default async function SettingsPage() {
  const [ctx, data, members] = await Promise.all([
    getSessionContext(),
    getBusinessSettings(),
    listBusinessMembers(),
  ]);
  const canUpdate = can(ctx, "business.settings.update");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Business configuration and master data." />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business settings</CardTitle>
            <CardDescription>
              {canUpdate
                ? "Defaults used across purchasing, roasting and sales."
                : "Only owners can change these settings."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessSettingsForm
              businessName={data.business.businessName}
              settings={data.settings}
              roasters={data.roasters.map((r) => ({ id: r.id, name: r.name }))}
              locations={data.locations.map((l) => ({ id: l.id, name: l.name }))}
              canUpdate={canUpdate}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group"
                  data-testid={`settings-link-${link.href.split("/").pop()}`}
                >
                  <Card className="group-hover:border-foreground/30 h-full gap-1 py-4 transition-colors">
                    <CardContent className="flex items-start gap-3 px-4">
                      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{link.label}</span>
                        <span className="text-muted-foreground block text-xs">
                          {link.description}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersIcon className="size-4" /> Team members
              </CardTitle>
              <CardDescription>
                Members are provisioned by an administrator (see docs/SECURITY.md).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y" data-testid="members-list">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {m.user_profiles?.full_name ?? m.user_profiles?.email}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {m.user_profiles?.email}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{ROLE_LABELS[m.role]}</span>
                      <ActiveBadge isActive={m.is_active} />
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
