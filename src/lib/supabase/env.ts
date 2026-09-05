export interface SupabasePublicConfig {
  readonly url: string
  readonly anonKey: string
  readonly appUrl: string
  readonly isConfigured: boolean
  readonly missing: ReadonlyArray<
    'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'
  >
}

interface SupabaseEnvSource {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_APP_URL?: string
}

function getRuntimeEnv(): SupabaseEnvSource {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
  }
}

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function getSupabasePublicConfig(
  env: SupabaseEnvSource = getRuntimeEnv(),
): SupabasePublicConfig {
  const url = cleanEnv(env.VITE_SUPABASE_URL)
  const anonKey = cleanEnv(env.VITE_SUPABASE_ANON_KEY)
  const missing: Array<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'> = []

  if (!url) missing.push('VITE_SUPABASE_URL')
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY')

  // Le bundle prod a déjà été livré sans VITE_APP_URL : le repli localhost
  // envoyait les liens magiques vers http://localhost:5173. En production le
  // repli est le domaine de service (le flip de domaine le réécrit).
  const appUrlFallback = import.meta.env.PROD
    ? 'https://prosimport.com'
    : 'http://localhost:5173'

  return {
    url,
    anonKey,
    appUrl: cleanEnv(env.VITE_APP_URL) || appUrlFallback,
    isConfigured: missing.length === 0,
    missing,
  }
}
