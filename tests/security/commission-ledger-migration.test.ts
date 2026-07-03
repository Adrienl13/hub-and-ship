import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702130000_commission_ledger.sql',
  ),
  'utf8',
)

describe('commission ledger migration', () => {
  it('creates partner_codes with a unique code and company FK', () => {
    expect(migration).toContain('create table if not exists public.partner_codes')
    expect(migration).toContain('code text not null unique')
    expect(migration).toContain('references public.companies(id)')
  })

  it('adds first-touch referral columns to companies', () => {
    expect(migration).toContain('referred_by_partner_id')
    expect(migration).toContain('referred_at timestamptz')
  })

  it('creates commission_ledger with rate, status, phase and idempotency', () => {
    expect(migration).toContain(
      'create table if not exists public.commission_ledger',
    )
    expect(migration).toContain('rate numeric(5,2) not null default 8.00')
    expect(migration).toContain("check (status in ('accrued', 'payable', 'paid'))")
    expect(migration).toContain("check (phase in ('accrual', 'reversal'))")
    expect(migration).toContain('unique (reservation_id, phase)')
  })

  it('never deletes — reversal is additive (no delete/truncate in migration)', () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.commission_ledger/i)
  })

  it('enables RLS with admin-only management', () => {
    expect(migration).toContain(
      'alter table public.commission_ledger enable row level security',
    )
    expect(migration).toContain('create policy "Admins manage commission ledger"')
    expect(migration).toContain(
      "public.current_user_role() in ('admin', 'super_admin')",
    )
  })
})
