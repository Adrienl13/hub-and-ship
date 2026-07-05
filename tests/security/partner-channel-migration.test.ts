import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260606190000_partner_applications_and_deals.sql',
  ),
  'utf8',
)

describe('partner channel migration', () => {
  it('creates partner applications and protected deal tables', () => {
    expect(migration).toContain('create type public.partner_application_status')
    expect(migration).toContain('create type public.partner_deal_status')
    expect(migration).toContain(
      'create table if not exists public.partner_applications',
    )
    expect(migration).toContain(
      'create table if not exists public.partner_deals',
    )
    expect(migration).toContain(
      'application_id uuid references public.partner_applications(id)',
    )
    expect(migration).toContain(
      'protection_days int not null default 120 check',
    )
  })

  it('keeps prospect data admin-only under RLS', () => {
    expect(migration).toContain(
      'alter table public.partner_applications enable row level security',
    )
    expect(migration).toContain(
      'alter table public.partner_deals enable row level security',
    )
    expect(migration).toContain(
      'create policy "Admins full access partner applications"',
    )
    expect(migration).toContain(
      'create policy "Admins full access partner deals"',
    )
    expect(migration).not.toContain('Public creates partner')
  })

  it('indexes admin triage and duplicate checks', () => {
    expect(migration).toContain('idx_partner_applications_status_created')
    expect(migration).toContain('idx_partner_applications_siret_created')
    expect(migration).toContain('idx_partner_deals_status_created')
    expect(migration).toContain('idx_partner_deals_client_siret')
    expect(migration).toContain('partner_deals_set_updated_at')
  })
})
