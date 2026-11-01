import type { Permission } from "@/lib/permissions/policy";

export type NavIcon =
  | "dashboard"
  | "bean"
  | "cart"
  | "flame"
  | "package"
  | "coffee"
  | "boxes"
  | "receipt"
  | "users"
  | "wallet"
  | "chart"
  | "settings";

/** Serializable navigation config (safe to pass from server to client components). */
export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Green Coffee", href: "/green-coffee", icon: "bean", permission: "master_data.read" },
  { label: "Purchases", href: "/purchases", icon: "cart", permission: "purchases.read" },
  { label: "Roast Production", href: "/roasting", icon: "flame", permission: "roasting.read" },
  { label: "Packaging", href: "/packaging", icon: "package", permission: "packaging.read" },
  { label: "Products", href: "/products", icon: "coffee", permission: "products.read" },
  { label: "Inventory", href: "/inventory", icon: "boxes", permission: "inventory.read" },
  { label: "Sales", href: "/sales", icon: "receipt", permission: "sales.read" },
  { label: "Customers", href: "/customers", icon: "users", permission: "customers.read" },
  { label: "Expenses", href: "/expenses", icon: "wallet", permission: "expenses.read" },
  { label: "Reports", href: "/reports", icon: "chart", permission: "reports.read" },
  { label: "Settings", href: "/settings", icon: "settings", permission: "business.settings.read" },
];
