#!/usr/bin/env node
/* global console, process, fetch */
// Lot 1 Studio — contrôle de la vue studio_products et des tables studio_*
// en conditions réelles (anon, puis compte de TEST non admin si fourni).
// Aucune écriture. Échec (code 1) si :
// - la vue devient illisible (401/403/vide) pour un rôle public ;
// - une colonne interne (coût) apparaît dans la vue ;
// - un rôle public lit une information de coût par studio_products ;
// - les tables descriptives studio_* ne sont plus lisibles.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… [TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=…]
//   [EXPECTED_MIN_ACTIVE_PRODUCTS=100] node scripts/security/check-studio-access.mjs

const INTERNAL_COST_COLUMNS = ['fob_usd', 'qty_per_container', 'is_loss_leader', 'table_price_modifier_rate']
const STUDIO_COLUMNS = [
  'id', 'sku', 'category', 'name', 'description', 'dim_length_cm', 'dim_width_cm', 'dim_height_cm',
  'cbm_per_unit', 'weight_kg', 'moq_units', 'base_price_ht', 'retail_price_ref', 'eco_contribution',
  'main_image_url', 'gallery_urls', 'features', 'fire_rating', 'is_active', 'sort_order', 'created_at',
  'updated_at', 'table_shape', 'compatible_top_shapes', 'visibility',
  'studio_role', 'seat_kind', 'material', 'model_family_id', 'visual_traits', 'data_quality',
]

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const expectedMin = Number(process.env.EXPECTED_MIN_ACTIVE_PRODUCTS ?? '1')

if (!url || !anonKey) {
  console.error('SUPABASE_URL et SUPABASE_ANON_KEY (ou VITE_*) sont requis.')
  process.exit(2)
}

const lines = []
const failures = []
const record = (role, check, ok, detail = '') => {
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

async function signIn(email, password) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await response.json()
  if (!response.ok || !json.access_token) throw new Error(`connexion impossible pour ${email}`)
  return json.access_token
}

const count = (r) => (Array.isArray(r.body) ? r.body.length : -1)
const leaks = (r) =>
  Array.isArray(r.body) && r.body.some((row) => INTERNAL_COST_COLUMNS.some((c) => c in row))

async function checkRole(role, token) {
  const explicit = await rest(`studio_products?select=${STUDIO_COLUMNS.join(',')}&is_active=eq.true`, token)
  record(role, 'studio_products lisible (colonnes explicites)', explicit.status === 200 && count(explicit) >= expectedMin, `HTTP ${explicit.status}, ${count(explicit)} lignes`)
  const star = await rest('studio_products?select=*&limit=1', token)
  record(role, 'studio_products select=* sans colonne de coût', star.status === 200 && !leaks(star), `HTTP ${star.status}`)
  for (const column of INTERNAL_COST_COLUMNS) {
    const r = await rest(`studio_products?select=${column}&limit=1`, token)
    record(role, `studio_products.${column} inexistante`, r.status !== 200, `HTTP ${r.status}`)
  }
  const profiles = await rest('studio_product_profiles?select=product_id,studio_role&limit=1', token)
  record(role, 'studio_product_profiles lisible', profiles.status === 200, `HTTP ${profiles.status}`)
  const families = await rest('studio_model_families?select=id,status&limit=1', token)
  record(role, 'studio_model_families lisible', families.status === 200, `HTTP ${families.status}`)
  const options = await rest('studio_fulfillment_options?select=id,mode&limit=1', token)
  record(role, 'studio_fulfillment_options lisible', options.status === 200, `HTTP ${options.status}`)
  const inputs = await rest('product_pricing_inputs?select=*&limit=1', token)
  record(role, 'product_pricing_inputs refusé ou vide', inputs.status === 401 || inputs.status === 403 || count(inputs) === 0, `HTTP ${inputs.status}`)
}

async function main() {
  await checkRole('anon', anonKey)
  if (process.env.TEST_BUYER_EMAIL && process.env.TEST_BUYER_PASSWORD) {
    const token = await signIn(process.env.TEST_BUYER_EMAIL, process.env.TEST_BUYER_PASSWORD)
    await checkRole('buyer', token)
  } else {
    lines.push('SKIP [buyer] TEST_BUYER_EMAIL / TEST_BUYER_PASSWORD absents')
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
