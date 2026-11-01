"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CoffeeIcon, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { NavItem } from "./nav";
import type { Role } from "@/lib/permissions/policy";

interface AppShellProps {
  businessName: string;
  user: { name: string | null; email: string; role: Role | null };
  navItems: NavItem[];
  children: ReactNode;
}

export function AppShell({ businessName, user, navItems, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1" data-testid="brand">
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
        <CoffeeIcon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold" data-testid="business-name">
          {businessName}
        </span>
        <span className="text-muted-foreground block text-[11px] leading-tight">
          Coffee Roastery OS
        </span>
      </span>
    </Link>
  );

  return (
    <div className="flex min-h-svh w-full">
      <aside
        className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col border-r lg:flex"
        data-testid="sidebar"
      >
        <div className="p-3">{brand}</div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <SidebarNav items={navItems} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-4"
          data-testid="topnav"
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
                data-testid="mobile-nav-trigger"
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-3">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mb-3">{brand}</div>
              <SidebarNav items={navItems} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 lg:hidden">
            <span className="truncate text-sm font-semibold">{businessName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <UserMenu name={user.name} email={user.email} role={user.role} />
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8" data-testid="main">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
