// @vitest-environment node
//
// Lot 1 Studio (revue corrective) — matrice d'accès RÉELLE des surfaces
// Studio sur une base Supabase où la migration 39 est appliquée (locale via
// `supabase start`, staging, ou production avec des comptes de TEST).
//
// Ignoré tant que les variables ne sont pas présentes (`bun run test` reste
// déterministe sans base) :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY          (obligatoires)
//   TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD               (compte NON admin)
//   EXPECTED_MIN_ACTIVE_PRODUCTS                        (défaut 1)
// Jamais de vrai compte client : voir docs/COMPTES_TEST.md. Aucun secret
// n'est écrit dans le repo.
//
// Ce que le test EXIGE, en anon puis en buyer :
// - tentatives explicites de lire notes, note, created_by, updated_by,
//   confirmed_by sur les tables internes → refus (anon) ou refus/vide (buyer,
//   RLS is_admin()) ; sur les vues publiques → colonne inexistante ;
// - select=* sur les vues publiques → exactement les colonnes publiques,
//   aucun UUID admin, aucune note ;
// - data_quality publique → uniquement status/source/updatedAt.

import { describe, expect, it } from 'vitest'

import { INTERNAL_PRODUCT_COST_COLUMNS, PUBLIC_PRODUCT_COLUMNS } from '../../src/lib/catalogue/product-columns'
import {
  CURATION_SET_PUBLIC_COLUMNS,
  DIAGNOSTIC_PAIR_PUBLIC_COLUMNS,
  FULFILLMENT_OPTION_COLUMNS,
  MODEL_FAMILY_PUBLIC_COLUMNS,
  STUDIO_INTERNAL_COLUMNS,
  STUDIO_PROFILE_COLUMNS,
  STUDIO_PROFILE_PUBLIC_COLUMNS,
} from '../../src/lib/studio/repository'
import {
  DATA_QUALITY_FIELDS,
  DATA_QUALITY_SOURCES,
  DATA_QUALITY_STATUSES,
} from '../../src/lib/studio/types'

const url = process.env.SUPABASE_TEST_URL?.replace(/\/$/, '')
const anonKey = process.env.SUPABASE_TEST_ANON_KEY
const buyerEmail = process.env.TEST_BUYER_EMAIL
const buyerPassword = process.env.TEST_BUYER_PASSWORD
const expectedMin = Number(process.env.EXPECTED_MIN_ACTIVE_PRODUCTS ?? '1')

const configured = Boolean(url && anonKey)
const hasBuyer = configured && Boolean(buyerEmail && buyerPassword)

const INTERNAL_TABLES = [
  'studio_product_media', 'studio_product_visual_features', 'studio_product_neighbors', 'studio_model_family_candidates', 'studio_algorithm_versions', 'studio_visual_jobs',
  'studio_model_families',
  'studio_product_profiles',
  'studio_fulfillment_options',
  // Lot 2 (migration 40) : absentes tant qu'elle n'est pas appliquée (404 toléré).
  'studio_sessions',
  'studio_events',
  'studio_curation_sets',
  'studio_diagnostic_pairs',
] as const

const PUBLIC_SURFACES: ReadonlyArray<{ view: string; columns: ReadonlyArray<string>; optional?: boolean }> = [
  { view: 'studio_product_media_public', columns: ['product_id','role','url'], optional: true },
  { view: 'studio_product_neighbors_public', columns: ['product_id','neighbor_product_id','rank','similarity','model_version'], optional: true },
  { view: 'studio_algorithm_versions_public', columns: ['version','engine','model_version','status'], optional: true },
  { view: 'studio_products', columns: [...PUBLIC_PRODUCT_COLUMNS, ...STUDIO_PROFILE_COLUMNS] },
  { view: 'studio_product_profiles_public', columns: STUDIO_PROFILE_PUBLIC_COLUMNS },
  { view: 'studio_fulfillment_options_public', columns: FULFILLMENT_OPTION_COLUMNS },
  { view: 'studio_model_families_public', columns: MODEL_FAMILY_PUBLIC_COLUMNS },
  { view: 'studio_curation_sets_public', columns: CURATION_SET_PUBLIC_COLUMNS, optional: true },
  { view: 'studio_diagnostic_pairs_public', columns: DIAGNOSTIC_PAIR_PUBLIC_COLUMNS, optional: true },
]

const DATA_QUALITY_PUBLIC_KEYS = new Set(['status', 'source', 'updatedAt'])
const DATA_QUALITY_FIELD_SET = new Set<string>(DATA_QUALITY_FIELDS)
const DATA_QUALITY_STATUS_SET = new Set<string>(DATA_QUALITY_STATUSES)
const DATA_QUALITY_SOURCE_SET = new Set<string>(DATA_QUALITY_SOURCES)

interface RestResult {
  readonly status: number
  readonly body: unknown
}

async function rest(path: string, token: string): Promise<RestResult> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey as string,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // corps non JSON : on garde le texte
  }
  return { status: response.status, body }
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey as string, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = (await response.json()) as { access_token?: string }
  if (!response.ok || !json.access_token) {
    throw new Error(`Connexion impossible pour ${email} : ${response.status}`)
  }
  return json.access_token
}

function code(result: RestResult): string | undefined {
  const body = result.body as { code?: string } | null
  return body && typeof body === 'object' ? body.code : undefined
}

/** Refus de privilège (401/403 ou 42501 « permission denied »). */
function isDenied(result: RestResult): boolean {
  return result.status === 401 || result.status === 403 || code(result) === '42501'
}

/** La colonne n'existe pas dans la surface (42703 « undefined column »). */
function isUndefinedColumn(result: RestResult): boolean {
  return result.status === 400 && code(result) === '42703'
}

function rows(result: RestResult): ReadonlyArray<Record<string, unknown>> {
  return Array.isArray(result.body) ? (result.body as ReadonlyArray<Record<string, unknown>>) : []
}

async function expectInternalColumnsUnreadable(token: string, label: string, allowEmpty: boolean) {
  for (const table of INTERNAL_TABLES) {
    const star = await rest(`${table}?select=*&limit=1`, token)
    if (star.status === 404) continue
    const starOk = isDenied(star) || (allowEmpty && star.status === 200 && rows(star).length === 0)
    expect(starOk, `${label} ${table} select=* → HTTP ${star.status}`).toBe(true)

    for (const column of STUDIO_INTERNAL_COLUMNS) {
      const direct = await rest(`${table}?select=${column}&limit=1`, token)
      const ok =
        isDenied(direct) ||
        isUndefinedColumn(direct) ||
        (allowEmpty && direct.status === 200 && rows(direct).length === 0)
      expect(ok, `${label} ${table}.${column} → HTTP ${direct.status} ${JSON.stringify(direct.body).slice(0, 120)}`).toBe(true)
      // Jamais une ligne avec la colonne.
      expect(rows(direct).some((row) => column in row), `${label} ${table}.${column} renvoie des lignes`).toBe(false)
    }
  }

  // Sur les vues publiques, les colonnes internes n'existent pas.
  for (const { view } of PUBLIC_SURFACES) {
    for (const column of [...STUDIO_INTERNAL_COLUMNS, ...INTERNAL_PRODUCT_COST_COLUMNS]) {
      const direct = await rest(`${view}?select=${column}&limit=1`, token)
      expect(direct.status, `${label} ${view}.${column} doit être inexistante`).not.toBe(200)
    }
  }
}

async function expectPublicSurfacesMinimal(token: string, label: string) {
  for (const { view, columns, optional } of PUBLIC_SURFACES) {
    const explicit = await rest(`${view}?select=${columns.join(',')}&limit=5`, token)
    if (optional && explicit.status === 404) continue
    expect(explicit.status, `${label} ${view} colonnes explicites`).toBe(200)

    const star = await rest(`${view}?select=*&limit=5`, token)
    expect(star.status, `${label} ${view} select=*`).toBe(200)
    for (const row of rows(star)) {
      // Liste blanche stricte : exactement les colonnes publiques.
      expect(Object.keys(row).sort(), `${label} ${view} colonnes`).toEqual([...columns].sort())
      for (const internal of [...STUDIO_INTERNAL_COLUMNS, ...INTERNAL_PRODUCT_COST_COLUMNS]) {
        expect(row, `${label} ${view}.${internal}`).not.toHaveProperty(internal)
      }
      if ('is_confirmed' in row) expect(typeof row.is_confirmed).toBe('boolean')
      if ('data_quality' in row && row.data_quality && typeof row.data_quality === 'object') {
        for (const [field, entry] of Object.entries(row.data_quality as Record<string, unknown>)) {
          expect(DATA_QUALITY_FIELD_SET.has(field), `${label} ${view}.data_quality.${field} hors liste blanche`).toBe(true)
          expect(entry && typeof entry === 'object', `${view}.data_quality.${field}`).toBe(true)
          const record = entry as Record<string, unknown>
          for (const key of Object.keys(record)) {
            expect(DATA_QUALITY_PUBLIC_KEYS.has(key), `${label} ${view}.data_quality.${field}.${key} publié`).toBe(true)
          }
          expect(DATA_QUALITY_STATUS_SET.has(String(record.status)), `${field}.status`).toBe(true)
          expect(DATA_QUALITY_SOURCE_SET.has(String(record.source)), `${field}.source`).toBe(true)
        }
      }
      if ('mode' in row) {
        expect(['standard_production', 'grouped_production']).toContain(row.mode)
      }
    }
  }

  // Aucun produit inactif, aucune option orpheline, aucune famille non vérifiée.
  const inactive = await rest('studio_products?select=id&is_active=eq.false&limit=1', token)
  expect(inactive.status).toBe(200)
  expect(rows(inactive), `${label} studio_products montre un produit inactif`).toHaveLength(0)
  const visible = new Set(rows(await rest('studio_products?select=id&limit=1000', token)).map((row) => row.id))
  for (const option of rows(await rest('studio_fulfillment_options_public?select=product_id&limit=1000', token))) {
    expect(visible.has(option.product_id), `${label} option publique d'un produit non visible ${String(option.product_id)}`).toBe(true)
  }
  const families = rows(await rest('studio_model_families_public?select=id,status&limit=1000', token))
  for (const family of families) expect(family.status).toBe('verified')
  const verifiedIds = new Set(families.map((family) => family.id))
  for (const profile of rows(await rest('studio_product_profiles_public?select=model_family_id&limit=1000', token))) {
    if (profile.model_family_id !== null) {
      expect(verifiedIds.has(profile.model_family_id), `${label} famille non vérifiée publiée`).toBe(true)
    }
  }

  const products = await rest('studio_products?select=id&is_active=eq.true', token)
  expect(products.status).toBe(200)
  expect(rows(products).length, `${label} studio_products vide`).toBeGreaterThanOrEqual(expectedMin)
}

describe.skipIf(!configured)('accès réel Studio : rôle anon', () => {
  it('lit les surfaces publiques, exactement les colonnes publiques', async () => {
    await expectPublicSurfacesMinimal(anonKey as string, 'anon')
  })

  it('ne lit ni notes, note, created_by, updated_by, confirmed_by, ni les tables internes', async () => {
    await expectInternalColumnsUnreadable(anonKey as string, 'anon', false)
  })
})

describe.skipIf(!hasBuyer)('accès réel Studio : authenticated NON admin', () => {
  it('lit les surfaces publiques et aucune colonne interne (tables internes refusées ou vides)', async () => {
    const token = await signIn(buyerEmail as string, buyerPassword as string)
    await expectPublicSurfacesMinimal(token, 'buyer')
    await expectInternalColumnsUnreadable(token, 'buyer', true)
  })
})
