import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./db-types";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Returns a singleton Supabase client configured for the browser
 * (publishable key). Throws if the env vars are missing — that is
 * a configuration error, surfacing it early is better than failing
 * silently at first network call.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.",
    );
  }
  cachedClient = createClient<Database>(url, publishableKey, {
    auth: {
      // Reservation flow is anonymous for now; flip these on once
      // we plug a real auth layer for the client dashboard.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}

/** Boolean helper for code paths that need to short-circuit when Supabase isn't configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url) && Boolean(publishableKey);
}
