import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260711120000_reservation_volume_discount.sql',
  ),
  'utf8',
)

describe('reservation volume discount migration (C3)', () => {
  it('adds a traceable volume_discount column', () => {
    expect(migration).toMatch(
      /alter table public\.reservations\s+add column if not exists volume_discount numeric/,
    )
  })

  it('applies the volume discount server-side from the active tiers, direct channel only', () => {
    expect(migration).toMatch(/if v_channel = 'direct' then/)
    expect(migration).toMatch(/v_units_sum >= coalesce\(v_tier3_qty, 150\)/)
    expect(migration).toMatch(/v_units_sum >= coalesce\(v_tier2_qty, 100\)/)
    expect(migration).toMatch(
      /v_net_subtotal := round\(v_subtotal_sum \* \(1 - v_volume_rate\), 2\)/,
    )
  })

  it('derives every monetary field from the NET subtotal', () => {
    expect(migration).toMatch(/v_vat := round\(v_net_subtotal \* v_vat_rate/)
    expect(migration).toMatch(
      /least\(greatest\(v_net_subtotal \* v_fee_rate, v_fee_min\), v_fee_max\)/,
    )
    expect(migration).toMatch(/v_deposit := round\(v_net_subtotal \* 0\.3, 2\)/)
    expect(migration).toMatch(
      /abs\(\(v_reservation ->> 'total_ht'\)::numeric - v_net_subtotal\) > c_tol/,
    )
  })

  it('re-validates the client-sent volume discount (anti-tampering intact)', () => {
    expect(migration).toMatch(
      /abs\(coalesce\(\(v_reservation ->> 'volume_discount'\)::numeric, 0\) - v_volume_discount\) > c_tol/,
    )
    // v3/v4 protections survive.
    expect(migration).toContain('unit price mismatch for product')
    expect(migration).toContain('item totals do not match reservation totals')
    expect(migration).toContain('v_worst_direct')
  })

  it('keeps the RPC anon-executable (public checkout)', () => {
    expect(migration).toMatch(
      /grant execute on function public\.create_reservation_with_items\(jsonb\)\s+to anon, authenticated/,
    )
  })
})
