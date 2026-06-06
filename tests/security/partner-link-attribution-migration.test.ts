import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260607090000_partner_link_attribution.sql',
  ),
  'utf8',
)

describe('partner link attribution migration', () => {
  it('adds safe partner slugs without exposing net partner pricing', () => {
    expect(migration).toContain(
      'add column if not exists partner_referral_slug text',
    )
    expect(migration).toContain(
      'create or replace function public.normalize_partner_slug',
    )
    expect(migration).toContain(
      'partner_applications_referral_slug_check',
    )
    expect(migration).toContain('does not expose partner net pricing')
  })

  it('lets reservations link to approved partner applications', () => {
    expect(migration).toContain(
      'add column if not exists partner_application_id uuid',
    )
    expect(migration).toContain(
      'references public.partner_applications(id)',
    )
    expect(migration).toContain(
      'idx_reservations_partner_application_created',
    )
    expect(migration).toContain("'partner_link'")
  })

  it('prioritizes protected deal links before approved partner links', () => {
    expect(migration).toContain(
      'create or replace function public.find_partner_link_attribution',
    )
    expect(migration).toContain('0 as priority')
    expect(migration).toContain('1 as priority')
    expect(migration).toContain(
      'order by matches.priority asc, matches.created_at desc',
    )
  })

  it('updates the reservation attribution trigger to read partner_context', () => {
    expect(migration).toContain(
      "new.contact_snapshot -> 'partner_context' ->> 'slug'",
    )
    expect(migration).toContain(
      'from public.find_partner_link_attribution(v_partner_slug, now())',
    )
    expect(migration).toContain(
      'from public.find_partner_protected_deal(new.siret, v_contact_email, now())',
    )
    expect(migration).toContain(
      'revoke execute on function public.find_partner_link_attribution',
    )
  })
})
