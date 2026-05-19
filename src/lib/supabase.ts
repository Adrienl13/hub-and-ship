import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let _client: SupabaseClient<Database> | null = null;

function getEnv(name: string): string | undefined {
  // import.meta.env est exposé par Vite; en runtime tests Node sans Vite,
  // on retombe sur process.env (utile pour CI / tests d'intégration).
  const viteEnv =
    typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      : undefined;
  return viteEnv?.[name] ?? process.env?.[name];
}

export function getSupabase(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = getEnv("VITE_SUPABASE_URL");
  const anonKey = getEnv("VITE_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error(
      "Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises (cf. .env.example)",
    );
  }

  _client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

/**
 * Proxy compatible avec l'usage `supabase.from(...)`.
 * Évite un throw au module-load : le client n'est créé qu'au 1er accès.
 */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value;
  },
});
