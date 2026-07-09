import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702120000_public_cart_line_prices.sql',
  ),
  'utf8',
).toLowerCase()

const cartStore = readFileSync(
  join(process.cwd(), 'src/stores/cart.store.ts'),
  'utf8',
).toLowerCase()

describe('public cart line prices migration', () => {
  it('exposes per-line commercial prices without sensitive fields', () => {
    expect(migration).toContain(
      'create or replace function public.get_public_product_prices_for_lines',
    )
    expect(migration).toContain('p_lines jsonb')
    expect(migration).toContain('unit_price_ht')
    expect(migration).toContain('tier_applied')
    expect(migration).toContain('parameters_version')
    expect(migration).not.toContain('landed_cost_ht')
    expect(migration).not.toContain('fob_usd')
    expect(migration).not.toContain('freight_eur_40hc')
    expect(migration).not.toContain('margin_rate')
  })

  it('uses the private pricing engine through a security definer wrapper', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain('public.get_price(')
    expect(migration).toContain(
      'grant execute on function public.get_public_product_prices_for_lines(jsonb)',
    )
    expect(migration).toContain('to anon, authenticated')
  })

  it('recalculates cart totals from the public line-pricing RPC', () => {
    expect(cartStore).toContain('get_public_product_prices_for_lines')
    expect(cartStore).toContain('basepriceht: price.unitpriceht')
    expect(cartStore).toContain('pricedproducts')
  })
})
