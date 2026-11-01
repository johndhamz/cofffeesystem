"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  changeMemberRole,
  inviteMember,
  resendInvite,
  setMemberActive,
} from "@/server/services/members.service";

function revalidate() {
  revalidatePath("/settings/members");
  revalidatePath("/settings");
}

export async function inviteMemberAction(
  input: Record<string, unknown>,
): Promise<ActionResult<{ memberId: string; invited: boolean; reactivated: boolean }>> {
  try {
    const r = await inviteMember(input);
    revalidate();
    return ok(r);
  } catch (error) {
    return fail(error);
  }
}

export async function resendInviteAction(memberId: string): Promise<ActionResult> {
  try {
    await resendInvite(memberId);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function changeMemberRoleAction(
  memberId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await changeMemberRole(memberId, input);
    revalidate();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function setMemberActiveAction(
  memberId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await setMemberActive(memberId, isActive);
    revalidate();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
