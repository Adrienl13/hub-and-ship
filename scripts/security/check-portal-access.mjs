#!/usr/bin/env node
/* global console, process, fetch, Buffer */
// Contrôle des portails en conditions réelles, après mise en ligne : l'admin
// n'est atteignable que par un admin, les données d'un client ne sortent pas
// vers anon, les fonctions admin refusent un compte ordinaire, le site sert
// ses en-têtes de sécurité et l'ancien domaine redirige vers le nouveau.
//
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=… \
//   [SITE_URL=https://terrassea.com] [LEGACY_URL=https://prosimport.com] \
//   [TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=…] \
//   node scripts/security/check-portal-access.mjs
//
// Sans compte de test : lecture seule, plus UNE insertion conçue pour être
// refusée par la RLS — et rattrapée par la clé étrangère si elle ne l'était
// pas, donc rien ne peut persister. Avec TEST_BUYER_* (un compte de TEST,
// jamais un vrai client : docs/COMPTES_TEST.md), deux sondes d'escalade
// tentent de passer ce compte admin. Si l'une passait, ce serait la faille
// recherchée : le script remet la valeur en place et sort en échec.
//
// Code de sortie 1 dès qu'un contrôle échoue, 2 si la configuration manque.
// Listes dupliquées volontairement (script sans TypeScript) ; la parité des
// constantes est vérifiée par tests/security/portal-access-script.test.ts.

import { pathToFileURL } from 'node:url'

/** Parité : src/lib/seo.ts (SITE_URL) et src/lib/indexnow.ts (INDEXNOW_KEY). */
export const DEFAULT_SITE_URL = 'https://terrassea.com'
export const DEFAULT_LEGACY_URL = 'https://prosimport.com'
export const INDEXNOW_KEY = 'dad4d7620f7ce9f465ba22a0f9a13421'

/** Tables qui ne doivent JAMAIS renvoyer une ligne à un visiteur anonyme. */
export const PRIVATE_TABLES = [
  'users_profile',
  'professionals',
  'companies',
  'reservations',
  'reservation_items',
  'invoices',
  'partner_applications',
  'partner_codes',
  'commission_ledger',
  'container_notify_leads',
  'security_events',
  'stock_requests',
  'report_access_requests',
  'quality_reports',
]

/** RPC réservées à l'admin : refus attendu pour anon ET pour un compte ordinaire. */
export const ADMIN_RPCS = [
  'admin_list_notify_leads',
  'admin_list_referral_redemptions',
  'get_referral_settings',
  'check_pricing_control',
  'admin_preview_reprice',
]

/** Compartiments de stockage privés : la liste doit rester vide pour anon. */
export const PRIVATE_BUCKETS = ['reservation-quotes', 'quality-reports']

const ADMIN_ROLES = ['admin', 'super_admin']

// Toutes les colonnes obligatoires sont remplies : seule la RLS peut refuser
// cette ligne (id ≠ auth.uid(), nul pour anon). Si la RLS laissait passer,
// la clé étrangère vers auth.users rejetterait cet identifiant nul — le
// code d'erreur dirait alors 23503 au lieu de 42501, et c'est précisément ce
// que le contrôle signale.
const PROFESSIONAL_PROBE = {
  id: '00000000-0000-0000-0000-000000000000',
  company_name: 'Sonde sécurité',
  contact_name: 'Sonde sécurité',
  email: 'sonde@invalid.example',
  phone: '0000000000',
  siret: '00000000000000',
  is_admin: true,
}

/** Seul un refus de permission prouve le blocage ; une validation 400 ne prouve rien. */
export function rlsDenied(status, body) {
  return status >= 400 && body?.code === '42501'
}

const denied = (r) =>
  r.status === 401 || r.status === 403 || rlsDenied(r.status, r.body)
const rows = (r) => (Array.isArray(r.body) ? r.body.length : -1)

function jwtSubject(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    )
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export class ConfigError extends Error {}

/**
 * Exécute tous les contrôles et rend { lines, failures } sans toucher à
 * process : c'est ce qui permet de tester le script avec un `fetch` factice.
 */
export async function runPortalChecks({
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(
    /\/$/,
    '',
  )
  const anonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl || !anonKey) {
    throw new ConfigError(
      'SUPABASE_URL et SUPABASE_ANON_KEY (ou VITE_*) sont requis.',
    )
  }
  const siteUrl = (env.SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '')
  const legacyUrl = (env.LEGACY_URL ?? DEFAULT_LEGACY_URL).replace(/\/$/, '')

  const lines = []
  const failures = []
  function record(role, check, ok, detail = '') {
    lines.push(
      `${ok ? 'OK  ' : 'FAIL'} [${role}] ${check}${detail ? ` — ${detail}` : ''}`,
    )
    if (!ok) failures.push(`[${role}] ${check}`)
  }

  async function call(url, init = {}) {
    const response = await fetchImpl(url, init)
    const text = await response.text()
    let body = text
    try {
      body = JSON.parse(text)
    } catch {
      /* texte brut */
    }
    return { status: response.status, body, headers: response.headers }
  }

  function supabaseHeaders(token, extra = {}) {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...extra,
    }
  }

  const rest = (path, token, init = {}) =>
    call(`${supabaseUrl}/rest/v1/${path}`, {
      method: init.method ?? 'GET',
      headers: supabaseHeaders(token, {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      }),
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    })

  const rpc = (name, token) =>
    call(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: supabaseHeaders(token, { 'Content-Type': 'application/json' }),
      body: '{}',
    })

  async function signIn(email, password) {
    const r = await call(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (r.status !== 200 || !r.body?.access_token) {
      throw new Error(`connexion impossible pour ${email} (HTTP ${r.status})`)
    }
    return r.body.access_token
  }

  // ------------------------------------------------------------------ anon
  const anonAdmin = await rpc('is_admin', anonKey)
  record(
    'anon',
    'is_admin() = false',
    anonAdmin.status === 200 && anonAdmin.body === false,
    `HTTP ${anonAdmin.status}, ${JSON.stringify(anonAdmin.body)}`,
  )
  for (const table of PRIVATE_TABLES) {
    const r = await rest(`${table}?select=*&limit=5`, anonKey)
    record(
      'anon',
      `${table} refusé ou vide`,
      denied(r) || rows(r) === 0,
      `HTTP ${r.status}, ${rows(r)} ligne(s)`,
    )
  }
  for (const name of ADMIN_RPCS) {
    const r = await rpc(name, anonKey)
    record('anon', `rpc ${name} refusé`, denied(r), `HTTP ${r.status}`)
  }
  const probe = await rest('professionals', anonKey, {
    method: 'POST',
    body: PROFESSIONAL_PROBE,
    prefer: 'return=minimal',
  })
  record(
    'anon',
    'insert professionals (is_admin = true) bloqué par la RLS',
    rlsDenied(probe.status, probe.body),
    `HTTP ${probe.status}, code ${probe.body?.code ?? '—'}`,
  )

  // --------------------------------------------------------------- storage
  for (const bucket of PRIVATE_BUCKETS) {
    const list = await call(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: supabaseHeaders(anonKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: '', limit: 5 }),
    })
    record(
      'storage',
      `${bucket} : liste vide ou refusée pour anon`,
      list.status >= 400 || rows(list) === 0,
      `HTTP ${list.status}, ${rows(list)} objet(s)`,
    )
    const pub = await call(
      `${supabaseUrl}/storage/v1/object/public/${bucket}/sonde.pdf`,
    )
    record(
      'storage',
      `${bucket} : pas d'accès public direct`,
      pub.status !== 200,
      `HTTP ${pub.status}`,
    )
  }

  // ---------------------------------------------------------------- buyer
  if (env.TEST_BUYER_EMAIL && env.TEST_BUYER_PASSWORD) {
    const token = await signIn(env.TEST_BUYER_EMAIL, env.TEST_BUYER_PASSWORD)
    const sub = jwtSubject(token)
    record('buyer', 'jeton porteur d’un sub', Boolean(sub))

    const admin = await rpc('is_admin', token)
    record(
      'buyer',
      'is_admin() = false',
      admin.status === 200 && admin.body === false,
      `HTTP ${admin.status}, ${JSON.stringify(admin.body)}`,
    )

    const profile = await rest('users_profile?select=id,role', token)
    const own = rows(profile) === 1 ? profile.body[0] : null
    record(
      'buyer',
      'users_profile : uniquement son propre profil, non admin',
      profile.status === 200 &&
        own !== null &&
        own.id === sub &&
        !ADMIN_ROLES.includes(own.role),
      `HTTP ${profile.status}, ${rows(profile)} ligne(s), rôle ${own?.role ?? '—'}`,
    )

    const reservations = await rest(
      'reservations?select=id,user_id&limit=50',
      token,
    )
    record(
      'buyer',
      'reservations : aucune réservation d’un autre compte',
      reservations.status === 200 &&
        Array.isArray(reservations.body) &&
        reservations.body.every((r) => r.user_id === sub || r.user_id === null),
      `HTTP ${reservations.status}, ${rows(reservations)} ligne(s)`,
    )

    for (const name of ADMIN_RPCS) {
      const r = await rpc(name, token)
      record('buyer', `rpc ${name} refusé`, r.status >= 400, `HTTP ${r.status}`)
    }

    // Escalade A : se donner le rôle admin. La politique « Users update own
    // profile » n'accepte que role = 'buyer' en écriture.
    const roleProbe = await rest(`users_profile?id=eq.${sub}`, token, {
      method: 'PATCH',
      body: { role: 'admin' },
      prefer: 'return=representation',
    })
    const roleBlocked = rlsDenied(roleProbe.status, roleProbe.body)
    record(
      'buyer',
      'PATCH users_profile.role = admin bloqué par la RLS',
      roleBlocked,
      `HTTP ${roleProbe.status}, code ${roleProbe.body?.code ?? '—'}`,
    )
    if (!roleBlocked) {
      const revert = await rest(`users_profile?id=eq.${sub}`, token, {
        method: 'PATCH',
        body: { role: 'buyer' },
        prefer: 'return=minimal',
      })
      lines.push(`WARN [buyer] rôle remis à buyer — HTTP ${revert.status}`)
    }

    // Escalade B : is_admin sur sa fiche pro. Le trigger
    // guard_professionals_is_admin doit ignorer la valeur d'un non-admin ;
    // sans fiche pro, la requête ne touche aucune ligne.
    const proProbe = await rest(`professionals?id=eq.${sub}`, token, {
      method: 'PATCH',
      body: { is_admin: true },
      prefer: 'return=representation',
    })
    const proRows = rows(proProbe)
    const proNeutralised =
      proProbe.status >= 400
        ? rlsDenied(proProbe.status, proProbe.body)
        : proRows === 0 || proProbe.body.every((r) => r.is_admin === false)
    record(
      'buyer',
      'PATCH professionals.is_admin = true neutralisé',
      proNeutralised,
      proRows === 0
        ? 'aucune fiche pro'
        : `HTTP ${proProbe.status}, ${proRows} ligne(s)`,
    )
    if (!proNeutralised && proProbe.status < 400) {
      const revert = await rest(`professionals?id=eq.${sub}`, token, {
        method: 'PATCH',
        body: { is_admin: false },
        prefer: 'return=minimal',
      })
      lines.push(`WARN [buyer] is_admin remis à false — HTTP ${revert.status}`)
    }

    const after = await rpc('is_admin', token)
    record(
      'buyer',
      'is_admin() toujours false après les sondes',
      after.status === 200 && after.body === false,
      `HTTP ${after.status}, ${JSON.stringify(after.body)}`,
    )
  } else {
    lines.push(
      'SKIP [buyer] TEST_BUYER_EMAIL / TEST_BUYER_PASSWORD absents — contrôle du compte connecté non admin non exécuté',
    )
  }

  // ----------------------------------------------------------------- site
  const home = await call(`${siteUrl}/`, { redirect: 'manual' })
  record(
    'site',
    `${siteUrl} répond 200`,
    home.status === 200,
    `HTTP ${home.status}`,
  )
  record(
    'site',
    'Strict-Transport-Security présent',
    /max-age=\d+/.test(home.headers.get('strict-transport-security') ?? ''),
  )
  record(
    'site',
    'X-Frame-Options: DENY',
    (home.headers.get('x-frame-options') ?? '').toUpperCase() === 'DENY',
  )
  record(
    'site',
    'X-Content-Type-Options: nosniff',
    (home.headers.get('x-content-type-options') ?? '').toLowerCase() ===
      'nosniff',
  )

  if (legacyUrl && legacyUrl !== siteUrl) {
    const legacy = await call(`${legacyUrl}/catalogue`, { redirect: 'manual' })
    const location = legacy.headers.get('location') ?? ''
    record(
      'site',
      `${legacyUrl} redirige vers ${siteUrl}`,
      [301, 308].includes(legacy.status) && location.startsWith(`${siteUrl}/`),
      `HTTP ${legacy.status} → ${location || '—'}`,
    )
  }

  // /api/contact : l'origine est contrôlée AVANT la limite de débit, cette
  // sonde ne consomme donc pas le quota anti-spam de ton adresse IP.
  const contactGet = await call(`${siteUrl}/api/contact`)
  record(
    'site',
    '/api/contact refuse GET (405)',
    contactGet.status === 405,
    `HTTP ${contactGet.status}`,
  )
  const contactForeign = await call(`${siteUrl}/api/contact`, {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  record(
    'site',
    '/api/contact refuse une origine étrangère (403)',
    contactForeign.status === 403,
    `HTTP ${contactForeign.status}`,
  )

  // /api/auth/send-email : hook Supabase « Send Email ». La signature Standard
  // Webhooks est la seule porte : un appel non signé doit être refusé (401).
  // Tant que le secret n'est pas posé côté Worker, l'endpoint répond 503 —
  // sûr (rien ne part), mais l'email de connexion ne part pas non plus : la
  // ligne passe, avec la mention. Un 200 serait grave : n'importe qui pourrait
  // faire envoyer des emails de connexion au nom de Terrassea.
  const hookGet = await call(`${siteUrl}/api/auth/send-email`)
  record(
    'site',
    '/api/auth/send-email refuse GET (405)',
    hookGet.status === 405,
    `HTTP ${hookGet.status}`,
  )
  const hookUnsigned = await call(`${siteUrl}/api/auth/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  record(
    'site',
    '/api/auth/send-email refuse un appel non signé (401 ; 503 tant que le secret n’est pas posé)',
    hookUnsigned.status === 401 || hookUnsigned.status === 503,
    hookUnsigned.status === 503
      ? 'HTTP 503, secret SUPABASE_SEND_EMAIL_HOOK_SECRET absent côté Worker'
      : `HTTP ${hookUnsigned.status}`,
  )

  const key = await call(`${siteUrl}/${INDEXNOW_KEY}.txt`)
  record(
    'site',
    'clé IndexNow publiée',
    key.status === 200 && String(key.body).trim() === INDEXNOW_KEY,
    `HTTP ${key.status}`,
  )

  return { lines, failures }
}

async function main() {
  let result
  try {
    result = await runPortalChecks()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(error instanceof ConfigError ? 2 : 1)
  }
  console.log(result.lines.join('\n'))
  if (result.failures.length > 0) {
    console.error(`\n${result.failures.length} contrôle(s) en échec.`)
    process.exit(1)
  }
  console.log('\nTous les contrôles exécutés sont passés.')
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
