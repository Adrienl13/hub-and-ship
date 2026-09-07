// Lot 2 Studio — garde de la migration sessions / événements / curation /
// paires (texte, sans base). Additive, RLS, aucune surface anon sur les
// tables, écritures serveur seulement, aucune donnée inventée.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { STUDIO_EVENT_TYPES } from '../../src/lib/studio/events'
import {
  CURATION_SET_PUBLIC_COLUMNS,
  DIAGNOSTIC_PAIR_PUBLIC_COLUMNS,
} from '../../src/lib/studio/repository'

const MIGRATION = '20260907130000_studio_sessions_events.sql'
const dir = join(process.cwd(), 'supabase', 'migrations')
const sql = readFileSync(join(dir, MIGRATION), 'utf8')
const code = sql.replace(/--[^\n]*/g, '')
const selfCheckStart = code.lastIndexOf('do $$')
const body = code.slice(0, selfCheckStart)

const INTERNAL_TABLES = [
  'studio_sessions',
  'studio_events',
  'studio_curation_sets',
  'studio_diagnostic_pairs',
] as const

function viewBody(view: string): string {
  const start = code.search(new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${view}\\b`, 'i'))
  expect(start, view).toBeGreaterThanOrEqual(0)
  const rest = code.slice(start)
  return rest.slice(0, rest.indexOf(';'))
}

function viewColumns(view: string): string[] {
  const vb = viewBody(view)
  const select = vb.slice(vb.search(/\bselect\b/i) + 6, vb.search(/\bfrom\b/i))
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.match(/\bas\s+(\w+)\s*$/i)?.[1] ?? part.replace(/^\w+\./, ''))
}

describe('migration lot 2 : horodatage et périmètre', () => {
  it('a un horodatage unique, strictement postérieur à la migration 39', () => {
    const names = readdirSync(dir).filter((name) => name.endsWith('.sql'))
    const timestamps = names.map((name) => name.slice(0, 14))
    expect(timestamps.filter((ts) => ts === '20260907130000')).toHaveLength(1)
    expect('20260907130000' > '20260907120000').toBe(true)
    expect(Math.max(...timestamps.map(Number))).toBe(20260907130000)
  })

  it('est strictement additive et ne touche à aucune table existante', () => {
    expect(selfCheckStart).toBeGreaterThan(0)
    expect(code).not.toMatch(/drop\s+column/i)
    expect(code).not.toMatch(/alter\s+column/i)
    expect(code).not.toMatch(/alter\s+table\s+public\.(products|product_variants|stock_lines|reservations|product_favorites)\b/i)
    expect(body).not.toMatch(/\b(update|delete\s+from|insert\s+into)\s+public\./i)
    expect(code).not.toMatch(/drop\s+table\s+(?!if exists)/i)
    for (const forbidden of ['reservations', 'stripe', 'pricing_parameters', 'product_pricing_inputs', 'products']) {
      expect(body.toLowerCase()).not.toMatch(new RegExp(`(alter|update|insert\\s+into|delete\\s+from)\\s+(public\\.)?${forbidden}\\b`))
    }
  })
})

describe('migration lot 2 : schéma', () => {
  it('crée les quatre tables avec contraintes textuelles', () => {
    for (const table of INTERNAL_TABLES) {
      expect(code).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`))
      expect(code).toContain(`alter table public.${table} enable row level security;`)
    }
  })

  it('event_type est strictement contraint et en parité avec le code', () => {
    const check = code.match(/event_type text not null\s+check \(event_type in \(([^)]*)\)\)/)?.[1] ?? ''
    const types = [...check.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(types).toEqual([...STUDIO_EVENT_TYPES])
  })

  it("sessions et événements : aucune PII, version d'algorithme obligatoire, payload borné", () => {
    const sessions = code.slice(code.indexOf('create table if not exists public.studio_sessions'), code.indexOf('create table if not exists public.studio_events'))
    expect(sessions).not.toMatch(/email|phone|name|ip_address|user_agent|user_id/)
    const events = code.slice(code.indexOf('create table if not exists public.studio_events'), code.indexOf('create table if not exists public.studio_curation_sets'))
    expect(events).not.toMatch(/email|phone|ip_address|user_agent|user_id/)
    expect(events).toMatch(/algorithm_version text not null/)
    expect(events).toMatch(/pg_column_size\(payload\) <= 2048/)
    expect(events).toMatch(/jsonb_typeof\(payload\) = 'object'/)
    expect(events).toMatch(/references public\.studio_sessions \(id\) on delete cascade/)
  })

  it('paires diagnostiques : distinctes, axe mesuré, statut vérifiable, VIDES au seed', () => {
    expect(code).toContain('constraint studio_diagnostic_pairs_distinct_check check (product_a_id <> product_b_id)')
    expect(code).toContain("check (status in ('candidate', 'verified', 'rejected'))")
    expect(code).toContain("check (source in ('manual', 'pipeline'))")
    expect(body).not.toMatch(/insert\s+into\s+public\.studio_diagnostic_pairs/i)
    expect(code).toContain("raise exception 'studio_diagnostic_pairs doit être vide à la migration'")
  })

  it('jeux curés : product_ids explicites, critères traçables, aucun jeu inventé, aucun style', () => {
    expect(code).toMatch(/product_ids text\[\] not null default '\{\}'/)
    expect(code).toMatch(/criteria jsonb not null default '\{\}'::jsonb/)
    expect(code).toContain("check (status in ('draft', 'active', 'archived'))")
    expect(body).not.toMatch(/insert\s+into\s+public\.studio_curation_sets/i)
    expect(code).not.toMatch(/style_tags|style_label|style text/)
    expect(code).toContain("raise exception 'studio_curation_sets doit être vide à la migration (aucun jeu inventé)'")
  })
})

describe('migration lot 2 : RLS et grants minimaux', () => {
  it.each(INTERNAL_TABLES)('%s : revoke global, aucun grant anon, policies is_admin() seulement', (table) => {
    expect(code).toContain(`revoke all on table public.${table} from anon, public, authenticated;`)
    expect(code).not.toMatch(new RegExp(`grant\\s+[^;]*on\\s+(table\\s+)?public\\.${table}\\s+to\\s+[^;]*anon`, 'i'))
    const policies = [...code.matchAll(new RegExp(`create policy "([^"]+)"\\s+on public\\.${table}\\b([^;]*);`, 'g'))]
    expect(policies.length).toBeGreaterThan(0)
    for (const policy of policies) expect(policy[2]).toMatch(/using \(public\.is_admin\(\)\)/)
  })

  it("sessions et événements : lecture admin seulement, jamais d'écriture client", () => {
    expect(code).toContain('grant select on table public.studio_sessions to authenticated;')
    expect(code).toContain('grant select on table public.studio_events to authenticated;')
    expect(code).not.toMatch(/grant\s+[^;]*(insert|update|delete)[^;]*on\s+table\s+public\.studio_(sessions|events)\b/i)
    expect(code).toContain("raise exception 'studio_events / studio_sessions : aucune écriture client'")
  })

  it('curation et paires : gestion admin par RLS for all', () => {
    expect(code).toContain('grant select, insert, update, delete on table public.studio_curation_sets to authenticated;')
    expect(code).toContain('grant select, insert, update, delete on table public.studio_diagnostic_pairs to authenticated;')
    expect(code).toMatch(/on public\.studio_curation_sets for all\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/)
    expect(code).toMatch(/on public\.studio_diagnostic_pairs for all\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/)
  })
})

describe('migration lot 2 : surfaces publiques minimales', () => {
  it('studio_curation_sets_public : jeux actifs, colonnes explicites en parité avec le code', () => {
    const vb = viewBody('studio_curation_sets_public')
    expect(vb).toMatch(/with \(security_barrier = true\)/)
    expect(vb).toMatch(/where s\.status = 'active'/)
    expect(viewColumns('studio_curation_sets_public')).toEqual([...CURATION_SET_PUBLIC_COLUMNS])
    expect(vb).not.toMatch(/notes|criteria|created_by/)
    expect(code).toContain('grant select on public.studio_curation_sets_public to anon, authenticated;')
    expect(code).toContain('revoke all on public.studio_curation_sets_public from public;')
  })

  it('studio_diagnostic_pairs_public : paires vérifiées entre produits actifs, colonnes explicites', () => {
    const vb = viewBody('studio_diagnostic_pairs_public')
    expect(vb).toMatch(/with \(security_barrier = true\)/)
    expect(vb).toMatch(/where d\.status = 'verified'/)
    expect(vb).toMatch(/a\.id = d\.product_a_id and a\.is_active/)
    expect(vb).toMatch(/b\.id = d\.product_b_id and b\.is_active/)
    expect(viewColumns('studio_diagnostic_pairs_public')).toEqual([...DIAGNOSTIC_PAIR_PUBLIC_COLUMNS])
    expect(vb).not.toMatch(/notes|verified_by|source/)
    expect(code).toContain('grant select on public.studio_diagnostic_pairs_public to anon, authenticated;')
  })

  it("aucune surface publique pour les sessions ni les événements", () => {
    expect(code).not.toMatch(/create\s+or\s+replace\s+view\s+public\.studio_(sessions|events)/i)
    expect(code).toContain("'notes', 'criteria', 'created_by', 'verified_by', 'status', 'source'")
  })
})
