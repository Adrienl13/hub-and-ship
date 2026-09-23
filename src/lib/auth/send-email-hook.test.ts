// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  AUTH_LINK_ORIGIN,
  buildAuthCallbackLink,
  parseHookSecret,
  parseSendEmailPayload,
  planAuthEmails,
  RECOVERY_RETURN_TO,
  signStandardWebhook,
  verifyStandardWebhook,
  type SendEmailHookPayload,
} from './send-email-hook'

// 32 octets, comme ceux que génère le dashboard Supabase.
const SECRET_B64 = 'MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw6UXtxAcPxjc='
const SECRET = parseHookSecret(`v1,whsec_${SECRET_B64}`)!

function payload(
  overrides: {
    user?: Partial<SendEmailHookPayload['user']>
    email_data?: Partial<SendEmailHookPayload['email_data']>
  } = {},
): SendEmailHookPayload {
  return {
    user: {
      id: '8d7b6e2e-1d25-4a9f-b8d1-0c2f0b3b1a11',
      email: 'adrien.laniez@icloud.com',
      new_email: '',
      user_metadata: {},
      ...overrides.user,
    },
    email_data: {
      token: '',
      token_hash: 'pkce_hash_abc',
      redirect_to: 'https://terrassea.com/auth/callback?returnTo=%2Faccount',
      email_action_type: 'signup',
      site_url: 'https://prosimport.com',
      token_new: '',
      token_hash_new: '',
      old_email: '',
      ...overrides.email_data,
    },
  }
}

describe('parseHookSecret', () => {
  it('accepte « v1,whsec_… », « whsec_… » et le base64 nu, avec la même clé', () => {
    const full = parseHookSecret(`v1,whsec_${SECRET_B64}`)
    const prefixed = parseHookSecret(`whsec_${SECRET_B64}`)
    const bare = parseHookSecret(` ${SECRET_B64} `)
    expect(full).not.toBeNull()
    expect(full!.length).toBe(32)
    expect(Array.from(prefixed!)).toEqual(Array.from(full!))
    expect(Array.from(bare!)).toEqual(Array.from(full!))
  })

  it('rend null pour un secret absent, vide ou illisible', () => {
    expect(parseHookSecret(undefined)).toBeNull()
    expect(parseHookSecret('')).toBeNull()
    expect(parseHookSecret('v1,whsec_')).toBeNull()
    expect(parseHookSecret('v1,whsec_!!!pas du base64!!!')).toBeNull()
  })
})

describe('verifyStandardWebhook', () => {
  const body = JSON.stringify(payload())
  const now = 1_790_000_000

  async function signedHeaders(
    opts: { id?: string; timestamp?: number; secret?: Uint8Array } = {},
  ): Promise<Headers> {
    const id = opts.id ?? 'msg_01'
    const timestamp = opts.timestamp ?? now
    const signature = await signStandardWebhook({
      id,
      timestamp,
      body,
      secret: opts.secret ?? SECRET,
    })
    return new Headers({
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signature,
    })
  }

  it('accepte une signature valide dans la fenêtre de tolérance', async () => {
    const headers = await signedHeaders()
    expect(headers.get('webhook-signature')).toMatch(/^v1,[A-Za-z0-9+/]+=*$/)
    await expect(
      verifyStandardWebhook({ headers, body, secret: SECRET, nowSeconds: now }),
    ).resolves.toEqual({ ok: true })
    await expect(
      verifyStandardWebhook({
        headers,
        body,
        secret: SECRET,
        nowSeconds: now + 299,
      }),
    ).resolves.toEqual({ ok: true })
  })

  it('accepte plusieurs signatures séparées par des espaces si l’une est bonne', async () => {
    const headers = await signedHeaders()
    headers.set(
      'webhook-signature',
      `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${headers.get('webhook-signature')}`,
    )
    await expect(
      verifyStandardWebhook({ headers, body, secret: SECRET, nowSeconds: now }),
    ).resolves.toEqual({ ok: true })
  })

  it('refuse un en-tête manquant', async () => {
    const headers = await signedHeaders()
    headers.delete('webhook-signature')
    await expect(
      verifyStandardWebhook({ headers, body, secret: SECRET, nowSeconds: now }),
    ).resolves.toEqual({ ok: false, reason: 'missing_headers' })
  })

  it('refuse un horodatage trop vieux, trop futur ou illisible', async () => {
    const old = await signedHeaders({ timestamp: now - 301 })
    await expect(
      verifyStandardWebhook({
        headers: old,
        body,
        secret: SECRET,
        nowSeconds: now,
      }),
    ).resolves.toEqual({ ok: false, reason: 'stale_timestamp' })
    const future = await signedHeaders({ timestamp: now + 301 })
    await expect(
      verifyStandardWebhook({
        headers: future,
        body,
        secret: SECRET,
        nowSeconds: now,
      }),
    ).resolves.toEqual({ ok: false, reason: 'stale_timestamp' })
    const garbage = await signedHeaders()
    garbage.set('webhook-timestamp', 'hier')
    await expect(
      verifyStandardWebhook({
        headers: garbage,
        body,
        secret: SECRET,
        nowSeconds: now,
      }),
    ).resolves.toEqual({ ok: false, reason: 'stale_timestamp' })
  })

  it('refuse une signature d’un autre secret, d’un autre corps ou d’un autre id', async () => {
    const other = parseHookSecret(
      'whsec_c2VjcmV0LWRpZmZlcmVudC0zMi1vY3RldHMtZXhhY3Q=',
    )!
    const wrongSecret = await signedHeaders({ secret: other })
    await expect(
      verifyStandardWebhook({
        headers: wrongSecret,
        body,
        secret: SECRET,
        nowSeconds: now,
      }),
    ).resolves.toEqual({ ok: false, reason: 'bad_signature' })

    const headers = await signedHeaders()
    await expect(
      verifyStandardWebhook({
        headers,
        body: `${body} `,
        secret: SECRET,
        nowSeconds: now,
      }),
    ).resolves.toEqual({ ok: false, reason: 'bad_signature' })

    headers.set('webhook-id', 'msg_02')
    await expect(
      verifyStandardWebhook({ headers, body, secret: SECRET, nowSeconds: now }),
    ).resolves.toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('ignore une version de signature inconnue', async () => {
    const headers = await signedHeaders()
    headers.set(
      'webhook-signature',
      headers.get('webhook-signature')!.replace(/^v1,/, 'v2,'),
    )
    await expect(
      verifyStandardWebhook({ headers, body, secret: SECRET, nowSeconds: now }),
    ).resolves.toEqual({ ok: false, reason: 'bad_signature' })
  })
})

describe('parseSendEmailPayload', () => {
  it('lit le corps Supabase en tolérant les champs supplémentaires', () => {
    const raw = {
      user: {
        ...payload().user,
        created_at: '2026-09-23T09:58:00Z',
        app_metadata: { provider: 'email' },
      },
      email_data: { ...payload().email_data, extra_field: 42 },
      something_new: true,
    }
    const result = parseSendEmailPayload(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.email_data.email_action_type).toBe('signup')
    expect(result.payload.user.email).toBe('adrien.laniez@icloud.com')
  })

  it('remplace les champs null ou absents par une chaîne vide', () => {
    const result = parseSendEmailPayload({
      user: { id: 'u1', email: 'a@b.fr', user_metadata: null },
      email_data: {
        email_action_type: 'magiclink',
        token_hash: 'h',
        redirect_to: null,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.email_data.redirect_to).toBe('')
    expect(result.payload.email_data.token_hash_new).toBe('')
    expect(result.payload.user.new_email).toBe('')
  })

  it('refuse un type inconnu, un corps sans user et un lien sans token_hash', () => {
    expect(
      parseSendEmailPayload({
        ...payload(),
        email_data: { ...payload().email_data, email_action_type: 'sms' },
      }).ok,
    ).toBe(false)
    expect(parseSendEmailPayload({ email_data: payload().email_data }).ok).toBe(
      false,
    )
    expect(parseSendEmailPayload(null).ok).toBe(false)
    const noHash = parseSendEmailPayload(
      payload({ email_data: { token_hash: '' } }),
    )
    expect(noHash.ok).toBe(false)
    if (!noHash.ok) expect(noHash.error).toContain('token_hash')
  })

  it('exige le code pour reauthentication, mais rien pour une notification', () => {
    expect(
      parseSendEmailPayload(
        payload({
          email_data: { email_action_type: 'reauthentication', token_hash: '' },
        }),
      ).ok,
    ).toBe(false)
    expect(
      parseSendEmailPayload(
        payload({
          email_data: {
            email_action_type: 'password_changed_notification',
            token_hash: '',
          },
        }),
      ).ok,
    ).toBe(true)
  })
})

describe('buildAuthCallbackLink', () => {
  it('pointe sur terrassea.com quel que soit site_url, avec returnTo et type', () => {
    const link = buildAuthCallbackLink({
      tokenHash: 'abc+def/ghi=',
      actionType: 'signup',
      redirectTo:
        'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris',
    })
    expect(link).toBe(
      `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount%2Ffavoris&token_hash=abc%2Bdef%2Fghi%3D&type=signup`,
    )
    const url = new URL(link)
    expect(url.searchParams.get('token_hash')).toBe('abc+def/ghi=')
    expect(url.searchParams.get('returnTo')).toBe('/account/favoris')
  })

  it('retombe sur /account quand Supabase a remplacé la redirection par la Site URL', () => {
    expect(
      buildAuthCallbackLink({
        tokenHash: 'h',
        actionType: 'magiclink',
        redirectTo: 'https://prosimport.com',
      }),
    ).toBe(
      `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount&token_hash=h&type=magiclink`,
    )
    expect(
      buildAuthCallbackLink({
        tokenHash: 'h',
        actionType: 'email',
        redirectTo:
          'https://terrassea.com/auth/callback?returnTo=https%3A%2F%2Fevil.example',
      }),
    ).toContain('returnTo=%2Faccount&')
  })

  it('returnToOverride remplace la destination de redirect_to, après contrôle', () => {
    expect(
      buildAuthCallbackLink({
        tokenHash: 'h',
        actionType: 'recovery',
        redirectTo:
          'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris',
        returnToOverride: '/account/mot-de-passe',
      }),
    ).toBe(
      `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount%2Fmot-de-passe&token_hash=h&type=recovery`,
    )
    // Une destination forcée hostile retombe sur le tableau de bord.
    expect(
      buildAuthCallbackLink({
        tokenHash: 'h',
        actionType: 'recovery',
        redirectTo: null,
        returnToOverride: 'https://evil.example',
      }),
    ).toContain('returnTo=%2Faccount&')
  })
})

describe('planAuthEmails', () => {
  it('signup et invite → un email de bienvenue avec le prénom des métadonnées', () => {
    const plan = planAuthEmails(
      payload({ user: { user_metadata: { first_name: ' Camille ' } } }),
    )
    expect(plan).toHaveLength(1)
    // Première visite par lien (aucune fiche en métadonnées) : le clic crée l'espace.
    expect(plan[0]).toMatchObject({
      to: 'adrien.laniez@icloud.com',
      kind: 'welcome_link',
      firstName: 'Camille',
    })
    // Inscription avec mot de passe (fiche déjà posée) : le clic ACTIVE l'espace.
    expect(
      planAuthEmails(
        payload({
          user: {
            user_metadata: {
              first_name: 'Camille',
              company_name: 'Hôtel des Pins',
              onboarding_completed_at: '2026-09-23T13:00:00.000Z',
            },
          },
        }),
      )[0],
    ).toMatchObject({ kind: 'welcome' })
    expect(plan[0]!.link).toBe(
      `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount&token_hash=pkce_hash_abc&type=signup`,
    )
    expect(
      planAuthEmails(
        payload({ email_data: { email_action_type: 'invite' } }),
      )[0],
    ).toMatchObject({ kind: 'welcome_link', firstName: undefined })
  })

  it('magiclink et email → connexion ; recovery → récupération', () => {
    expect(
      planAuthEmails(
        payload({ email_data: { email_action_type: 'magiclink' } }),
      ),
    ).toEqual([
      {
        to: 'adrien.laniez@icloud.com',
        kind: 'login',
        link: `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount&token_hash=pkce_hash_abc&type=magiclink`,
        firstName: undefined,
      },
    ])
    expect(
      planAuthEmails(
        payload({ email_data: { email_action_type: 'email' } }),
      )[0]!.kind,
    ).toBe('login')
    expect(
      planAuthEmails(
        payload({ email_data: { email_action_type: 'recovery' } }),
      )[0],
    ).toMatchObject({ kind: 'recovery' })
    expect(
      planAuthEmails(
        payload({ email_data: { email_action_type: 'recovery' } }),
      )[0]!.link,
    ).toContain('&type=recovery')
  })

  it('recovery → le lien mène TOUJOURS au choix du mot de passe, quel que soit redirect_to', () => {
    expect(RECOVERY_RETURN_TO).toBe('/account/mot-de-passe')
    const expected = `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount%2Fmot-de-passe&token_hash=pkce_hash_abc&type=recovery`
    const redirects = [
      'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Fmot-de-passe',
      // returnTo conservé mais différent : le navigateur visait une autre page.
      'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris',
      // Liste blanche : Supabase a remplacé la redirection par la Site URL.
      'https://prosimport.com',
      '',
    ]
    for (const redirect_to of redirects) {
      const plan = planAuthEmails(
        payload({ email_data: { email_action_type: 'recovery', redirect_to } }),
      )
      expect(plan, redirect_to).toHaveLength(1)
      expect(plan[0]!.link, redirect_to).toBe(expected)
    }
    // Les autres types gardent la destination demandée.
    expect(
      planAuthEmails(
        payload({
          email_data: {
            email_action_type: 'magiclink',
            redirect_to:
              'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris',
          },
        }),
      )[0]!.link,
    ).toContain('returnTo=%2Faccount%2Ffavoris&')
  })

  it('email_change sécurisé → deux emails, mapping croisé des token_hash', () => {
    const plan = planAuthEmails(
      payload({
        user: { new_email: 'nouvelle@example.com' },
        email_data: {
          email_action_type: 'email_change',
          token_hash: 'hash_new_address',
          token_hash_new: 'hash_current_address',
        },
      }),
    )
    expect(plan).toHaveLength(2)
    expect(plan[0]).toMatchObject({
      to: 'adrien.laniez@icloud.com',
      kind: 'email_change_current',
    })
    expect(plan[0]!.link).toContain('token_hash=hash_current_address')
    expect(plan[1]).toMatchObject({
      to: 'nouvelle@example.com',
      kind: 'email_change_new',
    })
    expect(plan[1]!.link).toContain('token_hash=hash_new_address')
    expect(plan[1]!.link).toContain('&type=email_change')
  })

  it('email_change simple → un seul email à la nouvelle adresse', () => {
    const plan = planAuthEmails(
      payload({
        user: { new_email: 'nouvelle@example.com' },
        email_data: { email_action_type: 'email_change', token_hash: 'h1' },
      }),
    )
    expect(plan).toEqual([
      {
        to: 'nouvelle@example.com',
        kind: 'email_change_new',
        link: `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=%2Faccount&token_hash=h1&type=email_change`,
        firstName: undefined,
      },
    ])
  })

  it('reauthentication → le code, sans lien', () => {
    const plan = planAuthEmails(
      payload({
        email_data: {
          email_action_type: 'reauthentication',
          token: '482913',
          token_hash: '',
        },
      }),
    )
    expect(plan).toEqual([
      {
        to: 'adrien.laniez@icloud.com',
        kind: 'reauthentication',
        code: '482913',
        firstName: undefined,
      },
    ])
    expect(plan[0]!.link).toBeUndefined()
  })

  it('notifications → une information libellée selon le type, sans lien', () => {
    const cases = [
      ['password_changed_notification', 'Votre mot de passe a été modifié'],
      ['email_changed_notification', 'Votre adresse email a été modifiée'],
      ['phone_changed_notification', 'Votre numéro de téléphone a été modifié'],
      [
        'identity_linked_notification',
        'Une nouvelle méthode de connexion a été liée',
      ],
      [
        'identity_unlinked_notification',
        'Une méthode de connexion a été retirée',
      ],
      [
        'mfa_factor_enrolled_notification',
        'Une double authentification a été activée',
      ],
      [
        'mfa_factor_unenrolled_notification',
        'Une double authentification a été retirée',
      ],
    ] as const
    for (const [type, label] of cases) {
      const plan = planAuthEmails(
        payload({ email_data: { email_action_type: type, token_hash: '' } }),
      )
      expect(plan).toHaveLength(1)
      expect(plan[0]).toMatchObject({ kind: 'notice', noticeLabel: label })
      expect(plan[0]!.link).toBeUndefined()
    }
  })

  it('accepte une notification inconnue (libellé de repli) mais refuse un type inconnu à jeton', () => {
    const unknownNotice = parseSendEmailPayload(
      payload({
        email_data: {
          email_action_type: 'passkey_added_notification',
          token_hash: '',
        },
      }),
    )
    expect(unknownNotice.ok).toBe(true)
    if (unknownNotice.ok) {
      expect(planAuthEmails(unknownNotice.payload)[0]).toMatchObject({
        kind: 'notice',
        noticeLabel: undefined,
      })
    }

    const unknownLink = parseSendEmailPayload(
      payload({ email_data: { email_action_type: 'passkey_login' } }),
    )
    expect(unknownLink.ok).toBe(false)
    if (!unknownLink.ok) expect(unknownLink.error).toContain('inconnu')
  })

  it('ignore un prénom qui ressemble à du texte injecté', () => {
    const hostile = [
      'Camille\nVotre compte est bloqué, cliquez https://evil.example',
      '<b>Camille</b>',
      'Voir https://evil.example',
      'C'.repeat(61),
      '   ',
    ]
    for (const first_name of hostile) {
      expect(
        planAuthEmails(payload({ user: { user_metadata: { first_name } } }))[0],
      ).toMatchObject({ firstName: undefined })
    }
    expect(
      planAuthEmails(
        payload({ user: { user_metadata: { first_name: 'Anne-Sophie' } } }),
      )[0],
    ).toMatchObject({ firstName: 'Anne-Sophie' })
  })
})
