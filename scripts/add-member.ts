/**
 * Adds a member (default role: owner) to an EXISTING business using the service-role key.
 * Creates the auth user if needed and prints a one-time password once.
 *
 * Usage:
 *   set -a; source .env.hosted; set +a
 *   npm run add:member -- --email person@example.com --name "Full Name" [--role owner] [--business-id <uuid>]
 *
 * Without --business-id the script requires exactly one business to exist.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = arg("email")?.toLowerCase();
  const name = arg("name") ?? null;
  const role = (arg("role") ?? "owner") as Database["public"]["Enums"]["member_role"];
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  if (!email)
    throw new Error(
      'Usage: --email <email> [--name "<full name>"] [--role owner] [--business-id <uuid>]',
    );

  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let businessId = arg("business-id");
  if (!businessId) {
    const { data: businesses, error } = await admin.from("businesses").select("id, name");
    if (error) throw error;
    if (businesses.length !== 1)
      throw new Error(
        `Expected exactly one business, found ${businesses.length}; pass --business-id`,
      );
    businessId = businesses[0].id;
    console.log(`business: ${businesses[0].name} (${businessId})`);
  }

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  let user = list.users.find((u) => u.email?.toLowerCase() === email);
  let password: string | null = null;
  if (!user) {
    password = randomBytes(12).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    user = data.user;
    console.log(`created auth user ${email}`);
  } else {
    console.log(`auth user ${email} already exists; no password change`);
  }
  if (name) await admin.from("user_profiles").update({ full_name: name }).eq("id", user.id);

  const { data: existing } = await admin
    .from("business_members")
    .select("id, role, is_active")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    const { error } = await admin
      .from("business_members")
      .update({ role, is_active: true })
      .eq("id", existing.id);
    if (error) throw error;
    console.log(`membership updated: role=${role}, active`);
  } else {
    const { error } = await admin.from("business_members").insert({
      business_id: businessId,
      user_id: user.id,
      role,
      invited_at: new Date().toISOString(),
    });
    if (error) throw error;
    console.log(`membership created: role=${role}`);
  }
  if (password) {
    console.log("\nOne-time password (shown once, change it after first sign-in):");
    console.log(password);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
