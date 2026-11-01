import { z } from "zod";
import { ROLES } from "@/lib/permissions/policy";
import { optionalTrimmed } from "@/lib/validation/common";

export const inviteMemberSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  full_name: optionalTrimmed(120),
  role: z.enum(ROLES),
});
export type InviteMemberInput = z.output<typeof inviteMemberSchema>;

export const changeRoleSchema = z.object({ role: z.enum(ROLES) });
