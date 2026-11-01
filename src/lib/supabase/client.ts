"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { clientEnv } from "@/lib/env/client";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client using the public anon key. Session lives in cookies (shared with the server). */
export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return browserClient;
}
