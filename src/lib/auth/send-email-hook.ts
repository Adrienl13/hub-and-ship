// Hook Supabase Auth « Send Email » : logique pure, testable sans requête.
//
// Supabase n'envoie plus lui-même l'email de connexion : il appelle
// POST /api/auth/send-email avec le jeton, et c'est notre Worker qui rédige
// et expédie l'email (Brevo, marque Terrassea). Trois responsabilités ici :
//
//   1. vérifier la signature Standard Webhooks (la SEULE porte de l'endpoint :
//      Supabase n'envoie pas d'en-tête Origin et l'adresse IP varie) ;
//   2. lire le corps envoyé par Supabase ;
//   3. décider quoi envoyer à qui, et construire NOUS-MÊMES le lien vers
//      /auth/callback avec `token_hash` — vérifiable depuis n'importe quel
//      appareil (supabase.auth.verifyOtp), indépendant de la Site URL et de la
//      liste blanche du dashboard. C'est ce qui a manqué le 23/09/2026
//      (docs/RUNBOOK_MAGIC_LINK.md).
//
// Web Crypto uniquement (Cloudflare Workers, Node ≥ 20, Vitest) : aucune
// dépendance npm.

import { z } from 'zod'

import type { AuthEmailKind } from '@/lib/email/templates'
import { timingSafeEqualStr } from '@/lib/security/timing-safe-equal'

import { returnToFromRedirectUrl } from './return-to'

/**
 * Origine FIXE du lien. `email_data.site_url` n'est pas utilisée : c'est la
 * Site URL du dashboard, qui valait encore prosimport.com le 23/09/2026.
 */
export const AUTH_LINK_ORIGIN = 'https://terrassea.com'

/** Tolérance sur `webhook-timestamp`, comme la référence Standard Webhooks. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

/** Types qui se vérifient par un lien `token_hash` sur /auth/callback. */
export const LINK_ACTION_TYPES = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const

export type LinkActionType = (typeof LINK_ACTION_TYPES)[number]

/** Tous les types connus ; les notifications inconnues sont aussi acceptées. */
export const EMAIL_ACTION_TYPES = [
  ...LINK_ACTION_TYPES,
  'reauthentication',
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
] as const

export type EmailActionType = (typeof EMAIL_ACTION_TYPES)[number]

const LINK_TYPES = new Set<string>(LINK_ACTION_TYPES)

function isLinkActionType(type: string): type is LinkActionType {
  return LINK_TYPES.has(type)
}

/**
 * Une notification (mot de passe modifié, MFA activée…) n'a ni lien ni code.
 * GoTrue en ajoute au fil des versions : toute valeur en `_notification`
 * est acceptée, avec un libellé de repli si on ne la connaît pas — un type
 * inconnu ne doit jamais faire échouer l'opération du client.
 */
export function isNoticeActionType(type: string): boolean {
  return type.endsWith('_notification')
}

const NOTICE_LABELS: Readonly<Record<string, string>> = {
  password_changed_notification: 'Votre mot de passe a été modifié',
  email_changed_notification: 'Votre adresse email a été modifiée',
  phone_changed_notification: 'Votre numéro de téléphone a été modifié',
  identity_linked_notification: 'Une nouvelle méthode de connexion a été liée',
  identity_unlinked_notification: 'Une méthode de connexion a été retirée',
  mfa_factor_enrolled_notification: 'Une double authentification a été activée',
  mfa_factor_unenrolled_notification:
    'Une double authentification a été retirée',
}

// ---------------------------------------------------------------------------
// Base64 (Web Crypto rend des ArrayBuffer ; btoa/atob existent partout)
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array | null {
  // Le secret peut arriver en base64 « url » : on normalise avant de décoder.
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) return null
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Secret et signature Standard Webhooks
// ---------------------------------------------------------------------------

/**
 * Le dashboard Supabase génère « v1,whsec_<base64> ». On accepte aussi
 * « whsec_<base64> » et le base64 nu (copié-collé partiel). La clé HMAC est
 * le DÉCODAGE base64 de la partie après `whsec_`, pas la chaîne elle-même.
 */
export function parseHookSecret(raw: string | undefined): Uint8Array | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  let value = trimmed
  if (value.startsWith('v1,')) value = value.slice(3)
  if (value.startsWith('whsec_')) value = value.slice('whsec_'.length)
  if (!value) return null
  const bytes = base64ToBytes(value)
  return bytes && bytes.length > 0 ? bytes : null
}

async function hmacSha256Base64(
  secret: Uint8Array,
  message: string,
): Promise<string> {
  // Copie vers un ArrayBuffer « pur » : importKey refuse le type
  // ArrayBufferLike (SharedArrayBuffer possible) depuis TypeScript 5.7.
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return bytesToBase64(signature)
}

/**
 * Produit la valeur de l'en-tête `webhook-signature` (« v1,<base64> ») pour
 * un envoi donné. Sert aux tests et au test manuel en curl du runbook.
 */
export async function signStandardWebhook({
  id,
  timestamp,
  body,
  secret,
}: {
  readonly id: string
  readonly timestamp: number | string
  readonly body: string
  readonly secret: Uint8Array
}): Promise<string> {
  const digest = await hmacSha256Base64(secret, `${id}.${timestamp}.${body}`)
  return `v1,${digest}`
}

export type WebhookVerification =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: 'missing_headers' | 'stale_timestamp' | 'bad_signature'
    }

/**
 * Vérifie `webhook-id`, `webhook-timestamp` et `webhook-signature` sur le
 * CORPS BRUT (pas le JSON re-sérialisé). Plusieurs signatures peuvent être
 * présentes, séparées par des espaces (rotation de secret) : une seule
 * valide suffit. Comparaison à temps constant.
 */
export async function verifyStandardWebhook({
  headers,
  body,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  readonly headers: Headers
  readonly body: string
  readonly secret: Uint8Array
  readonly nowSeconds?: number
}): Promise<WebhookVerification> {
  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signatures = headers.get('webhook-signature')
  if (!id || !timestamp || !signatures) {
    return { ok: false, reason: 'missing_headers' }
  }

  if (!/^\d{1,12}$/.test(timestamp)) {
    return { ok: false, reason: 'stale_timestamp' }
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const expected = await hmacSha256Base64(secret, `${id}.${timestamp}.${body}`)
  for (const entry of signatures.split(' ')) {
    const separator = entry.indexOf(',')
    if (separator <= 0) continue
    const version = entry.slice(0, separator)
    const value = entry.slice(separator + 1)
    if (version === 'v1' && timingSafeEqualStr(value, expected)) {
      return { ok: true }
    }
  }
  return { ok: false, reason: 'bad_signature' }
}

// ---------------------------------------------------------------------------
// Corps envoyé par Supabase
// ---------------------------------------------------------------------------

// Tolérant aux champs supplémentaires : Supabase enrichit le corps au fil des
// versions, et un champ inconnu ne doit jamais bloquer une connexion.
const optionalString = z
  .string()
  .nullish()
  .transform((value) => value ?? '')

const payloadSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        email: z.string().min(1),
        new_email: optionalString,
        user_metadata: z.record(z.unknown()).nullish(),
      })
      .passthrough(),
    email_data: z
      .object({
        token: optionalString,
        token_hash: optionalString,
        redirect_to: optionalString,
        email_action_type: z.string().min(1),
        site_url: optionalString,
        token_new: optionalString,
        token_hash_new: optionalString,
        old_email: optionalString,
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const { email_action_type: type, token_hash, token } = value.email_data
    if (isLinkActionType(type)) {
      if (!token_hash) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email_data', 'token_hash'],
          message: `token_hash requis pour ${type}`,
        })
      }
      return
    }
    if (type === 'reauthentication') {
      if (!token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email_data', 'token'],
          message: 'token requis pour reauthentication',
        })
      }
      return
    }
    if (!isNoticeActionType(type)) {
      // Un type inconnu qui porterait un jeton : on ne saurait pas quel lien
      // construire, et /auth/callback ne saurait pas le vérifier.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email_data', 'email_action_type'],
        message: `type d’email inconnu : ${type}`,
      })
    }
  })

export type SendEmailHookPayload = z.infer<typeof payloadSchema>

export function parseSendEmailPayload(
  json: unknown,
): { ok: true; payload: SendEmailHookPayload } | { ok: false; error: string } {
  const parsed = payloadSchema.safeParse(json)
  if (parsed.success) return { ok: true, payload: parsed.data }
  const first = parsed.error.issues[0]
  const where = first?.path.join('.') || 'corps'
  return { ok: false, error: `${where} : ${first?.message ?? 'invalide'}` }
}

// ---------------------------------------------------------------------------
// Lien et plan d'envoi
// ---------------------------------------------------------------------------

/**
 * `https://terrassea.com/auth/callback?returnTo=…&token_hash=…&type=…`.
 * `type` est l'email_action_type tel quel : parseMagicLinkCallback les
 * accepte tous, et verifyOtp attend exactement ces valeurs.
 */
export function buildAuthCallbackLink({
  tokenHash,
  actionType,
  redirectTo,
}: {
  readonly tokenHash: string
  readonly actionType: LinkActionType
  readonly redirectTo: string | null | undefined
}): string {
  const returnTo = returnToFromRedirectUrl(redirectTo)
  return `${AUTH_LINK_ORIGIN}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&token_hash=${encodeURIComponent(tokenHash)}&type=${actionType}`
}

export interface PlannedAuthEmail {
  readonly to: string
  readonly kind: AuthEmailKind
  readonly link?: string
  readonly code?: string
  readonly firstName?: string
  readonly noticeLabel?: string
}

/** Un prénom : pas de saut de ligne, de balise ni d'URL, 60 caractères au plus. */
const FIRST_NAME_MAX_LENGTH = 60
// eslint-disable-next-line no-control-regex
const FIRST_NAME_FORBIDDEN = /[\u0000-\u001f\u007f<>]|:\/\//

/**
 * Prénom lu dans les métadonnées, que l'utilisateur écrit lui-même
 * (auth.updateUser). Il finit dans un email de marque — parfois envoyé à une
 * adresse qu'il a choisie (changement d'email) : tout ce qui ressemble à du
 * texte injecté (lignes, balises, liens, longueur) est simplement ignoré.
 */
function firstNameOf(payload: SendEmailHookPayload): string | undefined {
  const value = payload.user.user_metadata?.first_name
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > FIRST_NAME_MAX_LENGTH) {
    return undefined
  }
  if (FIRST_NAME_FORBIDDEN.test(trimmed)) return undefined
  return trimmed
}

/** Décide quoi envoyer à qui. Pur : aucun envoi ici. */
export function planAuthEmails(
  payload: SendEmailHookPayload,
): ReadonlyArray<PlannedAuthEmail> {
  const { user, email_data: data } = payload
  const type = data.email_action_type
  const firstName = firstNameOf(payload)
  const link = (tokenHash: string) =>
    buildAuthCallbackLink({
      tokenHash,
      // Garanti par parseSendEmailPayload : seuls les types « lien » arrivent ici.
      actionType: type as LinkActionType,
      redirectTo: data.redirect_to,
    })

  if (type === 'reauthentication') {
    return [
      {
        to: user.email,
        kind: 'reauthentication',
        code: data.token,
        firstName,
      },
    ]
  }

  if (!isLinkActionType(type)) {
    // Notification (connue ou non) : information sans lien.
    return [
      {
        to: user.email,
        kind: 'notice',
        noticeLabel: NOTICE_LABELS[type],
        firstName,
      },
    ]
  }

  switch (type) {
    case 'signup':
    case 'invite':
      return [
        {
          to: user.email,
          kind: 'welcome',
          link: link(data.token_hash),
          firstName,
        },
      ]

    case 'magiclink':
    case 'email':
      return [
        {
          to: user.email,
          kind: 'login',
          link: link(data.token_hash),
          firstName,
        },
      ]

    case 'recovery':
      return [
        {
          to: user.email,
          kind: 'recovery',
          link: link(data.token_hash),
          firstName,
        },
      ]

    case 'email_change': {
      const newEmail = user.new_email || user.email
      // Mapping contre-intuitif mais documenté par Supabase : avec « Secure
      // Email Change », l'adresse ACTUELLE reçoit token_hash_new et la
      // NOUVELLE reçoit token_hash. Les deux clics sont nécessaires.
      if (data.token_hash && data.token_hash_new) {
        return [
          {
            to: user.email,
            kind: 'email_change_current',
            link: link(data.token_hash_new),
            firstName,
          },
          {
            to: newEmail,
            kind: 'email_change_new',
            link: link(data.token_hash),
            firstName,
          },
        ]
      }
      return [
        {
          to: newEmail,
          kind: 'email_change_new',
          link: link(data.token_hash),
          firstName,
        },
      ]
    }
  }
}
