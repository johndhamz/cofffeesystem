/**
 * Administrative owner provisioning. Runs with the SERVICE ROLE key (server-side only).
 *
 * Usage:
 *   npm run provision:owner -- --email owner@example.com --name "Juan dela Cruz" --business "Kape Roastery" [--password "..."] [--slug kape-roastery]
 *
 * Behaviour:
 *   - creates (or reuses) the auth user, confirming the email
 *   - creates a business with default settings (PHP, Asia/Manila, Yoshan DY-2kg roaster, locations, categories, channels)
 *   - adds the user as owner
 *   - if no password is supplied, generates a one-time password and prints it once
 */
import path from "node:path";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const email = arg("email");
  const name = arg("name") ?? "";
  const business = arg("business");
  const slug = arg("slug");
  let password = arg("password");
  if (!email || !business) {
    console.error(
      'Usage: npm run provision:owner -- --email <email> --business "<name>" [--name "<full name>"] [--password <pw>] [--slug <slug>]',
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;
  const generated = !password;
  password ??= randomBytes(12).toString("base64url");

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (created.error) {
    if (!/already/i.test(created.error.message)) throw created.error;
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) throw new Error(`User ${email} exists but could not be found`);
    console.log(`Reusing existing auth user ${email}`);
  } else {
    userId = created.data.user.id;
    console.log(`Created auth user ${email}`);
  }

  const { data: businessId, error } = await admin.rpc("create_business_with_owner", {
    p_name: business,
    p_owner_user_id: userId,
    p_slug: slug,
  });
  if (error) throw error;

  console.log(`Business "${business}" created: ${businessId}`);
  console.log(`Owner: ${email}`);
  if (generated) {
    console.log(`One-time password (share securely, then ask the owner to reset it): ${password}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
