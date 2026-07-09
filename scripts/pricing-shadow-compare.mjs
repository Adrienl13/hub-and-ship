/* global console, process */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env.local')
const psqlCandidates = [
  process.env.PSQL_BIN,
  'psql',
  '/opt/homebrew/opt/libpq/bin/psql',
  '/usr/local/opt/libpq/bin/psql',
].filter(Boolean)

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

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

const dbUrl = process.env.SUPABASE_DB_URL ?? ''
if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error(
    'Missing SUPABASE_DB_URL. Add the Postgres URI to .env.local before running pricing shadow compare.',
  )
  process.exit(1)
}

const psqlBin = findPsql()
if (!psqlBin) {
  console.error('psql is required. Install libpq or set PSQL_BIN=/path/to/psql.')
  process.exit(1)
}

const sql = `
\\pset pager off
\\pset null '(null)'

\\echo '== Pricing Shadow Compare: current base price vs get_price(direct, qty=1) =='
with priced as (
  select
    p.sku,
    p.name,
    p.category,
    p.base_price_ht,
    ppi.fob_usd,
    ppi.qty_per_container,
    gp.landed_cost_ht,
    gp.formula_price_ht,
    gp.unit_price_ht,
    round(gp.unit_price_ht - p.base_price_ht, 2) as delta_ht,
    case
      when p.base_price_ht = 0 then null
      else round(((gp.unit_price_ht - p.base_price_ht) / p.base_price_ht) * 100, 2)
    end as delta_percent,
    coalesce(ppi.is_loss_leader, false) as is_loss_leader
  from public.products p
  left join public.product_pricing_inputs ppi on ppi.product_id = p.id
  cross join lateral public.get_price(
    p.id,
    'direct'::public.pricing_channel,
    1,
    null,
    now()
  ) gp
  where p.is_active
)
select *
from priced
order by abs(delta_ht) desc, sku
limit 80;

\\echo ''
\\echo '== Cost Field Readiness =='
select
  count(*) filter (where ppi.fob_usd is null) as missing_fob_usd,
  count(*) filter (where ppi.qty_per_container is null) as missing_qty_per_container,
  count(*) filter (
    where ppi.qty_per_container is not null
      and p.cbm_per_unit > 0
      and (
        abs(
          ppi.qty_per_container
          - round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
        )::numeric / greatest(ppi.qty_per_container, 1)
      ) > 0.15
  ) as qty_container_review_needed,
  count(*) as active_products
from public.products p
left join public.product_pricing_inputs ppi on ppi.product_id = p.id
cross join lateral (
  select useful_container_cbm_40hc
  from public.pricing_parameters
  where is_active
  order by version desc
  limit 1
) pp
where p.is_active;
`

const result = spawnSync(
  psqlBin,
  [dbUrl, '--set', 'ON_ERROR_STOP=1'],
  {
    input: sql,
    encoding: 'utf8',
  },
)

if (result.stdout) console.log(result.stdout)
if (result.stderr) console.error(result.stderr)

process.exit(result.status ?? 1)
