// Preview sécurisée du Studio (lot 1) — côté serveur uniquement.
//
// GET /studio/preview?key=<STUDIO_PREVIEW_KEY> pose un cookie signé HMAC
// (7 jours) qui rend visibles les routes /studio quand le flag public
// VITE_STUDIO_ENABLED est OFF. Le secret :
// - est lu dans process.env (jamais dans une variable VITE_*) ;
// - est comparé en temps constant (pattern du cron de relances) ;
// - n'est jamais écrit dans le cookie (seule une signature l'est) ;
// - se révoque en le changeant (toutes les previews tombent).
// Le preview n'accorde RIEN d'autre : ni admin, ni auth, ni données.
// Réponses d'échec : 404, indiscernables d'une route inexistante.

import { enforceApiRateLimit } from '@/lib/security/api-rate-limit'
import type { RateLimitRule } from '@/lib/security/rate-limit'
import { timingSafeEqualStr } from '@/lib/security/timing-safe-equal'
import {
  STUDIO_PREVIEW_TTL_SECONDS,
  buildStudioPreviewClearCookie,
  buildStudioPreviewSetCookie,
  readStudioPreviewToken,
  signStudioPreviewToken,
  verifyStudioPreviewToken,
} from './preview-cookie'

/** Longueur minimale du secret : une clé courte ne protège rien. */
export const STUDIO_PREVIEW_KEY_MIN_LENGTH = 16

export const STUDIO_PREVIEW_RATE_LIMIT: RateLimitRule = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
}

export function readStudioPreviewSecret(
  env: { readonly STUDIO_PREVIEW_KEY?: string } = process.env,
): string | null {
  const value = env.STUDIO_PREVIEW_KEY?.trim() ?? ''
  return value.length >= STUDIO_PREVIEW_KEY_MIN_LENGTH ? value : null
}

export function isSecureRequest(request: Request, isProdBuild: boolean): boolean {
  if (isProdBuild) return true
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

export async function requestHasValidStudioPreview(
  request: Request,
  secret: string | null,
  nowSeconds: number,
): Promise<boolean> {
  if (!secret) return false
  const token = readStudioPreviewToken(request.headers.get('cookie'))
  const verdict = await verifyStudioPreviewToken(secret, token, nowSeconds)
  return verdict.valid
}

export interface StudioPreviewHandlerDeps {
  readonly secret: string | null
  readonly nowSeconds: number
  readonly secure: boolean
  readonly rateLimit?: (request: Request) => { allowed: boolean; response?: Response }
}

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function redirect(location: string, setCookie: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': setCookie,
      'cache-control': 'no-store',
    },
  })
}

/** Logique du handler GET /studio/preview, injectable pour les tests. */
export async function handleStudioPreviewRequest(
  request: Request,
  deps: StudioPreviewHandlerDeps,
): Promise<Response> {
  if (request.method !== 'GET') return notFound()
  const url = new URL(request.url)

  // Déconnexion explicite de la preview (utile en test) : pas de secret requis.
  if (url.searchParams.get('clear') === '1') {
    return redirect('/', buildStudioPreviewClearCookie({ secure: deps.secure }))
  }

  if (!deps.secret) return notFound()

  const limiter =
    deps.rateLimit ??
    ((incoming: Request) =>
      enforceApiRateLimit(incoming, 'studio-preview', STUDIO_PREVIEW_RATE_LIMIT))
  const limit = limiter(request)
  if (!limit.allowed) return limit.response ?? notFound()

  const key = url.searchParams.get('key') ?? ''
  if (key.length === 0 || !timingSafeEqualStr(key, deps.secret)) return notFound()

  const token = await signStudioPreviewToken(
    deps.secret,
    deps.nowSeconds + STUDIO_PREVIEW_TTL_SECONDS,
  )
  return redirect('/studio', buildStudioPreviewSetCookie(token, { secure: deps.secure }))
}
