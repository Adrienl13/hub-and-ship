import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260518103000_auth_security_foundation.sql',
  ),
  'utf8',
)

describe('Supabase auth/security migration', () => {
  it('creates the auth-adjacent business tables', () => {
    expect(migration).toContain('create table if not exists public.companies')
    expect(migration).toContain(
      'create table if not exists public.users_profile',
    )
    expect(migration).toContain(
      'create table if not exists public.security_events',
    )
  })

  it('enables RLS and company/profile policies', () => {
    expect(migration).toContain(
      'alter table public.companies enable row level security',
    )
    expect(migration).toContain(
      'alter table public.users_profile enable row level security',
    )
    expect(migration).toContain('create policy "Users see own company"')
    expect(migration).toContain('create policy "Admins full access profiles"')
  })

  it('wires new Supabase Auth users into users_profile', () => {
    expect(migration).toContain(
      'create or replace function public.handle_new_user',
    )
    expect(migration).toContain('create trigger on_auth_user_created')
    expect(migration).toContain('after insert on auth.users')
  })

  it('tracks security events and rate-limit outcomes', () => {
    expect(migration).toContain("'magic_link_rate_limited'")
    expect(migration).toContain('idx_security_events_type_created')
    expect(migration).not.toContain('old.role')
  })
})
