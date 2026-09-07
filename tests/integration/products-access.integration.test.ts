// @vitest-environment node
//
// Lot 0.5 Studio — matrice d'accès RÉELLE sur une base Supabase (locale via
// `supabase start`, staging, ou production avec des comptes de TEST).
//
// Le test est ignoré tant que les variables ne sont pas présentes, pour que
// `bun run test` reste déterministe sans base :
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY          (obligatoires)
//   TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD               (compte NON admin)
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD               (facultatif)
//   EXPECTED_MIN_ACTIVE_PRODUCTS                        (défaut 1)
// Jamais de vrai compte client : voir docs/COMPTES_TEST.md. Aucun secret
// n'est écrit dans le repo.

import { describe, expect, it } from 'vitest'

import {
  INTERNAL_PRODUCT_COST_COLUMNS,
  PUBLIC_PRODUCT_COLUMNS,
  PUBLIC_PRODUCT_SELECT,
} from '../../src/lib/catalogue/product-columns'

const url = process.env.SUPABASE_TEST_URL?.replace(/\/$/, '')
const anonKey = process.env.SUPABASE_TEST_ANON_KEY
const buyerEmail = process.env.TEST_BUYER_EMAIL
const buyerPassword = process.env.TEST_BUYER_PASSWORD
const adminEmail = process.env.TEST_ADMIN_EMAIL
const adminPassword = process.env.TEST_ADMIN_PASSWORD
const expectedMin = Number(process.env.EXPECTED_MIN_ACTIVE_PRODUCTS ?? '1')

const configured = Boolean(url && anonKey)
const hasBuyer = configured && Boolean(buyerEmail && buyerPassword)
const hasAdmin = configured && Boolean(adminEmail && adminPassword)

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
    // corps non JSON (rare) : on garde le texte
  }
  return { status: response.status, body }
}

async function rpc(name: string, token: string): Promise<RestResult> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey as string,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // idem
  }
  return { status: response.status, body }
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey as string, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = (await response.json()) as { access_token?: string; error?: string }
  if (!response.ok || !json.access_token) {
    throw new Error(`Connexion impossible pour ${email} : ${response.status}`)
  }
  return json.access_token
}

function isDenied(result: RestResult): boolean {
  if (result.status === 401 || result.status === 403) return true
  const body = result.body as { code?: string } | null
  return Boolean(body && typeof body === 'object' && body.code === '42501')
}

function rowCount(result: RestResult): number {
  return Array.isArray(result.body) ? result.body.length : -1
}

function leaksCost(result: RestResult): boolean {
  if (!Array.isArray(result.body)) return false
  return result.body.some((row) =>
    INTERNAL_PRODUCT_COST_COLUMNS.some((column) =>
      Object.prototype.hasOwnProperty.call(row, column),
    ),
  )
}

async function expectCatalogueReadable(token: string, label: string) {
  const view = await rest('products_public?select=id,sku,name', token)
  expect(view.status, `${label} products_public`).toBe(200)
  expect(rowCount(view), `${label} products_public vide`).toBeGreaterThanOrEqual(
    expectedMin,
  )
  expect(leaksCost(view)).toBe(false)

  const explicit = await rest(`products?select=${PUBLIC_PRODUCT_SELECT.replace(/\s/g, '')}&limit=1`, token)
  expect(explicit.status, `${label} products colonnes publiques`).toBe(200)

  const variants = await rest('product_variants?select=id&limit=1', token)
  expect(variants.status, `${label} product_variants`).toBe(200)

  const stock = await rest('stock_lines?select=id&limit=1', token)
  expect(stock.status, `${label} stock_lines`).toBe(200)

  const rules = await rpc('get_public_pricing_rules', token)
  expect(rules.status, `${label} get_public_pricing_rules`).toBe(200)
}

async function expectCostsHidden(token: string, label: string) {
  const star = await rest('products?select=*&limit=1', token)
  expect(isDenied(star), `${label} products select=* doit être refusé`).toBe(true)

  for (const column of INTERNAL_PRODUCT_COST_COLUMNS) {
    const direct = await rest(`products?select=${column}&limit=1`, token)
    expect(isDenied(direct), `${label} products.${column} doit être refusé`).toBe(true)
  }

  // Tables de coût / marges : refusées ou vides (RLS admin), jamais des lignes.
  for (const table of [
    'product_pricing_inputs',
    'product_pricing_readiness',
    'pricing_parameters',
    'channel_price_overrides',
    'channel_coefficients',
  ]) {
    const result = await rest(`${table}?select=*&limit=1`, token)
    const ok = isDenied(result) || rowCount(result) === 0
    expect(ok, `${label} ${table} renvoie des lignes`).toBe(true)
  }
}

describe.skipIf(!configured)('accès réel : rôle anon', () => {
  it('lit le catalogue public', async () => {
    await expectCatalogueReadable(anonKey as string, 'anon')
  })

  it('ne lit aucun coût interne', async () => {
    await expectCostsHidden(anonKey as string, 'anon')
  })

  it('la liste publique couvre toutes les colonnes attendues', async () => {
    const view = await rest('products_public?select=*&limit=1', anonKey as string)
    expect(view.status).toBe(200)
    const row = (view.body as ReadonlyArray<Record<string, unknown>>)[0]
    if (row) {
      for (const column of PUBLIC_PRODUCT_COLUMNS) {
        expect(Object.keys(row), `colonne ${column}`).toContain(column)
      }
      expect(leaksCost(view)).toBe(false)
    }
  })
})

describe.skipIf(!hasBuyer)('accès réel : authenticated NON admin', () => {
  it("n'est pas admin, lit le catalogue, ne lit aucun coût", async () => {
    const token = await signIn(buyerEmail as string, buyerPassword as string)
    const admin = await rpc('is_admin', token)
    expect(admin.status).toBe(200)
    expect(admin.body).toBe(false)
    await expectCatalogueReadable(token, 'buyer')
    await expectCostsHidden(token, 'buyer')
  })
})

describe.skipIf(!hasAdmin)('accès réel : admin (chemins autorisés préservés)', () => {
  it('est admin et lit produits, coûts et readiness par les chemins admin', async () => {
    const token = await signIn(adminEmail as string, adminPassword as string)
    const admin = await rpc('is_admin', token)
    expect(admin.body).toBe(true)

    const explicit = await rest(
      `products?select=${PUBLIC_PRODUCT_SELECT.replace(/\s/g, '')},product_variants(id)&limit=5`,
      token,
    )
    expect(explicit.status).toBe(200)

    const inputs = await rest('product_pricing_inputs?select=product_id,fob_usd&limit=1', token)
    expect(inputs.status).toBe(200)

    const readiness = await rest('product_pricing_readiness?select=id,sku&limit=1', token)
    expect(readiness.status).toBe(200)

    // Même l'admin passe par des colonnes explicites : `*` reste refusé, ce
    // qui est voulu (rôle Postgres authenticated, migration 38).
    const star = await rest('products?select=*&limit=1', token)
    expect(isDenied(star)).toBe(true)
  })
})
