"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  BeanIcon,
  BoxesIcon,
  CoffeeIcon,
  FlameIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "./nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  bean: BeanIcon,
  cart: ShoppingCartIcon,
  flame: FlameIcon,
  package: PackageIcon,
  coffee: CoffeeIcon,
  boxes: BoxesIcon,
  receipt: ReceiptIcon,
  users: UsersIcon,
  wallet: WalletIcon,
  chart: BarChart3Icon,
  settings: SettingsIcon,
};

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main" data-testid="sidebar-nav">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            data-testid={`nav-${item.href.replace("/", "")}`}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
