import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702110000_reservation_pricing_engine_snapshots.sql',
  ),
  'utf8',
).toLowerCase()

describe('reservation pricing engine snapshots migration', () => {
  it('prices reservation lines through the private pricing engine', () => {
    expect(migration).toContain('from public.get_price(')
    expect(migration).toContain("'direct'::public.pricing_channel")
    expect(migration).toContain('v_price.unit_price_ht')
    expect(migration).toContain('v_line_subtotal := round(v_price.unit_price_ht * v_qty, 2)')
  })

  it('stores commercial pricing metadata without exposing landed cost', () => {
    expect(migration).toContain('pricing_channel')
    expect(migration).toContain('pricing_tier_applied')
    expect(migration).toContain('pricing_parameters_snapshot')
    expect(migration).toContain('unit_landed_cost_ht')
    expect(migration).toContain('null,')
    expect(migration).not.toContain('v_price.landed_cost_ht')
  })

  it('derives reservation fee from active pricing parameters', () => {
    expect(migration).toContain('v_params := public.active_pricing_parameters(now())')
    expect(migration).toContain('v_params.reservation_fee_rate')
    expect(migration).toContain('v_params.reservation_fee_min')
    expect(migration).toContain('v_params.reservation_fee_max')
  })

  it('keeps checkout creation behind the RPC, not direct anon inserts', () => {
    expect(migration).toContain('drop policy if exists "anon creates pending reservations"')
    expect(migration).toContain('drop policy if exists "anon creates reservation items"')
    expect(migration).toContain(
      'grant execute on function public.create_reservation_with_items(jsonb)',
    )
    expect(migration).toContain('to anon, authenticated')
  })
})
