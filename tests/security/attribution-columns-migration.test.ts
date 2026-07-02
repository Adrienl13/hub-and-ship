import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702100000_attribution_columns.sql',
  ),
  'utf8',
)

describe('attribution columns migration', () => {
  it('adds the four nullable attribution columns to reservations', () => {
    expect(migration).toContain('alter table public.reservations')
    for (const col of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'partner_ref',
    ]) {
      expect(migration).toContain(`add column if not exists ${col} text`)
    }
  })

  it('adds the same attribution columns to stock_requests', () => {
    expect(migration).toContain('alter table public.stock_requests')
  })

  it('is additive and idempotent (no drops, columns stay nullable)', () => {
    expect(migration).not.toMatch(/drop\s+column/i)
    // The added columns must not carry a NOT NULL constraint (legacy rows).
    expect(migration).not.toMatch(/add column[^\n;]*not null/i)
  })

  it('indexes partner_ref for attribution reporting', () => {
    expect(migration).toContain('reservations_partner_ref_idx')
    expect(migration).toContain('stock_requests_partner_ref_idx')
    expect(migration).toContain('where partner_ref is not null')
  })
})
