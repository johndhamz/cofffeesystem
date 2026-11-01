"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";
import { fail, ok, type ActionResult, Errors } from "@/lib/errors";
import { validate } from "@/lib/validation";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let next = "/dashboard";
  try {
    const input = validate(loginSchema, Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      return fail(Errors.validation("Invalid email or password."));
    }
    if (input.next && input.next.startsWith("/") && !input.next.startsWith("//")) {
      next = input.next;
    }
  } catch (error) {
    return fail(error);
  }
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // Local scope: end this device's session only (does not revoke other sessions).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

const forgotSchema = z.object({ email: z.email("Enter a valid email address") });

export async function requestPasswordResetAction(
  _prev: ActionResult<{ sent: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
  try {
    const input = validate(forgotSchema, Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const origin = (await headers()).get("origin") ?? serverEnv.NEXT_PUBLIC_APP_URL;
    // Always respond success to avoid leaking which emails exist.
    await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    });
    return ok({ sent: true });
  } catch (error) {
    return fail(error);
  }
}

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export async function updatePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const input = validate(resetSchema, Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthenticated("Your reset link has expired. Request a new one.");
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw Errors.validation(error.message);
  } catch (error) {
    return fail(error);
  }
  redirect("/dashboard");
}
