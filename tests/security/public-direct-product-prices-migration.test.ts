import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702113000_public_direct_product_prices.sql',
  ),
  'utf8',
).toLowerCase()

const catalogueDb = readFileSync(
  join(process.cwd(), 'src/lib/catalogue/db.ts'),
  'utf8',
).toLowerCase()

describe('public direct product prices migration', () => {
  it('exposes only customer-safe commercial price fields', () => {
    expect(migration).toContain('create or replace function public.get_public_product_prices')
    expect(migration).toContain('unit_price_ht')
    expect(migration).toContain('tier_applied')
    expect(migration).toContain('parameters_version')
    expect(migration).not.toContain('landed_cost_ht')
    expect(migration).not.toContain('fob_usd')
    expect(migration).not.toContain('freight_eur_40hc')
    expect(migration).not.toContain('margin_rate')
  })

  it('keeps the private pricing engine hidden behind a public wrapper', () => {
    expect(migration).toContain('public.get_price(')
    expect(migration).toContain('security definer')
    expect(migration).toContain('grant execute on function public.get_public_product_prices(int)')
    expect(migration).toContain('to anon, authenticated')
  })

  it('uses the safe projection in catalogue loading', () => {
    expect(catalogueDb).toContain('get_public_product_prices')
    expect(catalogueDb).toContain('publicprice?.unit_price_ht')
  })
})
