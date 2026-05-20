import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260518162000_reservation_foundation.sql',
  ),
  'utf8',
)

describe('reservation foundation migration', () => {
  it('creates reservation status and delivery enums', () => {
    expect(migration).toContain('create type public.delivery_mode')
    expect(migration).toContain('create type public.reservation_status')
    expect(migration).toContain("'pending_reservation_fee'")
  })

  it('creates reservation and reservation item tables', () => {
    expect(migration).toContain(
      'create table if not exists public.reservations',
    )
    expect(migration).toContain(
      'create table if not exists public.reservation_items',
    )
    expect(migration).toContain('contact_snapshot jsonb not null')
    expect(migration).toContain('product_snapshot jsonb not null')
  })

  it('enables RLS for buyer reads and admin management', () => {
    expect(migration).toContain(
      'alter table public.reservations enable row level security',
    )
    expect(migration).toContain('create policy "Users see own reservations"')
    expect(migration).toContain(
      'create policy "Admins full access reservation items"',
    )
  })
})
