import path from "node:path";

export const TEST_USERS = {
  owner: {
    email: process.env.E2E_OWNER_EMAIL ?? "owner@coffee.test",
    password: process.env.E2E_OWNER_PASSWORD ?? "OwnerPass123!",
  },
  viewer: {
    email: process.env.E2E_VIEWER_EMAIL ?? "viewer@coffee.test",
    password: process.env.E2E_VIEWER_PASSWORD ?? "ViewerPass123!",
  },
  inventory: {
    email: process.env.E2E_INVENTORY_EMAIL ?? "inventory@coffee.test",
    password: process.env.E2E_INVENTORY_PASSWORD ?? "InventoryPass123!",
  },
} as const;

export type TestRole = keyof typeof TEST_USERS;

export function authFile(role: TestRole): string {
  return path.resolve(__dirname, `../.auth/${role}.json`);
}

/** Unique suffix so parallel/repeated runs never collide on unique names. */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
