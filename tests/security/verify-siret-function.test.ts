import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const functionSource = readFileSync(
  join(process.cwd(), 'supabase/functions/verify-siret/index.ts'),
  'utf8',
)

const cacheMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260518145500_siret_cache.sql'),
  'utf8',
)

describe('verify-siret Edge Function scaffold', () => {
  it('requires authenticated requests before checking SIRET', () => {
    expect(functionSource).toContain("request.headers.get('Authorization')")
    expect(functionSource).toContain('getUserIdFromToken')
    expect(functionSource).toContain('/auth/v1/user')
  })

  it('implements the expected SIRET abuse protections', () => {
    expect(functionSource).toContain('rateLimitRule')
    expect(functionSource).toContain("event_type: 'rate_limit_hit'")
    expect(functionSource).toContain("event_type: 'siret_lookup_invalid'")
    expect(functionSource).toContain("event_type: 'siret_duplicate_attempt'")
  })

  it('uses INSEE through server-side credentials and cache', () => {
    expect(functionSource).toContain('getInseeAccessToken')
    expect(functionSource).toContain('INSEE_CLIENT_SECRET')
    expect(functionSource).toContain('getCachedSiret')
    expect(functionSource).toContain('cacheSiretResponse')
  })

  it('adds a protected siret_cache table', () => {
    expect(cacheMigration).toContain('create table if not exists public.siret_cache')
    expect(cacheMigration).toContain('idx_siret_cache_expires')
    expect(cacheMigration).toContain(
      'alter table public.siret_cache enable row level security',
    )
  })
})
