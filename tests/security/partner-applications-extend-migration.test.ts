import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260703140000_partner_applications_extend.sql',
  ),
  'utf8',
)

describe('partner applications extend migration (fusion)', () => {
  it('creates the target-status enum idempotently', () => {
    expect(migration).toContain('create type public.partner_target_status')
    expect(migration).toContain('duplicate_object then null')
  })

  it('extends the codex table with mockup + attribution columns, all guarded', () => {
    for (const col of [
      'activity_profile',
      'target_status',
      'siret_verified',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'partner_ref',
    ]) {
      expect(migration).toContain(`add column if not exists ${col}`)
    }
  })

  it('stays additive (no drops, no rewrite of the codex pipeline)', () => {
    expect(migration).not.toMatch(/drop\s+(column|table)/i)
    expect(migration).not.toMatch(/alter\s+type\s+public\.partner_application_status/i)
  })
})
