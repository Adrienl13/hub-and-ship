import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260711140000_pricing_guardrails.sql'),
  'utf8',
)

describe('pricing guardrails migration (M1/M2/M9)', () => {
  it('M2: bounds the pricing parameters at the DB level (all write paths)', () => {
    expect(migration).toContain('pricing_parameters_bounds_chk')
    expect(migration).toMatch(/tier3_qty > tier2_qty/)
    expect(migration).toMatch(/tier3_discount >= tier2_discount and tier3_discount < 1/)
    expect(migration).toMatch(/reservation_fee_max >= reservation_fee_min/)
    expect(migration).toMatch(/direct_margin_rate > -1/)
  })

  it('M9: enforces the margin floor on both partner-price tables when real costs exist', () => {
    expect(migration).toContain('function public.product_hard_margin_floor')
    // Le plancher ne fuit pas le coût rendu.
    expect(migration).toMatch(
      /revoke execute on function public\.product_hard_margin_floor\(text\)\s+from public, anon, authenticated/,
    )
    expect(migration).toContain('below margin floor')
    expect(migration).toContain('product_partner_prices_floor')
    expect(migration).toMatch(
      /before insert or update on public\.product_partner_prices/,
    )
  })

  it('M9: keeps the golden rule and adds the floor on channel overrides', () => {
    expect(migration).toMatch(/violates the golden rule/)
    expect(migration).toMatch(/channel_price_override below margin floor/)
  })

  it('M1: prunes offending overrides after a base_price_ht change', () => {
    expect(migration).toContain('function public.prune_offending_channel_overrides')
    expect(migration).toMatch(
      /after update of base_price_ht on public\.products/,
    )
    expect(migration).toMatch(/delete from public\.channel_price_overrides/)
    // Ne s'exécute que si le prix change réellement.
    expect(migration).toMatch(
      /new\.base_price_ht is not distinct from old\.base_price_ht/,
    )
  })
})
