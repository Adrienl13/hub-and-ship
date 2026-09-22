// @vitest-environment node
// Le script `security:portals` tourne contre la production, sans réseau ici :
// on le fait tourner contre un `fetch` factice qui joue d'abord un site sain
// (aucun échec attendu), puis chaque faille qu'il doit savoir voir.

import { describe, expect, it } from 'vitest'

import { INDEXNOW_KEY as SRC_INDEXNOW_KEY } from '../../src/lib/indexnow'
import { SITE_URL as SRC_SITE_URL } from '../../src/lib/seo'
import {
  ADMIN_RPCS,
  ConfigError,
  DEFAULT_SITE_URL,
  INDEXNOW_KEY,
  PRIVATE_TABLES,
  rlsDenied,
  runPortalChecks,
  // @ts-expect-error Standalone JavaScript CLI helper.
} from '../../scripts/security/check-portal-access.mjs'

const SUPABASE = 'https://projet.supabase.co'
const SUB = '11111111-1111-4111-8111-111111111111'
const BUYER_TOKEN = `h.${Buffer.from(JSON.stringify({ sub: SUB })).toString('base64url')}.s`

const ENV = {
  SUPABASE_URL: SUPABASE,
  SUPABASE_ANON_KEY: 'anon-key',
  TEST_BUYER_EMAIL: 'direct.test@example.com',
  TEST_BUYER_PASSWORD: 'secret',
}

interface Call {
  readonly method: string
  readonly url: string
  readonly body: string | undefined
  readonly bearer: string | undefined
}

type Rule = (call: Call) => Response | undefined

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
const text = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
) => new Response(body, { status, headers })
// Un 204 (remise en place réussie) ne peut pas porter de corps.
const empty = (status: number) => new Response(null, { status })
const rls = () => json(403, { code: '42501', message: 'row-level security' })

/** Un site sain : chaque règle est essayée dans l'ordre, la première qui répond gagne. */
function saneRules(): Rule[] {
  return [
    ({ url, method }) =>
      url === `${SUPABASE}/auth/v1/token?grant_type=password` &&
      method === 'POST'
        ? json(200, { access_token: BUYER_TOKEN })
        : undefined,
    ({ url }) => (url.endsWith('/rpc/is_admin') ? json(200, false) : undefined),
    ({ url, bearer }) =>
      ADMIN_RPCS.some((n: string) => url.endsWith(`/rpc/${n}`))
        ? bearer === BUYER_TOKEN
          ? json(400, { code: 'P0001', message: 'admin only' })
          : json(403, { code: '42501' })
        : undefined,
    ({ url, method }) =>
      url === `${SUPABASE}/rest/v1/professionals` && method === 'POST'
        ? rls()
        : undefined,
    ({ url, method }) =>
      url.startsWith(`${SUPABASE}/rest/v1/users_profile?id=eq.`) &&
      method === 'PATCH'
        ? rls()
        : undefined,
    ({ url, method }) =>
      url.startsWith(`${SUPABASE}/rest/v1/professionals?id=eq.`) &&
      method === 'PATCH'
        ? json(200, [])
        : undefined,
    ({ url, bearer }) =>
      url === `${SUPABASE}/rest/v1/users_profile?select=id,role` &&
      bearer === BUYER_TOKEN
        ? json(200, [{ id: SUB, role: 'buyer' }])
        : undefined,
    ({ url, bearer }) =>
      url.startsWith(`${SUPABASE}/rest/v1/reservations?select=id,user_id`) &&
      bearer === BUYER_TOKEN
        ? json(200, [{ id: 'r1', user_id: SUB }])
        : undefined,
    ({ url }) =>
      url.startsWith(`${SUPABASE}/rest/v1/`) ? json(200, []) : undefined,
    ({ url }) =>
      url.startsWith(`${SUPABASE}/storage/v1/object/list/`)
        ? json(200, [])
        : undefined,
    ({ url }) =>
      url.startsWith(`${SUPABASE}/storage/v1/object/public/`)
        ? json(400, { error: 'Bucket not found' })
        : undefined,
    ({ url }) =>
      url === `${DEFAULT_SITE_URL}/`
        ? text(200, '<html>', {
            'strict-transport-security': 'max-age=31536000; includeSubDomains',
            'x-frame-options': 'DENY',
            'x-content-type-options': 'nosniff',
          })
        : undefined,
    ({ url }) =>
      url === 'https://prosimport.com/catalogue'
        ? text(308, '', { location: `${DEFAULT_SITE_URL}/catalogue` })
        : undefined,
    ({ url, method }) =>
      url === `${DEFAULT_SITE_URL}/api/contact`
        ? method === 'GET'
          ? json(405, { ok: false })
          : json(403, { ok: false, error: 'Forbidden origin' })
        : undefined,
    ({ url }) =>
      url === `${DEFAULT_SITE_URL}/${INDEXNOW_KEY}.txt`
        ? text(200, `${INDEXNOW_KEY}\n`)
        : undefined,
  ]
}

function fakeFetch(overrides: Rule[] = []) {
  const calls: Call[] = []
  const rules = [...overrides, ...saneRules()]
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    const call: Call = {
      method: init.method ?? 'GET',
      url,
      body: typeof init.body === 'string' ? init.body : undefined,
      bearer: headers.get('authorization')?.replace(/^Bearer /, ''),
    }
    calls.push(call)
    for (const rule of rules) {
      const response = rule(call)
      if (response) return response
    }
    throw new Error(`requête inattendue : ${call.method} ${url}`)
  }
  return { fetchImpl, calls }
}

describe('security:portals — site sain', () => {
  it('ne signale aucun échec et couvre anon, buyer, storage et site', async () => {
    const { fetchImpl, calls } = fakeFetch()
    const { lines, failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual([])
    for (const role of ['anon', 'buyer', 'storage', 'site']) {
      expect(
        lines.some((l: string) => l.startsWith(`OK   [${role}]`)),
        role,
      ).toBe(true)
    }
    // Rien d'autre qu'un PATCH ciblé sur son propre profil : pas d'écriture
    // qui pourrait persister ailleurs.
    const writes = calls.filter(
      (c) => c.method !== 'GET' && !c.url.includes('/rpc/'),
    )
    expect(writes.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${SUPABASE}/rest/v1/professionals`,
      `POST ${SUPABASE}/storage/v1/object/list/reservation-quotes`,
      `POST ${SUPABASE}/storage/v1/object/list/quality-reports`,
      `POST ${SUPABASE}/auth/v1/token?grant_type=password`,
      `PATCH ${SUPABASE}/rest/v1/users_profile?id=eq.${SUB}`,
      `PATCH ${SUPABASE}/rest/v1/professionals?id=eq.${SUB}`,
      `POST ${DEFAULT_SITE_URL}/api/contact`,
    ])
  })

  it('sans compte de test, saute le volet buyer sans échouer', async () => {
    const { fetchImpl } = fakeFetch()
    const env = { SUPABASE_URL: SUPABASE, SUPABASE_ANON_KEY: 'anon-key' }
    const { lines, failures } = await runPortalChecks({ fetchImpl, env })
    expect(failures).toEqual([])
    expect(lines.some((l: string) => l.startsWith('SKIP [buyer]'))).toBe(true)
    expect(lines.some((l: string) => l.includes('[buyer] is_admin'))).toBe(
      false,
    )
  })

  it('refuse de tourner sans configuration Supabase', async () => {
    const { fetchImpl } = fakeFetch()
    await expect(
      runPortalChecks({ fetchImpl, env: {} }),
    ).rejects.toBeInstanceOf(ConfigError)
  })
})

describe('security:portals — failles à détecter', () => {
  it('une table privée qui renvoie des lignes à anon', async () => {
    const { fetchImpl } = fakeFetch([
      ({ url, bearer }) =>
        url.startsWith(`${SUPABASE}/rest/v1/users_profile?select=*`) &&
        bearer === 'anon-key'
          ? json(200, [{ id: 'x', email: 'client@example.com' }])
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual(['[anon] users_profile refusé ou vide'])
  })

  it('une RPC admin qui répond à un compte ordinaire', async () => {
    const { fetchImpl } = fakeFetch([
      ({ url, bearer }) =>
        url.endsWith('/rpc/admin_list_notify_leads') && bearer === BUYER_TOKEN
          ? json(200, [{ email: 'lead@example.com' }])
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual(['[buyer] rpc admin_list_notify_leads refusé'])
  })

  it('un compte qui parvient à se donner le rôle admin : échec ET remise en place', async () => {
    const { fetchImpl, calls } = fakeFetch([
      ({ url, method, body }) =>
        url === `${SUPABASE}/rest/v1/users_profile?id=eq.${SUB}` &&
        method === 'PATCH' &&
        body?.includes('"admin"')
          ? json(200, [{ id: SUB, role: 'admin' }])
          : undefined,
      ({ url, method }) =>
        url === `${SUPABASE}/rest/v1/users_profile?id=eq.${SUB}` &&
        method === 'PATCH'
          ? empty(204)
          : undefined,
    ])
    const { lines, failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toContain(
      '[buyer] PATCH users_profile.role = admin bloqué par la RLS',
    )
    const revert = calls.find(
      (c) =>
        c.method === 'PATCH' &&
        c.url.includes('users_profile') &&
        c.body === '{"role":"buyer"}',
    )
    expect(revert).toBeDefined()
    expect(
      lines.some((l: string) =>
        l.startsWith('WARN [buyer] rôle remis à buyer'),
      ),
    ).toBe(true)
  })

  it('une fiche pro dont is_admin passe à true', async () => {
    const { fetchImpl, calls } = fakeFetch([
      ({ url, method, body }) =>
        url === `${SUPABASE}/rest/v1/professionals?id=eq.${SUB}` &&
        method === 'PATCH' &&
        body?.includes('true')
          ? json(200, [{ id: SUB, is_admin: true }])
          : undefined,
      ({ url, method }) =>
        url === `${SUPABASE}/rest/v1/professionals?id=eq.${SUB}` &&
        method === 'PATCH'
          ? empty(204)
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toContain(
      '[buyer] PATCH professionals.is_admin = true neutralisé',
    )
    expect(
      calls.some(
        (c) => c.method === 'PATCH' && c.body === '{"is_admin":false}',
      ),
    ).toBe(true)
  })

  it('une insertion anonyme rattrapée par la clé étrangère et non par la RLS', async () => {
    // 23503 veut dire que la ligne a franchi la RLS : c'est un échec, même
    // si rien n'a persisté.
    const { fetchImpl } = fakeFetch([
      ({ url, method }) =>
        url === `${SUPABASE}/rest/v1/professionals` && method === 'POST'
          ? json(409, { code: '23503', message: 'foreign key' })
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual([
      '[anon] insert professionals (is_admin = true) bloqué par la RLS',
    ])
  })

  it('un compartiment privé listable par anon', async () => {
    const { fetchImpl } = fakeFetch([
      ({ url }) =>
        url === `${SUPABASE}/storage/v1/object/list/reservation-quotes`
          ? json(200, [{ name: 'devis-123.pdf' }])
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual([
      '[storage] reservation-quotes : liste vide ou refusée pour anon',
    ])
  })

  it('l’ancien domaine qui ne redirige plus, et un en-tête de sécurité manquant', async () => {
    const { fetchImpl } = fakeFetch([
      ({ url }) =>
        url === 'https://prosimport.com/catalogue'
          ? text(200, '<html>')
          : undefined,
      ({ url }) =>
        url === `${DEFAULT_SITE_URL}/`
          ? text(200, '<html>', {
              'x-frame-options': 'DENY',
              'x-content-type-options': 'nosniff',
            })
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual([
      '[site] Strict-Transport-Security présent',
      `[site] https://prosimport.com redirige vers ${DEFAULT_SITE_URL}`,
    ])
  })

  it('/api/contact qui accepte une origine étrangère', async () => {
    const { fetchImpl } = fakeFetch([
      ({ url, method }) =>
        url === `${DEFAULT_SITE_URL}/api/contact` && method === 'POST'
          ? json(400, { ok: false, error: 'invalid' })
          : undefined,
    ])
    const { failures } = await runPortalChecks({ fetchImpl, env: ENV })
    expect(failures).toEqual([
      '[site] /api/contact refuse une origine étrangère (403)',
    ])
  })
})

describe('security:portals — parité avec le code', () => {
  it('constantes identiques à src/', () => {
    expect(INDEXNOW_KEY).toBe(SRC_INDEXNOW_KEY)
    expect(DEFAULT_SITE_URL).toBe(SRC_SITE_URL)
  })

  it('seul 42501 prouve un refus RLS', () => {
    expect(rlsDenied(403, { code: '42501' })).toBe(true)
    expect(rlsDenied(401, { code: 'PGRST301' })).toBe(false)
    expect(rlsDenied(409, { code: '23503' })).toBe(false)
    expect(rlsDenied(200, [])).toBe(false)
  })

  it('les tables sensibles du schéma sont couvertes', () => {
    for (const table of [
      'users_profile',
      'reservations',
      'invoices',
      'commission_ledger',
    ]) {
      expect(PRIVATE_TABLES).toContain(table)
    }
  })
})
