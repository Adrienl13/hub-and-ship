import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260701113000_admin_product_pricing_fields.sql',
  ),
  'utf8',
).toLowerCase()

describe('admin product pricing fields migration', () => {
  it('persists pricing engine fields through the transactional product RPC', () => {
    expect(migration).toContain('create or replace function public.admin_save_product_full')
    expect(migration).toContain('fob_usd')
    expect(migration).toContain('qty_per_container')
    expect(migration).toContain('is_loss_leader')
    expect(migration).toContain('table_price_modifier_rate')
  })

  it('keeps partner net price updates traced', () => {
    expect(migration).toContain('override_reason')
    expect(migration).toContain('created_by')
    expect(migration).toContain('updated_by')
    expect(migration).toContain('auth.uid()')
  })

  it('keeps the RPC admin-only', () => {
    expect(migration).toContain('if not public.is_admin() then')
    expect(migration).toContain('revoke execute on function public.admin_save_product_full(jsonb) from public, anon')
    expect(migration).toContain('grant execute on function public.admin_save_product_full(jsonb) to authenticated')
  })
})
