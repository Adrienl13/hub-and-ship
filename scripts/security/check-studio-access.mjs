#!/usr/bin/env node
/* global console, process, fetch */
// Lot 1 Studio — contrôle des surfaces publiques Studio en conditions réelles
// (anon, puis compte de TEST non admin si fourni). Aucune écriture.
// Échec (code 1) si :
// - une vue publique devient illisible (401/403/vide) pour un rôle public ;
// - une colonne interne (notes, note, created_by, updated_by, confirmed_by)
//   ou de coût est lisible sur une surface publique, ou via une table
//   interne studio_* par anon (buyer : refus ou zéro ligne, RLS is_admin()) ;
// - select=* sur une vue publique renvoie autre chose que la liste blanche ;
// - data_quality publie autre chose que status / source / updatedAt ;
// - product_pricing_inputs devient lisible.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… [TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=…]
//   [EXPECTED_MIN_ACTIVE_PRODUCTS=100] node scripts/security/check-studio-access.mjs
//
// Listes dupliquées volontairement (script sans TypeScript) ; la parité avec
// src/lib/studio/repository.ts est vérifiée par tests/security.

const INTERNAL_COST_COLUMNS = ['fob_usd', 'qty_per_container', 'is_loss_leader', 'table_price_modifier_rate']
const STUDIO_INTERNAL_COLUMNS = ['notes', 'note', 'created_by', 'updated_by', 'confirmed_by']
const PRODUCT_COLUMNS = [
  'id', 'sku', 'category', 'name', 'description', 'dim_length_cm', 'dim_width_cm', 'dim_height_cm',
  'cbm_per_unit', 'weight_kg', 'moq_units', 'base_price_ht', 'retail_price_ref', 'eco_contribution',
  'main_image_url', 'gallery_urls', 'features', 'fire_rating', 'is_active', 'sort_order', 'created_at',
  'updated_at', 'table_shape', 'compatible_top_shapes', 'visibility',
]
const PROFILE_COLUMNS = ['studio_role', 'seat_kind', 'material', 'model_family_id', 'visual_traits', 'data_quality']
const PUBLIC_SURFACES = [
  { view: 'studio_products', columns: [...PRODUCT_COLUMNS, ...PROFILE_COLUMNS] },
  { view: 'studio_product_profiles_public', columns: ['product_id', ...PROFILE_COLUMNS] },
  {
    view: 'studio_fulfillment_options_public',
    columns: ['id', 'product_id', 'variant_id', 'mode', 'min_quantity', 'max_quantity', 'price_basis', 'source', 'is_active', 'is_confirmed', 'available_from', 'expires_at'],
  },
  { view: 'studio_model_families_public', columns: ['id', 'label', 'status'] },
]
const INTERNAL_TABLES = ['studio_model_families', 'studio_product_profiles', 'studio_fulfillment_options']
const DATA_QUALITY_PUBLIC_KEYS = new Set(['status', 'source', 'updatedAt'])

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

const rows = (r) => (Array.isArray(r.body) ? r.body : [])
const pgCode = (r) => (r.body && typeof r.body === 'object' && !Array.isArray(r.body) ? r.body.code : undefined)
const isDenied = (r) => r.status === 401 || r.status === 403 || pgCode(r) === '42501'
const sameSet = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',')

function dataQualityLeak(row) {
  const quality = row.data_quality
  if (!quality || typeof quality !== 'object') return null
  for (const [field, entry] of Object.entries(quality)) {
    if (!entry || typeof entry !== 'object') return `${field} n'est pas un objet`
    for (const key of Object.keys(entry)) {
      if (!DATA_QUALITY_PUBLIC_KEYS.has(key)) return `${field}.${key}`
    }
  }
  return null
}

async function checkRole(role, token, allowEmptyInternal) {
  // 1. Surfaces publiques : lisibles, liste blanche stricte.
  for (const { view, columns } of PUBLIC_SURFACES) {
    const explicit = await rest(`${view}?select=${columns.join(',')}&limit=5`, token)
    record(role, `${view} lisible (colonnes explicites)`, explicit.status === 200, `HTTP ${explicit.status}`)
    const star = await rest(`${view}?select=*&limit=5`, token)
    const starRows = rows(star)
    const extra = starRows.flatMap((row) => Object.keys(row).filter((key) => !columns.includes(key)))
    record(role, `${view} select=* = exactement la liste blanche`, star.status === 200 && starRows.every((row) => sameSet(Object.keys(row), columns)), extra.length ? `colonnes inattendues : ${[...new Set(extra)].join(', ')}` : `HTTP ${star.status}, ${starRows.length} lignes`)
    const leak = starRows.map(dataQualityLeak).find(Boolean)
    if (columns.includes('data_quality')) {
      record(role, `${view}.data_quality projetée (status/source/updatedAt)`, !leak, leak ?? '')
    }
    if (columns.includes('is_confirmed')) {
      record(role, `${view}.is_confirmed booléen`, starRows.every((row) => typeof row.is_confirmed === 'boolean'))
    }
    for (const column of [...STUDIO_INTERNAL_COLUMNS, ...INTERNAL_COST_COLUMNS]) {
      const r = await rest(`${view}?select=${column}&limit=1`, token)
      record(role, `${view}.${column} inexistante`, r.status !== 200, `HTTP ${r.status}`)
    }
  }
  const products = await rest('studio_products?select=id&is_active=eq.true', token)
  record(role, `studio_products ≥ ${expectedMin} produit(s) actif(s)`, products.status === 200 && rows(products).length >= expectedMin, `HTTP ${products.status}, ${rows(products).length} lignes`)

  // 2. Tables internes : anon refusé ; buyer refusé ou zéro ligne (RLS).
  for (const table of INTERNAL_TABLES) {
    const star = await rest(`${table}?select=*&limit=1`, token)
    const starOk = isDenied(star) || (allowEmptyInternal && star.status === 200 && rows(star).length === 0)
    record(role, `${table} select=* ${allowEmptyInternal ? 'refusé ou vide' : 'refusé'}`, starOk, `HTTP ${star.status}`)
    for (const column of STUDIO_INTERNAL_COLUMNS) {
      const r = await rest(`${table}?select=${column}&limit=1`, token)
      const ok = isDenied(r) || pgCode(r) === '42703' || (allowEmptyInternal && r.status === 200 && rows(r).length === 0)
      record(role, `${table}.${column} illisible`, ok && !rows(r).some((row) => column in row), `HTTP ${r.status}`)
    }
  }

  // 3. Coûts internes toujours hors de portée.
  const inputs = await rest('product_pricing_inputs?select=*&limit=1', token)
  record(role, 'product_pricing_inputs refusé ou vide', isDenied(inputs) || rows(inputs).length === 0, `HTTP ${inputs.status}`)
}

async function main() {
  await checkRole('anon', anonKey, false)
  if (process.env.TEST_BUYER_EMAIL && process.env.TEST_BUYER_PASSWORD) {
    const token = await signIn(process.env.TEST_BUYER_EMAIL, process.env.TEST_BUYER_PASSWORD)
    await checkRole('buyer', token, true)
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
