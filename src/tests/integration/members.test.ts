import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as OTPAuth from "otpauth";
import type { Database } from "@/types/database";
import { adminClient, businessIdFor, SEED, uniq, userClient, type Db } from "./helpers";

/** Phase 7: team members (invitations, roles, deactivation guards) and TOTP multi-factor auth. */
let admin: Db;
let owner: Db;
let viewer: Db;
let other: Db;
let ownerId: string;
let businessId: string;
let otherBusinessId: string;
const createdUsers: string[] = [];

async function createUser(role = "viewer") {
  const email = `${uniq("member").replace(/\s/g, "-").toLowerCase()}@coffee.test`;
  const password = "MemberPass123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  createdUsers.push(data.user.id);
  return { id: data.user.id, email, password, role };
}

beforeAll(async () => {
  admin = adminClient();
  owner = await userClient(SEED.owner);
  viewer = await userClient(SEED.viewer);
  other = await userClient(SEED.otherOwner);
  businessId = await businessIdFor(owner);
  otherBusinessId = await businessIdFor(other, "other-roastery");
  ownerId = (await owner.auth.getUser()).data.user!.id;
});

afterAll(async () => {
  for (const id of createdUsers) {
    await admin.from("business_members").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
});

describe("member directory", () => {
  it("is visible only to members of the same business", async () => {
    const { data: mine } = await owner
      .from("business_member_directory_view")
      .select("email")
      .eq("business_id", businessId);
    expect(mine?.map((m) => m.email)).toContain(SEED.owner.email);
    const { data: foreign } = await other
      .from("business_member_directory_view")
      .select("email")
      .eq("business_id", businessId);
    expect(foreign).toEqual([]);
    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: nothing } = await anon.from("business_member_directory_view").select("email");
    expect(nothing ?? []).toEqual([]);
  });

  it("every role can read the directory but only owners can manage it", async () => {
    const { data: perms } = await owner
      .from("role_permissions")
      .select("role, permission")
      .like("permission", "members.%");
    const managers = perms?.filter((p) => p.permission === "members.manage").map((p) => p.role);
    expect(managers).toEqual(["owner"]);
    expect(perms?.filter((p) => p.permission === "members.read").length).toBe(5);
  });
});

describe("invitations and membership lifecycle", () => {
  it("owner inserts a membership with invited_by/invited_at; viewer cannot", async () => {
    const invitee = await createUser();
    const { data: row, error } = await owner
      .from("business_members")
      .insert({
        business_id: businessId,
        user_id: invitee.id,
        role: "viewer",
        invited_by: ownerId,
        invited_at: new Date().toISOString(),
      })
      .select("id, invited_by, invited_at, accepted_at")
      .single();
    expect(error).toBeNull();
    expect(row?.invited_by).toBe(ownerId);
    expect(row?.accepted_at).toBeNull();

    const second = await createUser();
    const { error: denied } = await viewer
      .from("business_members")
      .insert({ business_id: businessId, user_id: second.id, role: "viewer" });
    expect(denied).not.toBeNull();

    // the invited person is listed in the directory as "invited" until first sign-in
    const { data: listed } = await owner
      .from("business_member_directory_view")
      .select("email, accepted_at, invited_by_name")
      .eq("user_id", invitee.id)
      .single();
    expect(listed?.email).toBe(invitee.email);
    expect(listed?.accepted_at).toBeNull();
    expect(listed?.invited_by_name).toBeTruthy();

    // accepted_at is stamped by the auth trigger on first sign-in
    await userClient({ email: invitee.email, password: invitee.password });
    const { data: after } = await owner
      .from("business_members")
      .select("accepted_at")
      .eq("user_id", invitee.id)
      .single();
    expect(after?.accepted_at).not.toBeNull();
  });

  it("a deactivated member loses all access until reactivated", async () => {
    const m = await createUser();
    await owner
      .from("business_members")
      .insert({ business_id: businessId, user_id: m.id, role: "sales_staff", invited_by: ownerId });
    const theirs = await userClient({ email: m.email, password: m.password });
    expect((await theirs.rpc("my_memberships")).data?.length).toBe(1);
    const before = await theirs.from("suppliers").select("id").limit(1);
    expect(before.error).toBeNull();

    const { error } = await owner
      .from("business_members")
      .update({ is_active: false })
      .eq("user_id", m.id)
      .eq("business_id", businessId);
    expect(error).toBeNull();
    expect((await theirs.rpc("my_memberships")).data).toEqual([]);
    expect((await theirs.from("suppliers").select("id").limit(1)).data).toEqual([]);
    expect((await theirs.from("business_member_directory_view").select("id")).data).toEqual([]);
  });

  it("the last active owner cannot be demoted, deactivated or deleted", async () => {
    const demote = await owner
      .from("business_members")
      .update({ role: "viewer" })
      .eq("user_id", ownerId)
      .eq("business_id", businessId);
    expect(demote.error?.message).toMatch(/at least one active owner/i);
    const deactivate = await owner
      .from("business_members")
      .update({ is_active: false })
      .eq("user_id", ownerId)
      .eq("business_id", businessId);
    expect(deactivate.error?.message).toMatch(/at least one active owner/i);
    const remove = await admin
      .from("business_members")
      .delete()
      .eq("user_id", ownerId)
      .eq("business_id", businessId);
    expect(remove.error?.message).toMatch(/at least one active owner/i);
    const { data: still } = await owner
      .from("business_members")
      .select("role, is_active")
      .eq("user_id", ownerId)
      .eq("business_id", businessId)
      .single();
    expect(still).toEqual({ role: "owner", is_active: true });
  });

  it("a second owner can be demoted while another active owner remains", async () => {
    const m = await createUser();
    const { data: row } = await owner
      .from("business_members")
      .insert({ business_id: businessId, user_id: m.id, role: "owner", invited_by: ownerId })
      .select("id")
      .single();
    const { data: changed, error } = await owner
      .from("business_members")
      .update({ role: "roaster" })
      .eq("id", row!.id)
      .select("role")
      .single();
    expect(error).toBeNull();
    expect(changed?.role).toBe("roaster");
  });

  it("memberships cannot be moved to another business or user", async () => {
    const m = await createUser();
    const { data: row } = await owner
      .from("business_members")
      .insert({ business_id: businessId, user_id: m.id, role: "viewer", invited_by: ownerId })
      .select("id")
      .single();
    const moved = await admin
      .from("business_members")
      .update({ business_id: otherBusinessId })
      .eq("id", row!.id);
    expect(moved.error?.message).toMatch(/cannot be changed/i);
    const reassigned = await admin
      .from("business_members")
      .update({ user_id: ownerId })
      .eq("id", row!.id);
    expect(reassigned.error?.message).toMatch(/cannot be reassigned/i);
    const viaRls = await other
      .from("business_members")
      .update({ role: "owner" })
      .eq("id", row!.id)
      .select("id");
    expect(viaRls.data).toEqual([]);
  });

  it("membership changes are audited", async () => {
    const m = await createUser();
    const { data: row } = await owner
      .from("business_members")
      .insert({ business_id: businessId, user_id: m.id, role: "viewer", invited_by: ownerId })
      .select("id")
      .single();
    await owner.from("business_members").update({ role: "roaster" }).eq("id", row!.id);
    const { data: logs } = await owner
      .from("audit_logs")
      .select("action, actor_id")
      .eq("entity_type", "business_members")
      .eq("entity_id", row!.id)
      .order("created_at");
    expect(logs?.map((l) => l.action)).toEqual(["insert", "update"]);
    expect(logs?.every((l) => l.actor_id === ownerId)).toBe(true);
  });
});

describe("business MFA policy", () => {
  it("only owners can change require_mfa", async () => {
    const denied = await viewer
      .from("business_settings")
      .update({ require_mfa: true })
      .eq("business_id", businessId)
      .select("require_mfa");
    expect(denied.data).toEqual([]);
    const { data: on, error } = await owner
      .from("business_settings")
      .update({ require_mfa: true })
      .eq("business_id", businessId)
      .select("require_mfa")
      .single();
    expect(error).toBeNull();
    expect(on?.require_mfa).toBe(true);
    await owner
      .from("business_settings")
      .update({ require_mfa: false })
      .eq("business_id", businessId);
    const { data: off } = await viewer
      .from("business_settings")
      .select("require_mfa")
      .eq("business_id", businessId)
      .single();
    expect(off?.require_mfa).toBe(false);
  });
});

describe("TOTP multi-factor authentication", () => {
  it("enrols, verifies, gates later sign-ins at aal2, and can be removed", async () => {
    const m = await createUser();
    await owner
      .from("business_members")
      .insert({ business_id: businessId, user_id: m.id, role: "roaster", invited_by: ownerId });
    const session = await userClient({ email: m.email, password: m.password });

    const { data: enrol, error: eErr } = await session.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "test app",
    });
    expect(eErr).toBeNull();
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(enrol!.totp.secret),
      digits: 6,
      period: 30,
    });
    const { data: challenge } = await session.auth.mfa.challenge({ factorId: enrol!.id });
    const bad = await session.auth.mfa.verify({
      factorId: enrol!.id,
      challengeId: challenge!.id,
      code: "000000",
    });
    expect(bad.error).not.toBeNull();
    const { data: c2 } = await session.auth.mfa.challenge({ factorId: enrol!.id });
    const good = await session.auth.mfa.verify({
      factorId: enrol!.id,
      challengeId: c2!.id,
      code: totp.generate(),
    });
    expect(good.error).toBeNull();
    const aal = await session.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data?.currentLevel).toBe("aal2");

    // a fresh password sign-in is only aal1 and must step up
    const fresh = await userClient({ email: m.email, password: m.password });
    const level = await fresh.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(level.data).toMatchObject({ currentLevel: "aal1", nextLevel: "aal2" });
    const { data: factors } = await fresh.auth.mfa.listFactors();
    expect(factors?.totp.filter((f) => f.status === "verified")).toHaveLength(1);

    // removing the factor needs an aal2 session; afterwards password-only is enough again
    const { error: notAllowed } = await fresh.auth.mfa.unenroll({ factorId: enrol!.id });
    expect(notAllowed).not.toBeNull();
    const { error: removed } = await session.auth.mfa.unenroll({ factorId: enrol!.id });
    expect(removed).toBeNull();
    const again = await userClient({ email: m.email, password: m.password });
    expect((await again.auth.mfa.getAuthenticatorAssuranceLevel()).data?.nextLevel).toBe("aal1");
  });
});
