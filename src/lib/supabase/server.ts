import { createServerClient } from '@supabase/ssr'

import { getSupabasePublicConfig, type SupabasePublicConfig } from './env'
import type { Database } from './types'

export interface ServerCookie {
  readonly name: string
  readonly value: string
}

export interface ServerCookieAdapter {
  readonly getAll: () => ReadonlyArray<ServerCookie>
  readonly setAll?: (
    cookies: ReadonlyArray<{
      readonly name: string
      readonly value: string
      readonly options: Record<string, unknown>
    }>,
  ) => void
}

export function createSupabaseServerClient({
  cookies,
  config = getSupabasePublicConfig(),
}: {
  readonly cookies: ServerCookieAdapter
  readonly config?: SupabasePublicConfig
}) {
  if (!config.isConfigured) {
    throw new Error(
      `Supabase public config missing: ${config.missing.join(', ')}`,
    )
  }

  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll: () => [...cookies.getAll()],
      setAll: (
        items: ReadonlyArray<{
          readonly name: string
          readonly value: string
          readonly options: Record<string, unknown>
        }>,
      ) => cookies.setAll?.(items),
    },
  })
}
