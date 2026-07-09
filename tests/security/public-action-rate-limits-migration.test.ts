import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260615153000_public_action_rate_limits.sql',
  ),
  'utf8',
)

describe('public action rate limits migration', () => {
  it('creates a private rate-limit counter table and helper', () => {
    expect(migration).toContain(
      'create table if not exists public.public_action_rate_limits',
    )
    expect(migration).toContain(
      'create or replace function public.assert_public_action_rate_limit',
    )
    expect(migration).toContain("raise exception 'rate_limited'")
    expect(migration).toContain(
      'revoke execute on function public.assert_public_action_rate_limit',
    )
  })

  it('guards public lead and stock-request submissions', () => {
    expect(migration).toContain(
      'create or replace function public.guard_stock_request_rate_limit',
    )
    expect(migration).toContain('before insert on public.stock_requests')
    expect(migration).toContain("'container_notify'")
    expect(migration).toContain(
      'create or replace function public.subscribe_container_notification',
    )
  })

  it('guards referral preview enumeration', () => {
    expect(migration).toContain(
      'create or replace function public.preview_referral_code',
    )
    expect(migration).toContain("'preview_referral_code'")
    expect(migration).toContain('coalesce(nullif(v_email')
    expect(migration).toContain(
      'grant execute on function public.preview_referral_code',
    )
  })
})
