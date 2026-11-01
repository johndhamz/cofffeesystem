/**
 * Centralized permission policy.
 *
 * MIRRORS public.role_permissions in supabase/migrations/20261031000001_foundation.sql.
 * The integration test `permissions.test.ts` asserts the two stay identical.
 * RLS uses the database copy; the app uses this copy for server-side checks and UI gating.
 */

export const ROLES = ["owner", "roaster", "inventory_staff", "sales_staff", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "business.settings.read",
  "business.settings.update",
  "members.read",
  "members.manage",
  "audit.read",
  "master_data.read",
  "suppliers.manage",
  "green_coffees.manage",
  "roasters.manage",
  "locations.manage",
  "expense_categories.manage",
  "sales_channels.manage",
  "purchases.read",
  "purchases.manage",
  "purchases.post",
  "inventory.read",
  "inventory.adjust",
  "roasting.read",
  "roasting.manage",
  "packaging.read",
  "packaging.manage",
  "products.read",
  "products.manage",
  "sales.read",
  "sales.manage",
  "customers.read",
  "customers.manage",
  "expenses.read",
  "expenses.manage",
  "expenses.allocate",
  "reports.read",
  "finance.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_ALL: Permission[] = [
  "business.settings.read",
  "members.read",
  "master_data.read",
  "purchases.read",
  "inventory.read",
  "roasting.read",
  "packaging.read",
  "products.read",
  "sales.read",
  "customers.read",
  "expenses.read",
  "reports.read",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set<Permission>(PERMISSIONS),
  roaster: new Set<Permission>([
    "business.settings.read",
    "members.read",
    "master_data.read",
    "green_coffees.manage",
    "purchases.read",
    "inventory.read",
    "roasting.read",
    "roasting.manage",
    "packaging.read",
    "packaging.manage",
    "products.read",
    "reports.read",
  ]),
  inventory_staff: new Set<Permission>([
    "business.settings.read",
    "members.read",
    "master_data.read",
    "suppliers.manage",
    "green_coffees.manage",
    "locations.manage",
    "purchases.read",
    "purchases.manage",
    "purchases.post",
    "inventory.read",
    "inventory.adjust",
    "roasting.read",
    "packaging.read",
    "packaging.manage",
    "products.read",
    "reports.read",
  ]),
  sales_staff: new Set<Permission>([
    "business.settings.read",
    "members.read",
    "master_data.read",
    "inventory.read",
    "products.read",
    "sales.read",
    "sales.manage",
    "customers.read",
    "customers.manage",
    "reports.read",
  ]),
  viewer: new Set<Permission>(READ_ALL),
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]].sort();
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  roaster: "Roaster",
  inventory_staff: "Inventory Staff",
  sales_staff: "Sales Staff",
  viewer: "Viewer",
};
