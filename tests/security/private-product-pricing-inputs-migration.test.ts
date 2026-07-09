import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702102000_private_product_pricing_inputs.sql',
  ),
  'utf8',
).toLowerCase()

const catalogueDb = readFileSync(
  join(process.cwd(), 'src/lib/catalogue/db.ts'),
  'utf8',
).toLowerCase()

describe('private product pricing inputs migration', () => {
  it('moves sensitive cost fields to an admin-only companion table', () => {
    expect(migration).toContain(
      'create table if not exists public.product_pricing_inputs',
    )
    expect(migration).toContain('alter table public.product_pricing_inputs enable row level security')
    expect(migration).toContain('admins full access product pricing inputs')
    expect(migration).toContain(
      'revoke all on table public.product_pricing_inputs',
    )
    expect(migration).toContain(
      'grant select, insert, update, delete',
    )
    expect(migration).toContain(
      "public.current_user_role() in ('admin', 'super_admin')",
    )
  })

  it('scrubs legacy public product columns after backfilling private inputs', () => {
    expect(migration).toContain('insert into public.product_pricing_inputs')
    expect(migration).toContain('update public.products')
    expect(migration).toContain('fob_usd = null')
    expect(migration).toContain('qty_per_container = null')
    expect(migration).toContain('is_loss_leader = false')
    expect(migration).toContain('table_price_modifier_rate = null')
  })

  it('does not expose cost-bearing get_price results to browser roles', () => {
    expect(migration).toContain(
      'revoke all on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz)',
    )
    expect(migration).not.toContain(
      'grant execute on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz)',
    )
  })

  it('keeps public catalogue queries away from sensitive product columns', () => {
    expect(catalogueDb).toContain('public_product_columns')
    expect(catalogueDb).not.toContain(".from('products')\n      .select('*')")
    expect(catalogueDb).not.toContain('fob_usd')
    expect(catalogueDb).not.toContain('qty_per_container')
    expect(catalogueDb).not.toContain('table_price_modifier_rate')
  })
})
