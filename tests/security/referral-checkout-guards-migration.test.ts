import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260615152000_referral_checkout_guards.sql',
  ),
  'utf8',
)

describe('referral checkout guard migration', () => {
  it('validates referral state before reservation insert', () => {
    expect(migration).toContain(
      'create or replace function public.validate_reservation_referral',
    )
    expect(migration).toContain('for update')
    expect(migration).toContain('unknown referral code')
    expect(migration).toContain('self referral forbidden')
    expect(migration).toContain(
      "new.status is distinct from 'pending_reservation_fee'",
    )
    expect(migration).toContain(
      'inconsistent referral payment amounts',
    )
    expect(migration).toContain('before insert on public.reservations')
  })

  it('records redemptions atomically after reservation insert', () => {
    expect(migration).toContain(
      'create or replace function public.record_reservation_referral_redemption',
    )
    expect(migration).toContain('insert into public.referral_redemptions')
    expect(migration).toContain('set total_uses = total_uses + 1')
    expect(migration).toContain('after insert on public.reservations')
  })

  it('keeps trigger functions private', () => {
    expect(migration).toContain(
      'revoke execute on function public.validate_reservation_referral()',
    )
    expect(migration).toContain(
      'revoke execute on function public.record_reservation_referral_redemption()',
    )
  })
})
