import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260606210000_partner_attribution_on_reservations.sql',
  ),
  'utf8',
)

describe('partner attribution migration', () => {
  it('links reservations to protected partner deals without public exposure', () => {
    expect(migration).toContain('add column if not exists partner_deal_id uuid')
    expect(migration).toContain('references public.partner_deals(id)')
    expect(migration).toContain(
      'add column if not exists partner_attribution_reason text',
    )
    expect(migration).toContain(
      'add column if not exists partner_attribution_snapshot jsonb',
    )
    expect(migration).toContain('idx_reservations_partner_deal_created')
    expect(migration).toContain('never shown publicly')
  })

  it('matches SIRET, exact email and professional email domain in priority order', () => {
    expect(migration).toContain(
      'create or replace function public.find_partner_protected_deal',
    )
    expect(migration).toContain("'client_siret'")
    expect(migration).toContain("'client_email'")
    expect(migration).toContain("'client_email_domain'")
    expect(migration).toContain('order by scored.priority asc')
    expect(migration).toContain('scored.created_at desc')
  })

  it('rejects generic email providers for domain fallback', () => {
    expect(migration).toContain(
      'create or replace function public.is_generic_partner_email_domain',
    )
    expect(migration).toContain("'gmail.com'")
    expect(migration).toContain("'orange.fr'")
    expect(migration).toContain(
      'not public.is_generic_partner_email_domain(i.email_domain)',
    )
  })

  it('attaches attribution from a reservation trigger and keeps lookup private', () => {
    expect(migration).toContain(
      'create or replace function public.set_reservation_partner_attribution',
    )
    expect(migration).toContain(
      'create trigger reservations_set_partner_attribution',
    )
    expect(migration).toContain(
      'before insert or update of siret, contact_snapshot on public.reservations',
    )
    expect(migration).toContain(
      'revoke execute on function public.find_partner_protected_deal',
    )
  })
})
