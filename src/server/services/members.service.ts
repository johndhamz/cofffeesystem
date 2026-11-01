import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env/server";
import { validate } from "@/lib/validation";
import { Errors, fromDatabaseError } from "@/lib/errors";
import { membersRepository } from "@/server/repositories/members.repository";
import { changeRoleSchema, inviteMemberSchema } from "@/features/members/schemas";

export async function listMembers() {
  const ctx = await requirePermission("members.read");
  const db = await createSupabaseServerClient();
  return {
    members: await membersRepository(db).list(ctx.business.businessId),
    currentUserId: ctx.user.id,
  };
}

/**
 * Invite a teammate. Uses the service-role client ONLY to create/invite the auth user (no
 * self-signup exists); the membership row is written as the owner so RLS and the audit trigger
 * record who invited whom. Supabase sends the invite email; the link lands on /auth/confirm
 * (type=invite) and the member chooses a password on /reset-password.
 */
export async function inviteMember(input: unknown) {
  const ctx = await requirePermission("members.manage");
  const values = validate(inviteMemberSchema, input);
  const admin = createSupabaseAdminClient();
  const db = await createSupabaseServerClient();
  const repo = membersRepository(db);
  const redirectTo = `${serverEnv.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password`;

  // Existing user? (email lookups need the admin API; nothing about other businesses is returned)
  let userId: string | null = null;
  let invited = false;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw Errors.internal("Could not look up users", listErr);
  const existing = list.users.find((u) => u.email?.toLowerCase() === values.email.toLowerCase());
  if (existing) {
    userId = existing.id;
    if (!existing.last_sign_in_at) {
      await admin.auth.admin
        .inviteUserByEmail(values.email, {
          redirectTo,
          data: { full_name: values.full_name ?? null },
        })
        .catch(() => undefined);
      invited = true;
    }
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(values.email, {
      redirectTo,
      data: { full_name: values.full_name ?? null },
    });
    if (error)
      throw Errors.validation(`Could not send the invitation: ${error.message}`, {
        email: [error.message],
      });
    userId = data.user.id;
    invited = true;
  }

  const current = await repo.findByUser(ctx.business.businessId, userId);
  if (current) {
    if (current.is_active)
      throw Errors.conflict("This person is already a member of the business.", {
        email: ["Already a member"],
      });
    await repo.update(ctx.business.businessId, current.id, { is_active: true, role: values.role });
    return { memberId: current.id, invited, reactivated: true };
  }
  const { data: row, error } = await db
    .from("business_members")
    .insert({
      business_id: ctx.business.businessId,
      user_id: userId,
      role: values.role,
      invited_by: ctx.user.id,
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw fromDatabaseError(error);
  return { memberId: row.id, invited, reactivated: false };
}

export async function resendInvite(memberId: string) {
  const ctx = await requirePermission("members.manage");
  const db = await createSupabaseServerClient();
  const member = await membersRepository(db).get(ctx.business.businessId, memberId);
  if (!member) throw Errors.notFound("Member");
  if (member.accepted_at) throw Errors.invalidState("This member has already signed in.");
  const admin = createSupabaseAdminClient();
  const redirectTo = `${serverEnv.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password`;
  const { error } = await admin.auth.admin.inviteUserByEmail(member.email, { redirectTo });
  if (error) {
    // Already-invited users get a recovery link instead of a second invite.
    const { error: e2 } = await admin.auth.resetPasswordForEmail(member.email, { redirectTo });
    if (e2) throw Errors.validation(`Could not resend: ${e2.message}`);
  }
}

export async function changeMemberRole(memberId: string, input: unknown) {
  const ctx = await requirePermission("members.manage");
  const values = validate(changeRoleSchema, input);
  const db = await createSupabaseServerClient();
  const repo = membersRepository(db);
  const member = await repo.get(ctx.business.businessId, memberId);
  if (!member) throw Errors.notFound("Member");
  return repo.update(ctx.business.businessId, memberId, { role: values.role });
}

export async function setMemberActive(memberId: string, isActive: boolean) {
  const ctx = await requirePermission("members.manage");
  const db = await createSupabaseServerClient();
  const repo = membersRepository(db);
  const member = await repo.get(ctx.business.businessId, memberId);
  if (!member) throw Errors.notFound("Member");
  if (member.user_id === ctx.user.id && !isActive)
    throw Errors.invalidState("You cannot deactivate your own membership.");
  return repo.update(ctx.business.businessId, memberId, { is_active: isActive });
}
