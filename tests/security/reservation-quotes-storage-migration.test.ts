import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260615151000_reservation_quotes_storage.sql',
  ),
  'utf8',
)

describe('reservation quotes storage migration', () => {
  it('adds the private quote path to reservations', () => {
    expect(migration).toContain('add column if not exists quote_pdf_path text')
    expect(migration).toContain('reservation-quotes')
  })

  it('creates a private PDF bucket managed only by admins', () => {
    expect(migration).toContain('insert into storage.buckets')
    expect(migration).toContain("'reservation-quotes'")
    expect(migration).toContain('false')
    expect(migration).toContain("array['application/pdf']::text[]")
    expect(migration).toContain(
      'create policy "Admins manage reservation quote objects"',
    )
    expect(migration).toContain('and public.is_admin()')
  })
})
