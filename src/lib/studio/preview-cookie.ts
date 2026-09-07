// Cookie de preview Studio (lot 1) : jeton signé HMAC-SHA256 avec le secret
// serveur STUDIO_PREVIEW_KEY. Logique pure (WebCrypto : Workers, Node ≥ 18),
// testable sans requête.
//
// Format du jeton : `<expiration epoch secondes>.<signature base64url>`.
// - expiration incluse dans la partie signée : un jeton falsifié ou modifié
//   est rejeté ; un jeton expiré est rejeté ;
// - révocation globale : changer STUDIO_PREVIEW_KEY invalide tous les jetons ;
// - le secret ne quitte jamais le serveur : le cookie ne contient qu'une
//   signature, pas la clé.

import { timingSafeEqualStr } from '@/lib/security/timing-safe-equal'

export const STUDIO_PREVIEW_COOKIE = 'studio_preview'
export const STUDIO_PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60
export const STUDIO_PREVIEW_COOKIE_PATH = '/studio'

function base64UrlEncode(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return base64UrlEncode(signature)
}

/** Jeton valable jusqu'à `expiresAtSeconds` (epoch, secondes). */
export async function signStudioPreviewToken(
  secret: string,
  expiresAtSeconds: number,
): Promise<string> {
  const expiry = String(Math.trunc(expiresAtSeconds))
  const signature = await hmacSha256(secret, `${STUDIO_PREVIEW_COOKIE}:${expiry}`)
  return `${expiry}.${signature}`
}

export type StudioPreviewVerdict =
  | { readonly valid: true; readonly expiresAtSeconds: number }
  | {
      readonly valid: false
      readonly reason: 'missing' | 'malformed' | 'expired' | 'bad_signature'
    }

export async function verifyStudioPreviewToken(
  secret: string,
  token: string | null | undefined,
  nowSeconds: number,
): Promise<StudioPreviewVerdict> {
  if (!token) return { valid: false, reason: 'missing' }
  const separator = token.indexOf('.')
  if (separator <= 0) return { valid: false, reason: 'malformed' }
  const expiryPart = token.slice(0, separator)
  const signaturePart = token.slice(separator + 1)
  if (!/^\d{1,12}$/.test(expiryPart) || signaturePart.length === 0) {
    return { valid: false, reason: 'malformed' }
  }
  const expected = await hmacSha256(secret, `${STUDIO_PREVIEW_COOKIE}:${expiryPart}`)
  // Signature vérifiée AVANT l'expiration : un jeton forgé ne révèle rien.
  if (!timingSafeEqualStr(expected, signaturePart)) {
    return { valid: false, reason: 'bad_signature' }
  }
  const expiresAtSeconds = Number(expiryPart)
  if (expiresAtSeconds <= nowSeconds) return { valid: false, reason: 'expired' }
  return { valid: true, expiresAtSeconds }
}

export interface PreviewCookieOptions {
  readonly secure: boolean
  readonly maxAgeSeconds?: number
}

/** Valeur d'en-tête Set-Cookie : HttpOnly, SameSite=Lax (navigation de
 *  premier niveau vers /studio après redirection), Path restreint à /studio,
 *  Secure en production. */
export function buildStudioPreviewSetCookie(
  token: string,
  options: PreviewCookieOptions,
): string {
  const maxAge = options.maxAgeSeconds ?? STUDIO_PREVIEW_TTL_SECONDS
  const parts = [
    `${STUDIO_PREVIEW_COOKIE}=${token}`,
    `Path=${STUDIO_PREVIEW_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildStudioPreviewClearCookie(options: PreviewCookieOptions): string {
  return buildStudioPreviewSetCookie('', { ...options, maxAgeSeconds: 0 })
}

/** Extrait le jeton de preview d'un en-tête Cookie brut. */
export function readStudioPreviewToken(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${STUDIO_PREVIEW_COOKIE}=`)) continue
    const value = trimmed.slice(STUDIO_PREVIEW_COOKIE.length + 1).trim()
    return value.length > 0 ? value : null
  }
  return null
}
