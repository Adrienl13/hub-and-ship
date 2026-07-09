import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260701110000_pricing_engine_phase1.sql',
  ),
  'utf8',
).toLowerCase()

describe('pricing engine phase 1 migration', () => {
  it('creates versioned pricing parameters with validated business defaults', () => {
    expect(migration).toContain(
      'create table if not exists public.pricing_parameters',
    )
    expect(migration).toContain('min_margin_floor numeric(8, 4) not null default 0.15')
    expect(migration).toContain('tier2_qty int not null default 100')
    expect(migration).toContain('tier2_discount numeric(8, 4) not null default 0.06')
    expect(migration).toContain('tier3_qty int not null default 150')
    expect(migration).toContain('tier3_discount numeric(8, 4) not null default 0.10')
    expect(migration).toContain('reservation_fee_rate numeric(8, 4) not null default 0.03')
    expect(migration).toContain('reservation_fee_min numeric(10, 2) not null default 150')
    expect(migration).toContain('reservation_fee_max numeric(10, 2) not null default 500')
    expect(migration).toContain('referrer_commission_rate numeric(8, 4) not null default 0.08')
    expect(migration).toContain('referrer_duration_months int not null default 12')
  })

  it('stores manual cost fields and pricing snapshots without breaking checkout', () => {
    expect(migration).toContain('add column if not exists fob_usd')
    expect(migration).toContain('add column if not exists qty_per_container')
    expect(migration).toContain('add column if not exists is_loss_leader')
    expect(migration).toContain('add column if not exists table_price_modifier_rate')
    expect(migration).toContain('add column if not exists pricing_channel public.pricing_channel')
    expect(migration).toContain('add column if not exists unit_landed_cost_ht')
    expect(migration).toContain('add column if not exists pricing_parameters_snapshot jsonb')
  })

  it('implements get_price with the required guardrails', () => {
    expect(migration).toContain('create or replace function public.get_price')
    expect(migration).toContain("p_channel = 'direct'")
    expect(migration).toContain('v_product.is_loss_leader')
    expect(migration).toContain('p_quantity >= v_params.loss_leader_min_lot')
    expect(migration).toContain("v_tier := 'loss_leader'")
    expect(migration).toContain('greatest(round(v_base, 2), v_floor)')
    expect(migration).toContain('override below minimum margin floor')
  })

  it('does not leave pricing internals open to anonymous callers', () => {
    expect(migration).toContain(
      'revoke all on table public.pricing_parameters from anon, public, authenticated',
    )
    expect(migration).toContain(
      'revoke all on table public.product_partner_prices from anon, public, authenticated',
    )
    expect(migration).toContain(
      'revoke all on function public.active_pricing_parameters(timestamptz) from public, anon, authenticated',
    )
    expect(migration).toContain(
      'revoke all on function public.calculate_product_landed_cost_ht(text, timestamptz) from public, anon, authenticated',
    )
    expect(migration).toContain(
      'grant execute on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz)',
    )
  })

  it('keeps the ZF2000C control values visible for future executable tests', () => {
    expect(migration).toContain("control_sku text not null default 'zf2000c'")
    expect(migration).toContain('control_landed_cost_ht numeric(10, 2) not null default 33.78')
    expect(migration).toContain('control_direct_price_ht numeric(10, 2) not null default 64.18')
    expect(migration).toContain('control_direct_tier2_price_ht numeric(10, 2) not null default 60.33')
    expect(migration).toContain('control_direct_tier3_price_ht numeric(10, 2) not null default 57.76')
    expect(migration).toContain('control_reseller_price_ht numeric(10, 2) not null default 47.29')
    expect(migration).toContain('control_distributor_price_ht numeric(10, 2) not null default 43.23')
  })
})
