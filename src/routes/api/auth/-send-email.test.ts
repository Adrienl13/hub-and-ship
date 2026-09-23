// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  parseHookSecret,
  signStandardWebhook,
} from '@/lib/auth/send-email-hook'
import type { SendEmailInput, SendEmailResult } from '@/lib/email/server'

import { handleSendEmailHook, type SendEmailHookDeps } from './send-email'

const ENDPOINT = 'https://terrassea.com/api/auth/send-email'
const RAW_SECRET = 'v1,whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw6UXtxAcPxjc='
const SECRET = parseHookSecret(RAW_SECRET)!
const NOW_MS = 1_790_000_000_000
const TOKEN_HASH = 'pkce_9f2c1e7a8b3d4c5e6f708192a3b4c5d6e7f8091a'

function supabaseBody(
  overrides: {
    user?: Record<string, unknown>
    email_data?: Record<string, unknown>
  } = {},
): string {
  return JSON.stringify({
    user: {
      id: '8d7b6e2e-1d25-4a9f-b8d1-0c2f0b3b1a11',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'adrien.laniez@icloud.com',
      user_metadata: {},
      created_at: '2026-09-23T09:58:00Z',
      ...overrides.user,
    },
    email_data: {
      token: '',
      token_hash: TOKEN_HASH,
      redirect_to: 'https://prosimport.com',
      email_action_type: 'signup',
      site_url: 'https://prosimport.com',
      token_new: '',
      token_hash_new: '',
      ...overrides.email_data,
    },
  })
}

async function signedRequest(
  body: string,
  opts: { timestamp?: number; secret?: Uint8Array; method?: string } = {},
): Promise<Request> {
  const id = 'msg_2f1e'
  const timestamp = opts.timestamp ?? Math.floor(NOW_MS / 1000)
  const signature = await signStandardWebhook({
    id,
    timestamp,
    body,
    secret: opts.secret ?? SECRET,
  })
  return new Request(ENDPOINT, {
    method: opts.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signature,
    },
    body,
  })
}

function deps(
  overrides: Partial<SendEmailHookDeps> = {},
): SendEmailHookDeps & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async (): Promise<SendEmailResult> => ({
    ok: true,
    id: 'brevo-1',
  }))
  return {
    send,
    secret: () => RAW_SECRET,
    now: () => NOW_MS,
    ...overrides,
  } as SendEmailHookDeps & { send: ReturnType<typeof vi.fn> }
}

function sentTo(send: ReturnType<typeof vi.fn>): SendEmailInput[] {
  return send.mock.calls.map((call) => call[0] as SendEmailInput)
}

describe('hook /api/auth/send-email', () => {
  let logged: string[]

  beforeEach(() => {
    logged = []
    const capture =
      (level: string) =>
      (...args: unknown[]) => {
        logged.push(`${level} ${JSON.stringify(args)}`)
      }
    vi.spyOn(console, 'log').mockImplementation(capture('log'))
    vi.spyOn(console, 'info').mockImplementation(capture('info'))
    vi.spyOn(console, 'warn').mockImplementation(capture('warn'))
    vi.spyOn(console, 'error').mockImplementation(capture('error'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refuse tout autre verbe que POST (405, Allow: POST)', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      new Request(ENDPOINT, { method: 'GET' }),
      d,
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(d.send).not.toHaveBeenCalled()
  })

  it('répond 503 et le dit en clair quand le secret n’est pas configuré', async () => {
    const d = deps({ secret: () => undefined })
    const response = await handleSendEmailHook(
      await signedRequest(supabaseBody()),
      d,
    )
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: { http_code: 503, message: 'hook_secret_missing' },
    })
    expect(d.send).not.toHaveBeenCalled()
    expect(
      logged.some(
        (l) =>
          l.startsWith('error') &&
          l.includes('SUPABASE_SEND_EMAIL_HOOK_SECRET absent'),
      ),
    ).toBe(true)
  })

  it('répond 401 pour une signature fausse, sans rien envoyer', async () => {
    const d = deps()
    const other = parseHookSecret(
      'whsec_c2VjcmV0LWRpZmZlcmVudC0zMi1vY3RldHMtZXhhY3Q=',
    )!
    const response = await handleSendEmailHook(
      await signedRequest(supabaseBody(), { secret: other }),
      d,
    )
    expect(response.status).toBe(401)
    const json = (await response.json()) as {
      error: { http_code: number; message: string }
    }
    expect(json.error.http_code).toBe(401)
    expect(json.error.message).toContain('bad_signature')
    expect(d.send).not.toHaveBeenCalled()
  })

  it('répond 401 pour un appel sans en-têtes de signature', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      new Request(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: supabaseBody(),
      }),
      d,
    )
    expect(response.status).toBe(401)
    expect(d.send).not.toHaveBeenCalled()
  })

  it('répond 401 pour un horodatage trop vieux (rejeu)', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      await signedRequest(supabaseBody(), {
        timestamp: Math.floor(NOW_MS / 1000) - 10 * 60,
      }),
      d,
    )
    expect(response.status).toBe(401)
    const json = (await response.json()) as { error: { message: string } }
    expect(json.error.message).toContain('stale_timestamp')
    expect(d.send).not.toHaveBeenCalled()
  })

  it('répond 400 pour un corps invalide, même bien signé', async () => {
    const d = deps()
    const notJson = await handleSendEmailHook(
      await signedRequest('{pas du json'),
      d,
    )
    expect(notJson.status).toBe(400)

    const unknownType = await handleSendEmailHook(
      await signedRequest(
        supabaseBody({ email_data: { email_action_type: 'sms' } }),
      ),
      d,
    )
    expect(unknownType.status).toBe(400)
    await expect(unknownType.json()).resolves.toMatchObject({
      error: { http_code: 400 },
    })
    expect(d.send).not.toHaveBeenCalled()
  })

  it('signup → 200 {} et un email de bienvenue portant le lien /auth/callback', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      await signedRequest(
        supabaseBody({ user: { user_metadata: { first_name: 'Adrien' } } }),
      ),
      d,
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({})

    const [email] = sentTo(d.send)
    expect(email).toBeDefined()
    expect(email!.to).toBe('adrien.laniez@icloud.com')
    // Première visite par lien : la fiche n'est pas encore en métadonnées.
    expect(email!.subject).toBe('Bienvenue chez Terrassea — créez votre espace')
    const link = `https://terrassea.com/auth/callback?returnTo=%2Faccount&token_hash=${TOKEN_HASH}&type=signup`
    // Dans le HTML, le kit échappe le « & » du href en « &amp; ».
    expect(email!.html).toContain(`href="${link.replace(/&/g, '&amp;')}"`)
    expect(email!.html).toContain('Créer mon espace')
    expect(email!.text).toContain(link)
    expect(email!.html).toContain('Adrien')
    expect(email!.html).not.toContain('prosimport.com')
  })

  it('reprend le returnTo de redirect_to quand Supabase l’a conservé', async () => {
    const d = deps()
    await handleSendEmailHook(
      await signedRequest(
        supabaseBody({
          email_data: {
            redirect_to:
              'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris',
          },
        }),
      ),
      d,
    )
    const [email] = sentTo(d.send)
    expect(email!.text).toContain(
      `https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris&token_hash=${TOKEN_HASH}&type=signup`,
    )
  })

  it('magiclink → email de connexion', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      await signedRequest(
        supabaseBody({ email_data: { email_action_type: 'magiclink' } }),
      ),
      d,
    )
    expect(response.status).toBe(200)
    const [email] = sentTo(d.send)
    expect(email!.subject).toBe('Votre lien de connexion Terrassea')
    expect(email!.html).toContain('Me connecter')
    expect(email!.html).toContain(`token_hash=${TOKEN_HASH}&amp;type=magiclink`)
  })

  it('email_change sécurisé → deux envois, adresse actuelle avec token_hash_new', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      await signedRequest(
        supabaseBody({
          user: { new_email: 'nouvelle@example.com' },
          email_data: {
            email_action_type: 'email_change',
            token_hash: 'hash_for_new',
            token_hash_new: 'hash_for_current',
          },
        }),
      ),
      d,
    )
    expect(response.status).toBe(200)
    const emails = sentTo(d.send)
    expect(emails).toHaveLength(2)
    expect(emails[0]!.to).toBe('adrien.laniez@icloud.com')
    expect(emails[0]!.text).toContain(
      'token_hash=hash_for_current&type=email_change',
    )
    expect(emails[0]!.html).toContain('Confirmez le changement d’adresse')
    expect(emails[1]!.to).toBe('nouvelle@example.com')
    expect(emails[1]!.text).toContain(
      'token_hash=hash_for_new&type=email_change',
    )
    expect(emails[1]!.html).toContain('Confirmez votre nouvelle adresse')
  })

  it('reauthentication → le code à 6 chiffres, aucun lien de connexion', async () => {
    const d = deps()
    const response = await handleSendEmailHook(
      await signedRequest(
        supabaseBody({
          email_data: {
            email_action_type: 'reauthentication',
            token: '482913',
            token_hash: '',
          },
        }),
      ),
      d,
    )
    expect(response.status).toBe(200)
    const [email] = sentTo(d.send)
    expect(email!.subject).toBe('Votre code de vérification Terrassea')
    expect(email!.html).toContain('482913')
    expect(email!.text).toContain('482913')
    expect(email!.html).not.toContain('/auth/callback')
    expect(email!.text).not.toContain('/auth/callback')
  })

  it('répond 500 email_not_sent quand Brevo refuse : Supabase doit faire échouer signInWithOtp', async () => {
    const d = deps({
      send: vi.fn(async (): Promise<SendEmailResult> => ({
        ok: false,
        skipped: false,
        reason: 'brevo_401: unauthorized',
      })),
    })
    const response = await handleSendEmailHook(
      await signedRequest(supabaseBody()),
      d,
    )
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: { http_code: 500, message: 'email_not_sent' },
    })
    expect(
      logged.some(
        (l) =>
          l.startsWith('error') &&
          l.includes('email non envoyé') &&
          l.includes('brevo_401'),
      ),
    ).toBe(true)
  })

  it('répond 500 aussi quand BREVO_API_KEY manque (envoi sauté), jamais un faux 200', async () => {
    const d = deps({
      send: vi.fn(async (): Promise<SendEmailResult> => ({
        ok: false,
        skipped: true,
        reason: 'not_configured',
      })),
    })
    const response = await handleSendEmailHook(
      await signedRequest(supabaseBody()),
      d,
    )
    expect(response.status).toBe(500)
  })

  it('ne journalise jamais le token_hash ni le lien complet', async () => {
    const d = deps()
    await handleSendEmailHook(
      await signedRequest(
        supabaseBody({
          user: { new_email: 'nouvelle@example.com' },
          email_data: {
            email_action_type: 'email_change',
            token_hash: 'hash_for_new',
            token_hash_new: 'hash_for_current',
          },
        }),
      ),
      d,
    )
    await handleSendEmailHook(
      await signedRequest(supabaseBody()),
      deps({
        send: vi.fn(async (): Promise<SendEmailResult> => ({
          ok: false,
          skipped: false,
          reason: 'brevo_500',
        })),
      }),
    )
    expect(logged.length).toBeGreaterThan(0)
    for (const line of logged) {
      expect(line).not.toContain(TOKEN_HASH)
      expect(line).not.toContain('hash_for_new')
      expect(line).not.toContain('hash_for_current')
      expect(line).not.toContain('/auth/callback')
    }
    // Les envois réussis sont bien tracés (type et destinataire), sans secret.
    expect(
      logged.some(
        (l) =>
          l.startsWith('info') && l.includes('"kind":"email_change_current"'),
      ),
    ).toBe(true)
  })
})
