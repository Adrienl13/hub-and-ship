import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260518204500_stock_requests.sql',
  ),
  'utf8',
)

describe('stock requests migration', () => {
  it('creates the stock request status enum and table', () => {
    expect(migration).toContain('create type public.stock_request_status')
    expect(migration).toContain('create table if not exists public.stock_requests')
    expect(migration).toContain('requested_quantity int not null')
  })

  it('enables RLS with public insert and admin management', () => {
    expect(migration).toContain(
      'alter table public.stock_requests enable row level security',
    )
    expect(migration).toContain('create policy "Public creates stock requests"')
    expect(migration).toContain(
      'create policy "Admins full access stock requests"',
    )
  })

  it('indexes operational admin lookups', () => {
    expect(migration).toContain('idx_stock_requests_status_created')
    expect(migration).toContain('idx_stock_requests_email_created')
    expect(migration).toContain('stock_requests_set_updated_at')
  })
})
