import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702110000_partner_applications.sql',
  ),
  'utf8',
)

describe('partner applications migration', () => {
  it('creates the target + application status enums', () => {
    expect(migration).toContain('create type public.partner_target_status')
    expect(migration).toContain('create type public.partner_application_status')
    for (const value of ['apporteur', 'revendeur', 'grand_compte', 'nsp']) {
      expect(migration).toContain(`'${value}'`)
    }
    for (const value of ['new', 'in_review', 'approved', 'rejected']) {
      expect(migration).toContain(`'${value}'`)
    }
  })

  it('creates the table with required columns and attribution', () => {
    expect(migration).toContain(
      'create table if not exists public.partner_applications',
    )
    expect(migration).toContain('company_name text not null')
    expect(migration).toContain('siret text not null')
    expect(migration).toContain('siret_verified boolean not null default false')
    expect(migration).toContain(
      'target_status public.partner_target_status not null',
    )
    for (const col of ['utm_source', 'utm_medium', 'utm_campaign', 'partner_ref']) {
      expect(migration).toContain(`${col} text`)
    }
  })

  it('enables RLS with anon insert and admin-only management', () => {
    expect(migration).toContain(
      'alter table public.partner_applications enable row level security',
    )
    expect(migration).toContain(
      'create policy "Public creates partner applications"',
    )
    expect(migration).toContain('for insert')
    expect(migration).toContain(
      'create policy "Admins manage partner applications"',
    )
    expect(migration).toContain(
      "public.current_user_role() in ('admin', 'super_admin')",
    )
  })

  it('does not expose a public SELECT policy (write-only for anon)', () => {
    expect(migration).not.toMatch(/for\s+select/i)
  })

  it('indexes triage lookups and partner_ref attribution', () => {
    expect(migration).toContain('idx_partner_applications_status_created')
    expect(migration).toContain('idx_partner_applications_profile_created')
    expect(migration).toContain('partner_applications_partner_ref_idx')
  })
})
