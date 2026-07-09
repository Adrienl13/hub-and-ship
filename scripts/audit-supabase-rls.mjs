/* global console, process */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, 'audit-supabase-rls.sql')
const envPath = resolve(__dirname, '..', '.env.local')
const psqlCandidates = [
  process.env.PSQL_BIN,
  'psql',
  '/opt/homebrew/opt/libpq/bin/psql',
  '/usr/local/opt/libpq/bin/psql',
].filter(Boolean)

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function unquote(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function loadLocalEnv() {
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator < 1) continue

    const key = trimmed.slice(0, separator).trim()
    const value = unquote(trimmed.slice(separator + 1))

    if (process.env[key] === undefined) process.env[key] = value
  }
}

function findPsql() {
  for (const candidate of psqlCandidates) {
    const check = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
    if (!check.error && check.status === 0) return candidate
  }
  return null
}

loadLocalEnv()

const dbUrl =
  argValue('--url') ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  ''

if (!existsSync(sqlPath)) {
  console.error(`Missing SQL audit file: ${sqlPath}`)
  process.exit(1)
}

if (!dbUrl) {
  console.error(
    [
      'Missing database URL.',
      '',
      'Add SUPABASE_DB_URL to .env.local or pass it on the command line.',
      '',
      'Usage:',
      '  SUPABASE_DB_URL="postgresql://..." npm run audit:supabase',
      '  npm run audit:supabase -- --url "postgresql://..."',
      '',
      'In Supabase: Connect → Direct → Connection string → URI.',
      'The URL must start with postgresql:// and point to Postgres, not the REST/API URL.',
    ].join('\n'),
  )
  process.exit(1)
}

if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error(
    [
      'Invalid database URL.',
      '',
      `Received: ${dbUrl.replace(/:[^:@/]*@/, ':***@')}`,
      '',
      'This audit needs a Postgres URI, not the Supabase REST URL.',
      'Use Supabase Connect → Direct → Connection string → URI.',
      'Expected format: postgresql://postgres.<project-ref>:<password>@...:6543/postgres',
    ].join('\n'),
  )
  process.exit(1)
}

const psqlBin = findPsql()
if (!psqlBin) {
  console.error(
    [
      'psql is required for the live Supabase audit.',
      '',
      'Install it on macOS with:',
      '  brew install libpq',
      '',
      'If psql is installed in a custom location, set:',
      '  PSQL_BIN="/path/to/psql"',
      '',
      'Then retry:',
      '  npm run audit:supabase',
    ].join('\n'),
  )
  process.exit(1)
}

const result = spawnSync(
  psqlBin,
  [dbUrl, '--set', 'ON_ERROR_STOP=1', '--file', sqlPath],
  {
    encoding: 'utf8',
    stdio: 'inherit',
  },
)

process.exit(result.status ?? 1)
