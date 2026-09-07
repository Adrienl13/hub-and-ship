// Lot 1 Studio — garde de la migration de fondation (texte, sans base).
//
// Surface publique minimale (revue corrective) : les tables studio_* sont
// internes (aucun grant anon, RLS is_admin() seule), le public lit des vues
// dédiées à colonnes explicites ; aucune colonne interne (notes, note,
// created_by, updated_by, confirmed_by), aucun UUID auth.users, aucune
// colonne de coût ; data_quality projetée ; aucune option semée confirmée.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  INTERNAL_PRODUCT_COST_COLUMNS,
  PUBLIC_PRODUCT_COLUMNS,
} from '../../src/lib/catalogue/product-columns'
import {
  FULFILLMENT_OPTION_COLUMNS,
  MODEL_FAMILY_PUBLIC_COLUMNS,
  STUDIO_INTERNAL_COLUMNS,
  STUDIO_PROFILE_COLUMNS,
  STUDIO_PROFILE_PUBLIC_COLUMNS,
} from '../../src/lib/studio/repository'

const MIGRATION = '20260907120000_studio_foundation.sql'
const sql = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', MIGRATION),
  'utf8',
)
const code = sql.replace(/--[^\n]*/g, '')

const INTERNAL_TABLES = [
  'studio_model_families',
  'studio_product_profiles',
  'studio_fulfillment_options',
] as const

const PUBLIC_VIEWS = [
  'studio_products',
  'studio_product_profiles_public',
  'studio_fulfillment_options_public',
  'studio_model_families_public',
] as const

function viewBody(view: string): string {
  const start = code.search(new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${view}\\b`, 'i'))
  expect(start, view).toBeGreaterThanOrEqual(0)
  const rest = code.slice(start)
  return rest.slice(0, rest.indexOf(';'))
}

/** Colonnes projetées d'une vue (alias inclus), sans les clauses from/where. */
function viewColumns(view: string): string[] {
  const body = viewBody(view)
  const select = body.slice(body.search(/\bselect\b/i) + 6, body.search(/\bfrom\b/i))
  return select
    .split(/,(?![^(]*\))/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const alias = part.match(/\bas\s+(\w+)\s*$/i)?.[1]
      return alias ?? part.replace(/^\w+\./, '')
    })
}

describe('migration studio_foundation : horodatage et périmètre', () => {
  it('est postérieure à la migration 38 des grants authenticated', () => {
    expect(MIGRATION > '20260907110000_products_authenticated_column_grants.sql').toBe(true)
  })

  it('est strictement additive : aucune suppression ni modification de colonne', () => {
    expect(code).not.toMatch(/drop\s+column/i)
    expect(code).not.toMatch(/rename\s+(column|to)/i)
    expect(code).not.toMatch(/alter\s+column/i)
    expect(code).not.toMatch(/alter\s+table\s+public\.products\b/i)
    expect(code).not.toMatch(/alter\s+table\s+public\.product_variants\b/i)
    expect(code).not.toMatch(/update\s+public\.products\b/i)
    expect(code).not.toMatch(/update\s+public\.product_variants\b/i)
    expect(code).not.toMatch(/delete\s+from/i)
    expect(code).not.toMatch(/drop\s+table\s+(?!if exists)/i)
  })

  it('ne touche ni au panier, ni aux réservations, ni à Stripe, ni au pricing', () => {
    for (const forbidden of [
      'reservations',
      'reservation_items',
      'pricing_parameters',
      'product_pricing_inputs',
      'stripe',
      'channel_price_overrides',
    ]) {
      expect(code.toLowerCase()).not.toMatch(
        new RegExp(`(alter|update|insert\\s+into|delete\\s+from)\\s+(public\\.)?${forbidden}\\b`),
      )
    }
  })
})

describe('migration studio_foundation : schéma', () => {
  it('crée les trois tables studio_* avec contraintes textuelles extensibles', () => {
    expect(code).toMatch(/create table if not exists public\.studio_model_families/)
    expect(code).toMatch(/create table if not exists public\.studio_product_profiles/)
    expect(code).toMatch(/create table if not exists public\.studio_fulfillment_options/)
    expect(code).toContain("check (status in ('candidate', 'verified', 'rejected'))")
    expect(code).toContain("check (studio_role in ('seat', 'tabletop', 'base', 'catalog_only'))")
    expect(code).toContain("('stock', 'standard_production', 'grouped_production', 'manual_review')")
    expect(code).toContain("check (price_basis in ('container', 'stock'))")
  })

  it('porte une qualité de données granulaire en jsonb et des traits visuels calculés', () => {
    expect(code).toMatch(/data_quality jsonb not null default '\{\}'::jsonb/)
    expect(code).toMatch(/visual_traits jsonb/)
    expect(code).not.toMatch(/style_tags/)
  })

  it('les profils sont liés à products en cascade et référencent des familles', () => {
    expect(code).toContain('product_id text primary key references public.products (id) on delete cascade')
    expect(code).toContain('model_family_id text references public.studio_model_families (id) on delete set null')
  })
})

describe('migration studio_foundation : tables internes (aucune surface publique directe)', () => {
  it.each(INTERNAL_TABLES)('%s : RLS activée, revoke global, aucun grant anon, écriture et lecture admin seulement', (table) => {
    expect(code).toContain(`alter table public.${table} enable row level security;`)
    expect(code).toContain(`revoke all on table public.${table} from anon, public, authenticated;`)
    expect(code).toContain(`grant select, insert, update, delete on table public.${table} to authenticated;`)
    // Aucun grant à anon sur la table, ni table-level ni colonne par colonne.
    expect(code).not.toMatch(new RegExp(`grant\\s+[^;]*on\\s+table\\s+public\\.${table}\\s+to\\s+[^;]*anon`, 'i'))
    expect(code).not.toMatch(new RegExp(`grant\\s+[^;]*on\\s+public\\.${table}\\s+to\\s+[^;]*anon`, 'i'))
    // Une seule policy, is_admin().
    const policies = [...code.matchAll(new RegExp(`create policy "([^"]+)"\\s+on public\\.${table}\\b([^;]*);`, 'g'))]
    expect(policies).toHaveLength(1)
    expect(policies[0]?.[2]).toMatch(/for all\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/)
    expect(code).not.toMatch(new RegExp(`on public\\.${table} for select using \\((true|is_active = true)\\)`))
  })

  it("interdit tout droit anon sur les tables internes par auto-vérification", () => {
    expect(code).toContain("has_table_privilege('anon', 'public.' || internal_table, 'select')")
    expect(code).toContain("has_column_privilege('anon', 'public.' || internal_table, internal_column, 'select')")
    expect(code).toContain("array['notes', 'note', 'created_by', 'updated_by', 'confirmed_by', 'data_quality']")
    expect(code).toContain("not like '%is_admin()%'")
  })
})

describe('migration studio_foundation : surfaces publiques explicites', () => {
  it.each(PUBLIC_VIEWS)('%s : aucune colonne interne, de coût, ni p.* ; grant select anon + authenticated', (view) => {
    const body = viewBody(view)
    for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) {
      expect(body, hidden).not.toMatch(new RegExp(`\\b${hidden}\\b`))
    }
    for (const internal of STUDIO_INTERNAL_COLUMNS) {
      // Tolérance unique : `(o.confirmed_by is not null) as is_confirmed`.
      const stripped = body.replace(/\(\s*o\.confirmed_by is not null\s*\)\s+as\s+is_confirmed/, '')
      expect(stripped, internal).not.toMatch(new RegExp(`\\b${internal}\\b`))
    }
    expect(body).not.toMatch(/\b\w+\.\*/)
    expect(body).not.toMatch(/product_pricing_inputs|pricing_parameters|channel_/)
    expect(code).toMatch(new RegExp(`revoke all on public\\.${view} from public;`))
    expect(code).toMatch(new RegExp(`grant select on public\\.${view} to anon, authenticated;`))
  })

  it('studio_products : security_invoker, colonnes publiques de products + profil PUBLIC (jamais la table)', () => {
    const body = viewBody('studio_products')
    expect(body).toMatch(/with \(security_invoker = true\)/)
    expect(body).toMatch(/from public\.products_public p/)
    expect(body).toMatch(/left join public\.studio_product_profiles_public sp/)
    expect(body).not.toMatch(/join public\.studio_product_profiles\s/)
    const columns = viewColumns('studio_products')
    expect(columns).toEqual([...PUBLIC_PRODUCT_COLUMNS, ...STUDIO_PROFILE_COLUMNS])
  })

  it('studio_product_profiles_public : colonnes explicites, data_quality projetée, produits actifs, security_barrier', () => {
    const body = viewBody('studio_product_profiles_public')
    expect(body).toMatch(/with \(security_barrier = true\)/)
    expect(body).toMatch(/public\.studio_public_data_quality\(sp\.data_quality\) as data_quality/)
    expect(body).toMatch(/p\.is_active/)
    expect(viewColumns('studio_product_profiles_public')).toEqual([...STUDIO_PROFILE_PUBLIC_COLUMNS])
  })

  it('studio_fulfillment_options_public : is_confirmed booléen, jamais confirmed_by, options actives, parité avec le code', () => {
    const body = viewBody('studio_fulfillment_options_public')
    expect(body).toMatch(/with \(security_barrier = true\)/)
    expect(body).toMatch(/\(o\.confirmed_by is not null\) as is_confirmed/)
    expect(body).toMatch(/where o\.is_active = true/)
    expect(viewColumns('studio_fulfillment_options_public')).toEqual([...FULFILLMENT_OPTION_COLUMNS])
  })

  it('studio_model_families_public : id, label, status des familles vérifiées seulement', () => {
    const body = viewBody('studio_model_families_public')
    expect(body).toMatch(/where f\.status = 'verified'/)
    expect(viewColumns('studio_model_families_public')).toEqual([...MODEL_FAMILY_PUBLIC_COLUMNS])
  })

  it('la projection data_quality est une liste blanche status/source/updatedAt et exclut by/note', () => {
    const start = code.search(/create or replace function public\.studio_public_data_quality/)
    expect(start).toBeGreaterThanOrEqual(0)
    const fn = code.slice(start, code.indexOf('$$;', start))
    expect(fn).toMatch(/'status', entry\.value -> 'status'/)
    expect(fn).toMatch(/'source', entry\.value -> 'source'/)
    expect(fn).toMatch(/'updatedAt', entry\.value -> 'updatedAt'/)
    expect(fn).not.toMatch(/'by'|'note'/)
    expect(fn).toMatch(/set search_path = ''/)
    expect(code).toContain('grant execute on function public.studio_public_data_quality(jsonb) to anon, authenticated;')
    // Auto-vérification en base.
    expect(code).toContain("?| array['by', 'note']")
  })

  it("l'auto-vérification balaie les colonnes internes et de coût sur les quatre surfaces", () => {
    expect(code).toContain("'notes', 'note', 'created_by', 'updated_by', 'confirmed_by')")
    expect(code).toContain("'fob_usd', 'qty_per_container', 'is_loss_leader', 'table_price_modifier_rate',")
    for (const view of PUBLIC_VIEWS) expect(code).toContain(`'${view}'`)
  })
})

describe('migration studio_foundation : peuplement prudent', () => {
  it('est idempotent et ne renseigne jamais model_family_id', () => {
    expect(code).toMatch(/on conflict \(product_id\) do nothing/)
    const insertColumns = code.match(
      /insert into public\.studio_product_profiles\s*\(([^)]*)\)/,
    )?.[1]
    expect(insertColumns).toBeDefined()
    expect(insertColumns).not.toContain('model_family_id')
    expect(code).toContain('where model_family_id is not null')
  })

  it("ne produit jamais 'verified' depuis une heuristique", () => {
    // Le seul 'verified' du peuplement est le prix public existant.
    const seedStart = code.search(/with family_modes as/)
    const seed = code.slice(seedStart, code.search(/do \$\$/))
    const verifiedLines = [...seed.matchAll(/^.*'verified'.*$/gm)].map((m) => m[0])
    expect(verifiedLines.length).toBeGreaterThan(0)
    for (const line of verifiedLines) {
      expect(line).toMatch(/base_price_ht > 0 and c\.visibility = 'public'/)
    }
    expect(code).toContain("'catalogue_public_price'")
    expect(code).toMatch(/'sku_prefix'/)
    expect(code).toMatch(/'family_mode'/)
  })

  it('met en quarantaine les catégories incohérentes relevées par l’audit', () => {
    for (const sku of ['ROP-031', 'ROP-016', 'TES-031', 'BIS-049', 'TBA-010', 'TES-024', 'TES-043']) {
      expect(code).toContain(`'${sku}'`)
    }
  })

  it("ne copie jamais le stock et ne confirme jamais une option semée", () => {
    const seed = code.match(/insert into public\.studio_fulfillment_options[\s\S]*?on conflict/)?.[0]
    expect(seed).toBeDefined()
    expect(seed).toContain("'standard_production'")
    expect(seed).toContain("'seed_moq'")
    expect(seed).not.toContain("'stock'")
    expect(seed).not.toContain('confirmed_by')
    expect(seed).toContain('greatest(p.moq_units, 1)')
    expect(seed).not.toMatch(/stock_lines|containers/)
    // Auto-vérification : seed_moq jamais confirmée.
    expect(code).toContain("where source = 'seed_moq' and confirmed_by is not null")
  })
})
