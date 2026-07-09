import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260623120000_partner_net_product_prices.sql',
  ),
  'utf8',
).toLowerCase()

describe('partner net product prices migration', () => {
  it('stores partner net prices outside the public products table', () => {
    expect(migration).toContain(
      'create table if not exists public.product_partner_prices',
    )
    expect(migration).toContain(
      'product_id text primary key references public.products(id)',
    )
    expect(migration).toContain('net_price_ht numeric(10, 2)')
    expect(migration).toContain('never granted to anon')
  })

  it('enables RLS with admin writes and approved partner reads only', () => {
    expect(migration).toContain(
      'alter table public.product_partner_prices enable row level security',
    )
    expect(migration).toContain(
      'create policy "admins full access product partner prices"',
    )
    expect(migration).toContain(
      'create policy "partners read active net prices"',
    )
    expect(migration).toContain('to authenticated')
    expect(migration).toContain('current_partner_application_ids()')
    expect(migration).not.toMatch(
      /grant\s+[^;]+on\s+public\.product_partner_prices\s+to\s+anon/i,
    )
  })

  it('lets the admin product RPC maintain the private price companion row', () => {
    expect(migration).toContain('partner_net_price_ht')
    expect(migration).toContain('insert into public.product_partner_prices')
    expect(migration).toContain('on conflict (product_id) do update')
    expect(migration).toContain('set is_active = false')
  })
})
