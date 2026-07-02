import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260702120000_sales_channels.sql'),
  'utf8',
)

describe('sales channels migration', () => {
  it('creates the sales_channel enum and companies.channel columns', () => {
    expect(migration).toContain('create type public.sales_channel')
    for (const v of ['direct', 'revendeur', 'distributeur', 'grand_compte']) {
      expect(migration).toContain(`'${v}'`)
    }
    expect(migration).toContain('add column if not exists channel public.sales_channel')
    expect(migration).toContain('channel_set_by uuid')
    expect(migration).toContain('channel_set_at timestamptz')
  })

  it('enforces admin-only channel changes via a trigger', () => {
    expect(migration).toContain('enforce_company_channel_admin_only')
    expect(migration).toContain('companies_enforce_channel_admin')
    expect(migration).toContain('if not public.is_admin()')
  })

  it('creates coefficients + overrides tables and seeds the grid', () => {
    expect(migration).toContain('create table if not exists public.channel_coefficients')
    expect(migration).toContain('create table if not exists public.channel_price_overrides')
    expect(migration).toContain("('revendeur', 0.7368)")
    expect(migration).toContain("('distributeur', 0.6737)")
    expect(migration).toContain('unique (product_id, channel)')
  })

  it('never exposes overrides/coefficients publicly (no public SELECT policy)', () => {
    expect(migration).toContain(
      'alter table public.channel_coefficients enable row level security',
    )
    expect(migration).toContain(
      'alter table public.channel_price_overrides enable row level security',
    )
    expect(migration).not.toMatch(/for\s+select/i)
    expect(migration).toContain('Admins manage channel coefficients')
    expect(migration).toContain('Admins manage channel price overrides')
  })

  it('guards the golden rule on overrides at write time', () => {
    expect(migration).toContain('enforce_override_golden_rule')
    expect(migration).toContain('base_price_ht * 0.90')
  })

  it('defines get_catalogue_prices() as a security-definer RPC, anon-executable', () => {
    expect(migration).toContain(
      'create or replace function public.get_catalogue_prices()',
    )
    expect(migration).toContain('security definer')
    expect(migration).toContain('public.current_company_id()')
    expect(migration).toContain(
      'grant execute on function public.get_catalogue_prices() to anon, authenticated',
    )
  })

  it('keeps the seed coefficients below the worst direct price factor (0.90)', () => {
    // Parse the seeded reseller coefficients and assert the golden rule holds.
    for (const channel of ['revendeur', 'distributeur']) {
      const match = migration.match(
        new RegExp(`\\('${channel}',\\s*([0-9.]+)\\)`),
      )
      expect(match, `seed for ${channel}`).not.toBeNull()
      const coeff = Number(match![1])
      expect(coeff).toBeLessThan(0.9)
    }
  })
})
