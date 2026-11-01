"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok, Errors, type ActionResult } from "@/lib/errors";
import { validate } from "@/lib/validation";

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

/** Starts TOTP enrolment: returns the QR (SVG) and secret for the user's authenticator app. */
export async function startMfaEnrollmentAction(): Promise<
  ActionResult<{ factorId: string; qrSvg: string; secret: string; uri: string }>
> {
  try {
    const supabase = await createSupabaseServerClient();
    // Remove stale unverified factors so a retry never hits the "already enrolled" limit.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.totp ?? [])
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error || !data) throw Errors.validation(error?.message ?? "Could not start enrolment");
    return ok({
      factorId: data.id,
      qrSvg: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  } catch (error) {
    return fail(error);
  }
}

/** Confirms enrolment with the first code; the session is upgraded to aal2. */
export async function verifyMfaEnrollmentAction(
  factorId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const { code } = validate(codeSchema, input);
    const supabase = await createSupabaseServerClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge)
      throw Errors.validation(cErr?.message ?? "Could not create a challenge");
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error)
      throw Errors.validation(
        "That code was not accepted. Check the time on your device and try again.",
        { code: ["Invalid code"] },
      );
    revalidatePath("/settings/security");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function unenrollMfaAction(factorId: string): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw Errors.validation(error.message);
    revalidatePath("/settings/security");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

/** Second step of sign-in: verifies a code against the first verified factor and continues to `next`. */
export async function verifyMfaLoginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let next = "/dashboard";
  try {
    const { code } = validate(codeSchema, Object.fromEntries(formData));
    const rawNext = formData.get("next");
    if (typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//"))
      next = rawNext;
    const supabase = await createSupabaseServerClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!factor) throw Errors.invalidState("No authenticator is enrolled for this account.");
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (cErr || !challenge)
      throw Errors.validation(cErr?.message ?? "Could not create a challenge");
    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });
    if (error)
      throw Errors.validation("Invalid code. Try the next code from your app.", {
        code: ["Invalid code"],
      });
  } catch (error) {
    return fail(error);
  }
  redirect(next);
}
