import { describe, expect, it } from "vitest";
import { adminClient } from "./helpers";
import { ROLES, permissionsForRole } from "@/lib/permissions/policy";

describe("permission matrix", () => {
  it("database role_permissions matches the application policy exactly", async () => {
    const db = adminClient();
    const { data, error } = await db.from("role_permissions").select("role, permission");
    expect(error).toBeNull();
    for (const role of ROLES) {
      const dbPerms = (data ?? [])
        .filter((r) => r.role === role)
        .map((r) => r.permission)
        .sort();
      expect(dbPerms, `permissions for ${role}`).toEqual(permissionsForRole(role));
    }
  });
});
