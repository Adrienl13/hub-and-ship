import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260709090000_pricing_pilotage_p0.sql',
  ),
  'utf8',
)

describe('pricing pilotage P0 migration', () => {
  it('guards every admin RPC behind is_admin()', () => {
    for (const fn of [
      'admin_save_pricing_parameters',
      'check_pricing_control',
      'admin_preview_reprice',
      'admin_apply_reprice',
    ]) {
      const body = migration.slice(migration.indexOf(`function public.${fn}`))
      expect(body, fn).toMatch(/if not public\.is_admin\(\) then/)
      expect(migration).toContain(
        `revoke execute on function public.${fn}`,
      )
    }
    // None of the admin RPCs may be callable anonymously.
    expect(migration).not.toMatch(/grant execute on function public\.admin_\w+[\s\S]{0,40}to[^;]*anon/)
    expect(migration).not.toMatch(
      /grant execute on function public\.check_pricing_control[\s\S]{0,40}to[^;]*anon/,
    )
  })

  it('P0.2: saves create a NEW version instead of updating in place', () => {
    expect(migration).toMatch(
      /update public\.pricing_parameters set is_active = false where id = v_active\.id/,
    )
    expect(migration).toMatch(/coalesce\(max\(version\), 0\) \+ 1/)
    // Merge semantics: every field falls back to the active row's value.
    expect(migration).toMatch(
      /coalesce\(\(payload ->> 'freight_eur_40hc'\)::numeric, v_active\.freight_eur_40hc\)/,
    )
  })

  it('P0.3: the control SKU is re-stamped at save and checked for drift', () => {
    // SKU or product id both resolve (get_price expects a product id).
    expect(migration.match(/p\.sku = v_new\.control_sku or p\.id = v_new\.control_sku/)).toBeTruthy()
    expect(migration).toContain('function public.check_pricing_control()')
    expect(migration).toMatch(/drift_percent/)
  })

  it('P0.1: reprice is explicit — dry-run preview and a separate apply', () => {
    expect(migration).toContain('function public.admin_preview_reprice()')
    expect(migration).toContain('function public.admin_apply_reprice()')
    // Only products with real costs are repriced; noise-level diffs skipped.
    expect(migration).toMatch(
      /ppi\.fob_usd is not null[\s\S]{0,80}ppi\.qty_per_container is not null/,
    )
    expect(migration).toMatch(
      /abs\(p\.base_price_ht - e\.unit_price_ht\) > 0\.005/,
    )
  })

  it('P0.4: get_public_pricing_rules exposes tiers + fee facts and nothing else', () => {
    const start = migration.indexOf('function public.get_public_pricing_rules')
    const end = migration.indexOf(
      'create or replace function public.create_reservation_with_items',
    )
    const body = migration.slice(start, end)
    // Public facts only — never a margin, a cost or an FX rate.
    for (const forbidden of [
      'margin',
      'fob',
      'freight',
      'fx_usd_eur',
      'customs',
      'landed',
      'control_',
    ]) {
      expect(body.toLowerCase(), forbidden).not.toContain(forbidden)
    }
    for (const allowed of [
      'tier2_qty',
      'tier2_discount',
      'tier3_qty',
      'tier3_discount',
      'reservation_fee_rate',
      'reservation_fee_min',
      'reservation_fee_max',
    ]) {
      expect(body).toContain(allowed)
    }
    expect(body).toMatch(
      /grant execute on function public\.get_public_pricing_rules\(\) to anon, authenticated/,
    )
  })

  it('P0.4: the reservation RPC reads its fee from the active parameters with the historical fallback', () => {
    const body = migration.slice(
      migration.indexOf(
        'create or replace function public.create_reservation_with_items',
      ),
    )
    expect(body).toMatch(/coalesce\(p\.reservation_fee_rate, 0\.03\)/)
    expect(body).toMatch(
      /v_fee_rate := 0\.03; v_fee_min := 150; v_fee_max := 500;/,
    )
    expect(body).toMatch(
      /least\(greatest\(v_subtotal_sum \* v_fee_rate, v_fee_min\), v_fee_max\)/,
    )
    // v3 protections must survive the v4 rewrite.
    for (const invariant of [
      'unit price mismatch for product',
      'derived monetary fields are inconsistent',
      'partner_ref',
      'v_worst_direct',
    ]) {
      expect(body).toContain(invariant)
    }
  })

  it('keeps the client fallback grid in sync with the SQL fallback', () => {
    const publicRules = readFileSync(
      join(process.cwd(), 'src/lib/pricing/public-rules.ts'),
      'utf8',
    )
    // 100→6%, 150→10%, 3% / 150 / 500 on both sides.
    expect(migration).toMatch(
      /'tier2_qty', 100, 'tier2_discount', 0\.06/,
    )
    expect(migration).toMatch(
      /'tier3_qty', 150, 'tier3_discount', 0\.10/,
    )
    expect(publicRules).toMatch(/tier2Qty: 100/)
    expect(publicRules).toMatch(/tier2Discount: 0\.06/)
    expect(publicRules).toMatch(/tier3Qty: 150/)
    expect(publicRules).toMatch(/reservationFeeRate: 0\.03/)
    expect(publicRules).toMatch(/reservationFeeMin: 150/)
    expect(publicRules).toMatch(/reservationFeeMax: 500/)
  })
})
