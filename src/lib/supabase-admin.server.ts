// Server-only Supabase client using the SERVICE ROLE key.
//
// This client bypasses RLS. It must NEVER be imported from a browser bundle.
// The `.server.ts` suffix is a convention (cf CLAUDE.md) and we also gate
// against accidental client imports by reading the secret from `process.env`
// (which is empty in browsers — the throw would surface the misuse).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./db-types";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Resolves the Supabase URL from the environment. Accepts both `SUPABASE_URL`
 * (preferred for Workers secrets) and `VITE_SUPABASE_URL` (the dev-server
 * convention already in use). Returns `null` if neither is set.
 */
function readSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? null;
}

/**
 * Returns a singleton Supabase admin client (service role). Throws if either
 * `SUPABASE_URL` / `VITE_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is
 * missing — that is a server configuration error, not a recoverable state.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const url = readSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client misconfigured. Set SUPABASE_URL (or VITE_SUPABASE_URL) " +
        "and SUPABASE_SERVICE_ROLE_KEY in the server environment.",
    );
  }

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
