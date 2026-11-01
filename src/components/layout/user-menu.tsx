"use client";

import { LogOutIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/auth/actions";
import { ROLE_LABELS, type Role } from "@/lib/permissions/policy";

interface UserMenuProps {
  name: string | null;
  email: string;
  role: Role | null;
}

export function UserMenu({ name, email, role }: UserMenuProps) {
  const initials = (name ?? email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2" data-testid="user-menu-trigger">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">
              {initials || <UserIcon className="size-3.5" />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm sm:inline">{name ?? email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" data-testid="user-menu">
        <DropdownMenuLabel className="font-normal">
          <div className="space-y-0.5">
            <p className="truncate text-sm font-medium">{name ?? email}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
            {role ? (
              <p className="text-muted-foreground text-xs" data-testid="user-role">
                {ROLE_LABELS[role]}
              </p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full" data-testid="logout-button">
              <LogOutIcon className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
