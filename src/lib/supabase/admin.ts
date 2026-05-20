// Server-only Supabase client using the SERVICE ROLE key.
//
// This client bypasses RLS. It must NEVER be imported from a browser bundle.
// The secret is read from `process.env` (which is empty in browsers — any
// misuse would surface immediately via the throw below).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database as BaseDatabase } from './types'

// `@supabase/supabase-js` >= 2.105 expects each Tables/Views entry to expose a
// `Relationships: []` array (cf. `GenericTable` in postgrest-js). The hand-
// written `Database` interface in `./types.ts` predates that requirement, so
// we widen it here for the admin client only — without touching the shared
// interface used by the browser/SSR clients. This keeps Insert/Update typings
// intact for our update calls while satisfying the postgrest-js constraint.
type WithRelationships<TTable> = TTable & {
  Relationships: []
}

export interface AdminDatabase {
  public: {
    Tables: {
      [K in keyof BaseDatabase['public']['Tables']]: WithRelationships<
        BaseDatabase['public']['Tables'][K]
      >
    }
    Views: Record<string, never>
    Functions: BaseDatabase['public']['Functions']
    Enums: BaseDatabase['public']['Enums']
    CompositeTypes: Record<string, never>
  }
}

let cachedClient: SupabaseClient<AdminDatabase> | null = null

/**
 * Resolves the Supabase URL from the environment. Accepts both `SUPABASE_URL`
 * (preferred for Workers secrets) and `VITE_SUPABASE_URL` (the dev-server
 * convention already in use). Returns `null` if neither is set.
 */
function readSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? null
}

/**
 * Returns a singleton Supabase admin client (service role). Throws if either
 * `SUPABASE_URL` / `VITE_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is
 * missing — that is a server configuration error, not a recoverable state.
 */
export function getSupabaseAdmin(): SupabaseClient<AdminDatabase> {
  if (cachedClient) return cachedClient

  const url = readSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client misconfigured. Set SUPABASE_URL (or VITE_SUPABASE_URL) ' +
        'and SUPABASE_SERVICE_ROLE_KEY in the server environment.',
    )
  }

  cachedClient = createClient<AdminDatabase>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return cachedClient
}
