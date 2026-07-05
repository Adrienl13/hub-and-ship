import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260705090000_pricing_engine_bridge.sql',
  ),
  'utf8',
)

describe('pricing engine bridge migration (fusion P2)', () => {
  it('recreates the prod pricing engine tables idempotently', () => {
    for (const table of [
      'pricing_parameters',
      'product_pricing_inputs',
      'product_partner_prices',
    ]) {
      expect(migration).toContain(
        `create table if not exists public.${table}`,
      )
    }
    expect(migration).toContain('pricing_parameters_single_active_idx')
  })

  it('seeds a single active parameters row only on an empty table', () => {
    expect(migration).toMatch(
      /insert into public\.pricing_parameters[\s\S]*where not exists/,
    )
  })

  it('locks the engine behind RLS with admin-only policies (decision #4)', () => {
    for (const table of [
      'pricing_parameters',
      'product_pricing_inputs',
      'product_partner_prices',
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      )
    }
    // Margins and import costs must never be publicly readable.
    expect(migration).not.toMatch(/to\s+anon[\s\S]{0,80}pricing_parameters/i)
    expect(migration.match(/current_user_role\(\) in \('admin', 'super_admin'\)/g)?.length,
    ).toBeGreaterThanOrEqual(6)
  })

  it('derives channel coefficients from the active margins with a golden-rule clamp', () => {
    expect(migration).toContain(
      'create or replace function public.get_catalogue_prices()',
    )
    expect(migration).toMatch(
      /round\(\(1 \+ v_reseller_margin\) \/ \(1 \+ v_direct_margin\), 4\)/,
    )
    expect(migration).toContain("v_worst_direct := 1 - coalesce(v_tier3, 0.10)")
    expect(migration).toMatch(/v_coeff >= v_worst_direct/)
    // The RPC stays the only reader: execute revoked from public, granted to
    // anon/authenticated.
    expect(migration).toContain(
      'revoke execute on function public.get_catalogue_prices() from public',
    )
    expect(migration).toContain(
      'grant execute on function public.get_catalogue_prices() to anon, authenticated',
    )
  })

  it('keeps the override golden-rule trigger tied to the active tier-3 discount', () => {
    expect(migration).toContain(
      'create or replace function public.enforce_override_golden_rule()',
    )
    expect(migration).toMatch(
      /select p\.tier3_discount from public\.pricing_parameters p/,
    )
  })

  it('retires the B2C referral program via the reversible kill switch', () => {
    expect(migration).toMatch(
      /update public\.referral_program_settings\s+set is_active = false/,
    )
    // Data-only: never drop the referral tables or history.
    expect(migration).not.toMatch(/drop\s+(column|table|function)/i)
    expect(migration).not.toMatch(/delete\s+from/i)
  })
})
