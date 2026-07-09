import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'scripts/audit-supabase-rls.sql'),
  'utf8',
)
const runner = readFileSync(
  join(process.cwd(), 'scripts/audit-supabase-rls.mjs'),
  'utf8',
)

describe('Supabase live audit script', () => {
  it('inspects policies, grants, functions and storage buckets', () => {
    expect(sql).toContain('pg_policies')
    expect(sql).toContain('information_schema.role_table_grants')
    expect(sql).toContain('pg_proc')
    expect(sql).toContain('storage.buckets')
    expect(sql).toContain('High-Signal Warnings')
  })

  it('runs through psql using an explicit database URL', () => {
    expect(runner).toContain('SUPABASE_DB_URL')
    expect(runner).toContain('DATABASE_URL')
    expect(runner).toContain('PSQL_BIN')
    expect(runner).toContain('/opt/homebrew/opt/libpq/bin/psql')
    expect(runner).toContain('spawnSync(')
    expect(runner).toContain('audit-supabase-rls.sql')
  })
})
