import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Validated once at import time.
 * The service-role key is ONLY readable here and must never be imported from client code.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid server environment:\n${issues}`);
}

export const serverEnv = parsed.data;

export function requireServiceRoleKey(): string {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  }
  return serverEnv.SUPABASE_SERVICE_ROLE_KEY;
}
