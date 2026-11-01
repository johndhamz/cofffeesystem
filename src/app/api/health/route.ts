import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and Vercel checks. `db: ok` means PostgREST answered an
 * anon-key query (RLS returns zero rows but proves connectivity); it never exposes data.
 */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "error";
  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { error } = await client.from("role_permissions").select("role").limit(1);
    db = error ? "error" : "ok";
  } catch {
    db = "error";
  }
  const body = {
    status: db === "ok" ? "ok" : "degraded",
    db,
    latencyMs: Date.now() - started,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    status: db === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
