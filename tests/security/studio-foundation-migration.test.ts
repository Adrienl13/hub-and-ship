// Lot 1 Studio — garde de la migration de fondation (texte, sans base).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  INTERNAL_PRODUCT_COST_COLUMNS,
  PUBLIC_PRODUCT_COLUMNS,
} from '../../src/lib/catalogue/product-columns'
import { STUDIO_PROFILE_COLUMNS } from '../../src/lib/studio/repository'

const MIGRATION = '20260907120000_studio_foundation.sql'
const sql = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', MIGRATION),
  'utf8',
)
const code = sql.replace(/--[^\n]*/g, '')

function viewBody(): string {
  const start = code.search(/create\s+or\s+replace\s+view\s+public\.studio_products/i)
  expect(start).toBeGreaterThanOrEqual(0)
  const rest = code.slice(start)
  return rest.slice(0, rest.indexOf(';'))
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

describe('migration studio_foundation : vue studio_products', () => {
  it('est en security_invoker, liste les colonnes publiques explicitement, sans coût', () => {
    const body = viewBody()
    expect(body).toMatch(/with \(security_invoker = true\)/)
    expect(body).toMatch(/from public\.products_public p/)
    for (const column of PUBLIC_PRODUCT_COLUMNS) {
      expect(body).toMatch(new RegExp(`\\bp\\.${column}\\b`))
    }
    for (const column of STUDIO_PROFILE_COLUMNS) {
      expect(body).toMatch(new RegExp(`\\b${column}\\b`))
    }
    for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) {
      expect(body).not.toMatch(new RegExp(`\\b${hidden}\\b`))
    }
    expect(body).not.toMatch(/\bp\.\*/)
    expect(body).not.toMatch(/product_pricing_inputs|pricing_parameters|channel_/)
  })

  it('accorde la lecture à anon et authenticated et vérifie la vue', () => {
    expect(code).toMatch(/grant select on public\.studio_products to anon, authenticated;/)
    expect(code).toContain("has_table_privilege('anon', 'public.studio_products', 'select')")
    expect(code).toContain("has_table_privilege('authenticated', 'public.studio_products', 'select')")
    expect(code).toContain("'fob_usd', 'qty_per_container', 'is_loss_leader', 'table_price_modifier_rate'")
  })
})

describe('migration studio_foundation : RLS et grants', () => {
  it.each([
    'studio_model_families',
    'studio_product_profiles',
    'studio_fulfillment_options',
  ])('%s : RLS activée, revoke global puis lecture publique et écriture admin', (table) => {
    expect(code).toContain(`alter table public.${table} enable row level security;`)
    expect(code).toContain(`revoke all on table public.${table} from anon, public, authenticated;`)
    expect(code).toContain(`grant select on table public.${table} to anon, authenticated;`)
    expect(code).toContain(`grant insert, update, delete on table public.${table} to authenticated;`)
    expect(code).toMatch(
      new RegExp(`create policy "Admins manage [^"]+"\\s+on public\\.${table} for all\\s+using \\(public\\.is_admin\\(\\)\\) with check \\(public\\.is_admin\\(\\)\\)`),
    )
  })

  it("interdit toute écriture anon par auto-vérification", () => {
    expect(code).toContain("has_table_privilege('anon', 'public.studio_product_profiles', 'insert')")
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
    const verifiedContexts = [...code.matchAll(/^.*'verified'.*$/gm)].map((m) => m[0])
    const priceOnly = verifiedContexts.filter((line) => !line.includes("'rejected'"))
    expect(priceOnly.length).toBeGreaterThan(0)
    for (const line of priceOnly) {
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

  it("ne copie jamais le stock : seules des options de production sont semées", () => {
    const seed = code.match(/insert into public\.studio_fulfillment_options[\s\S]*?on conflict/)?.[0]
    expect(seed).toBeDefined()
    expect(seed).toContain("'standard_production'")
    expect(seed).not.toContain("'stock'")
    expect(seed).toContain('greatest(p.moq_units, 1)')
    expect(seed).not.toMatch(/stock_lines/)
  })
})
