import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
} from "@/lib/permissions/policy";

describe("permission policy", () => {
  it("gives owners every permission", () => {
    expect(permissionsForRole("owner")).toEqual([...PERMISSIONS].sort());
  });

  it("keeps viewers read-only", () => {
    for (const p of permissionsForRole("viewer")) {
      expect(p.endsWith(".read")).toBe(true);
    }
  });

  it("restricts business settings and roasters to owners", () => {
    for (const role of ROLES) {
      expect(roleHasPermission(role, "business.settings.update")).toBe(role === "owner");
      expect(roleHasPermission(role, "roasters.manage")).toBe(role === "owner");
    }
  });

  it("lets inventory staff post receipts and adjust stock but not sell", () => {
    expect(roleHasPermission("inventory_staff", "purchases.post")).toBe(true);
    expect(roleHasPermission("inventory_staff", "inventory.adjust")).toBe(true);
    expect(roleHasPermission("inventory_staff", "sales.manage")).toBe(false);
  });

  it("only uses known permissions", () => {
    for (const role of ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    }
  });
});
