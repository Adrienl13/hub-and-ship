#!/usr/bin/env node
/* global console, process, fetch */
// Lot 0.5 Studio — contrôle post-migration de l'exposition des coûts et de
// la santé du catalogue public, exécutable contre n'importe quel projet
// Supabase (local, staging, production) SANS dépendance.
//
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=… \
//   [TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=…] \
//   [TEST_ADMIN_EMAIL=… TEST_ADMIN_PASSWORD=…] \
//   [EXPECTED_MIN_ACTIVE_PRODUCTS=100] \
//   node scripts/security/check-cost-exposure.mjs
//
// Code de sortie 1 dès qu'une assertion échoue :
// - anon ou authenticated non admin lit une colonne de coût ;
// - anon ou authenticated non admin NE lit PLUS le catalogue (régression du
//   07/09 : products_public vide / 401) ;
// - admin ne lit plus les chemins autorisés.
// Les identifiants viennent uniquement de l'environnement (jamais du repo)
// et doivent être des comptes de TEST (docs/COMPTES_TEST.md).

const INTERNAL_COST_COLUMNS = [
  'fob_usd',
  'qty_per_container',
  'is_loss_leader',
  'table_price_modifier_rate',
]
const PUBLIC_COLUMNS =
  'id,sku,category,name,description,dim_length_cm,dim_width_cm,dim_height_cm,cbm_per_unit,weight_kg,moq_units,base_price_ht,retail_price_ref,eco_contribution,main_image_url,gallery_urls,features,fire_rating,is_active,sort_order,created_at,updated_at,table_shape,compatible_top_shapes,visibility'

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const expectedMin = Number(process.env.EXPECTED_MIN_ACTIVE_PRODUCTS ?? '1')

if (!url || !anonKey) {
  console.error('SUPABASE_URL et SUPABASE_ANON_KEY (ou VITE_*) sont requis.')
  process.exit(2)
}

const failures = []
const lines = []

function record(role, check, ok, detail = '') {
  lines.push(`${ok ? 'OK  ' : 'FAIL'} [${role}] ${check}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(`[${role}] ${check}`)
}

async function rest(path, token) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    /* texte brut */
  }
  return { status: response.status, body }
}

async function rpc(name, token) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    /* texte brut */
  }
  return { status: response.status, body }
}

async function signIn(email, password) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await response.json()
  if (!response.ok || !json.access_token) {
    throw new Error(`connexion impossible pour ${email} (${response.status})`)
  }
  return json.access_token
}

const denied = (r) => r.status === 401 || r.status === 403 || (r.body && r.body.code === '42501')
const count = (r) => (Array.isArray(r.body) ? r.body.length : -1)
const leaks = (r) =>
  Array.isArray(r.body) && r.body.some((row) => INTERNAL_COST_COLUMNS.some((c) => c in row))

async function checkCatalogue(role, token) {
  const view = await rest('products_public?select=id,sku,name', token)
  record(role, 'products_public lisible', view.status === 200 && count(view) >= expectedMin, `HTTP ${view.status}, ${count(view)} lignes`)
  record(role, 'products_public sans colonne de coût', !leaks(view))
  const explicit = await rest(`products?select=${PUBLIC_COLUMNS}&limit=1`, token)
  record(role, 'products colonnes publiques lisibles', explicit.status === 200, `HTTP ${explicit.status}`)
  const variants = await rest('product_variants?select=id&limit=1', token)
  record(role, 'product_variants lisible', variants.status === 200, `HTTP ${variants.status}`)
  const stock = await rest('stock_lines?select=id&limit=1', token)
  record(role, 'stock_lines lisible', stock.status === 200, `HTTP ${stock.status}`)
  const rules = await rpc('get_public_pricing_rules', token)
  record(role, 'get_public_pricing_rules', rules.status === 200, `HTTP ${rules.status}`)
}

async function checkCostsHidden(role, token) {
  const star = await rest('products?select=*&limit=1', token)
  record(role, 'products select=* refusé', denied(star), `HTTP ${star.status}`)
  for (const column of INTERNAL_COST_COLUMNS) {
    const r = await rest(`products?select=${column}&limit=1`, token)
    record(role, `products.${column} refusé`, denied(r), `HTTP ${r.status}`)
  }
  for (const table of ['product_pricing_inputs', 'product_pricing_readiness', 'pricing_parameters', 'channel_price_overrides', 'channel_coefficients']) {
    const r = await rest(`${table}?select=*&limit=1`, token)
    record(role, `${table} refusé ou vide`, denied(r) || count(r) === 0, `HTTP ${r.status}, ${count(r)} lignes`)
  }
}

async function main() {
  await checkCatalogue('anon', anonKey)
  await checkCostsHidden('anon', anonKey)

  if (process.env.TEST_BUYER_EMAIL && process.env.TEST_BUYER_PASSWORD) {
    const token = await signIn(process.env.TEST_BUYER_EMAIL, process.env.TEST_BUYER_PASSWORD)
    const admin = await rpc('is_admin', token)
    record('buyer', 'is_admin() = false', admin.status === 200 && admin.body === false, String(admin.body))
    await checkCatalogue('buyer', token)
    await checkCostsHidden('buyer', token)
  } else {
    lines.push('SKIP [buyer] TEST_BUYER_EMAIL / TEST_BUYER_PASSWORD absents — contrôle authenticated non admin non exécuté')
  }

  if (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) {
    const token = await signIn(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD)
    const admin = await rpc('is_admin', token)
    record('admin', 'is_admin() = true', admin.body === true, String(admin.body))
    const explicit = await rest(`products?select=${PUBLIC_COLUMNS},product_variants(id)&limit=5`, token)
    record('admin', 'products (colonnes explicites + variantes)', explicit.status === 200, `HTTP ${explicit.status}`)
    const inputs = await rest('product_pricing_inputs?select=product_id,fob_usd&limit=1', token)
    record('admin', 'product_pricing_inputs lisible', inputs.status === 200, `HTTP ${inputs.status}`)
    const readiness = await rest('product_pricing_readiness?select=id,sku&limit=1', token)
    record('admin', 'product_pricing_readiness lisible', readiness.status === 200, `HTTP ${readiness.status}`)
  } else {
    lines.push('SKIP [admin] TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD absents — contrôle admin non exécuté')
  }

  console.log(lines.join('\n'))
  if (failures.length > 0) {
    console.error(`\n${failures.length} contrôle(s) en échec.`)
    process.exit(1)
  }
  console.log('\nTous les contrôles exécutés sont passés.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
