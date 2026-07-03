import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260702140000_partner_self_read.sql',
  ),
  'utf8',
)

describe('partner self-read migration', () => {
  it('lets a partner select their own partner codes (scoped to their company)', () => {
    expect(migration).toContain('create policy "Partners read own codes"')
    expect(migration).toContain('company_id = public.current_company_id()')
  })

  it('scopes commission reads to the partner’s own codes only', () => {
    expect(migration).toContain('create policy "Partners read own commissions"')
    expect(migration).toContain('partner_code_id in (')
    expect(migration).toMatch(/for\s+select/i)
  })

  it('is read-only (no insert/update/delete granted to partners)', () => {
    expect(migration).not.toMatch(/for\s+(insert|update|delete|all)/i)
  })
})
