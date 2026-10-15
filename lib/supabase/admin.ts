import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "./config.ts";

// This client bypasses RLS. Callers must verify identity and ownership first.
export function createAdminClient() {
  const { url, secretKey } = getSupabaseAdminConfig();
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
