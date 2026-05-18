import { createBrowserClient } from '@supabase/ssr'

import { getSupabasePublicConfig, type SupabasePublicConfig } from './env'
import type { Database } from './types'

export type SupabaseBrowserClient = ReturnType<
  typeof createSupabaseBrowserClient
>

export function createSupabaseBrowserClient(
  config: SupabasePublicConfig = getSupabasePublicConfig(),
) {
  if (!config.isConfigured) {
    throw new Error(
      `Supabase public config missing: ${config.missing.join(', ')}`,
    )
  }

  return createBrowserClient<Database>(config.url, config.anonKey)
}
