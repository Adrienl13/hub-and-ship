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

  return {
    url,
    anonKey,
    appUrl: cleanEnv(env.VITE_APP_URL) || 'http://localhost:5173',
    isConfigured: missing.length === 0,
    missing,
  }
}
