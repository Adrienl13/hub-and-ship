import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260706100000_reservation_rpc_channel_attribution.sql',
  ),
  'utf8',
)

describe('reservation RPC v3 migration (channel + attribution)', () => {
  it('resolves the caller channel exactly like get_catalogue_prices', () => {
    expect(migration).toContain('public.current_company_id()')
    expect(migration).toMatch(
      /round\(\(1 \+ v_reseller_margin\) \/ \(1 \+ v_direct_margin\), 4\)/,
    )
    expect(migration).toContain('from public.channel_price_overrides o')
    expect(migration).toMatch(/v_coeff >= v_worst_direct/)
  })

  it('accepts channel OR base price, never below, and stores the validated one', () => {
    expect(migration).toMatch(
      /abs\(v_client_price - v_channel_price\) <= 0\.01/,
    )
    expect(migration).toMatch(/abs\(v_client_price - v_db_price\) <= 0\.01/)
    expect(migration).toContain('unit price mismatch for product')
    // The validated price feeds the stored line, not the raw base price.
    expect(migration).toMatch(
      /v_line_subtotal := round\(v_validated_price \* v_qty, 2\)/,
    )
    expect(migration).toMatch(/v_qty,\s*\n\s*v_validated_price,/)
  })

  it('persists first-touch attribution on the reservation insert', () => {
    for (const col of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'partner_ref',
    ]) {
      expect(migration).toContain(`    ${col}`)
      expect(migration).toContain(
        `nullif(v_reservation ->> '${col}', '')`,
      )
    }
  })

  it('keeps the anti-tampering invariants of v2', () => {
    expect(migration).toContain("invalid siret")
    expect(migration).toContain('item totals do not match reservation totals')
    expect(migration).toContain(
      'derived monetary fields are inconsistent',
    )
    expect(migration).toContain('invalid referral discount')
    expect(migration).toContain(
      'revoke execute on function public.create_reservation_with_items(jsonb)',
    )
  })
})
