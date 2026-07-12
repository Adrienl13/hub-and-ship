// Rate-limiting par IP pour les endpoints POST publics (contact, candidatures
// partenaires, demandes de stock). Le same-origin seul ne freine pas un
// script : une IP peut marteler l'endpoint et déclencher un flot d'emails.
//
// Limite : store en mémoire (per-isolate sur Cloudflare Workers) — même
// mécanisme que le limiteur magic-link. Ce n'est pas un rate-limit distribué,
// mais il élimine l'abus trivial mono-IP. Un durcissement distribué (KV/DO)
// est un chantier séparé.

import {
  consumeRateLimit,
  createRateLimitStore,
  formatRetryAfter,
  type RateLimitRule,
  type RateLimitStore,
} from '@/lib/security/rate-limit'

export const PUBLIC_FORM_RATE_LIMIT: RateLimitRule = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
}

const apiRateLimitStore: RateLimitStore = createRateLimitStore()

/** IP de l'appelant depuis les en-têtes du proxy (Cloudflare en tête). */
export function clientIpFromRequest(request: Request): string {
  const headers = request.headers
  const forwarded = headers.get('cf-connecting-ip')
    ?? headers.get('x-real-ip')
    ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded && forwarded.length > 0 ? forwarded : 'unknown'
}

export interface ApiRateLimitResult {
  readonly allowed: boolean
  readonly response?: Response
}

/**
 * Applique la limite par (endpoint, IP). Retourne une réponse 429 prête à
 * renvoyer quand la limite est franchie.
 */
export function enforceApiRateLimit(
  request: Request,
  scope: string,
  rule: RateLimitRule = PUBLIC_FORM_RATE_LIMIT,
  store: RateLimitStore = apiRateLimitStore,
): ApiRateLimitResult {
  const status = consumeRateLimit({
    key: `${scope}:${clientIpFromRequest(request)}`,
    limit: rule.limit,
    windowMs: rule.windowMs,
    store,
  })
  if (status.allowed) return { allowed: true }

  return {
    allowed: false,
    response: new Response(
      JSON.stringify({
        ok: false,
        error: `Trop de tentatives. Réessayez dans ${formatRetryAfter(status.retryAfterMs)}.`,
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil(status.retryAfterMs / 1000)),
        },
      },
    ),
  }
}
