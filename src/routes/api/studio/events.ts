// POST /api/studio/events — ingestion des événements Studio (lot 2).
//
// Sécurité (pattern /api/contact) : POST uniquement, origin-check,
// enforceApiRateLimit, validation zod stricte, écriture via le client admin
// (service_role) UNIQUEMENT ici, côté serveur. Le navigateur n'a aucun droit
// direct sur studio_sessions / studio_events. Aucune PII n'est acceptée
// (le schéma refuse toute clé inconnue).

import { createFileRoute } from '@tanstack/react-router'

import { enforceApiRateLimit } from '@/lib/security/api-rate-limit'
import type { RateLimitRule } from '@/lib/security/rate-limit'
import { parseStudioEventsBatch } from '@/lib/studio/events'
import { recordStudioEvents, type StudioEventsClient } from '@/lib/studio/events-server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/** Un envoi par lot (≤ 20 événements) : 60 lots / 10 min par IP suffisent à
 *  une session active sans ouvrir la porte à un flot. */
export const STUDIO_EVENTS_RATE_LIMIT: RateLimitRule = {
  limit: 60,
  windowMs: 10 * 60 * 1000,
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...init.headers },
  })
}

function methodNotAllowed(): Response {
  return jsonResponse(
    { ok: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  )
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export interface StudioEventsHandlerDeps {
  readonly client?: () => StudioEventsClient
  readonly rateLimit?: (request: Request) => { allowed: boolean; response?: Response }
  readonly now?: () => Date
}

export async function handleStudioEvents(
  request: Request,
  deps: StudioEventsHandlerDeps = {},
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ ok: false, error: 'Forbidden origin' }, { status: 403 })
  }

  const limited = (deps.rateLimit ?? ((r) => enforceApiRateLimit(r, 'studio-events', STUDIO_EVENTS_RATE_LIMIT)))(request)
  if (!limited.allowed) return limited.response!

  const parsed = parseStudioEventsBatch(await readJson(request))
  if (!parsed.ok || !parsed.batch) {
    return jsonResponse({ ok: false, error: parsed.error ?? 'invalid' }, { status: 400 })
  }

  let client: StudioEventsClient
  try {
    client = (deps.client ?? (() => getSupabaseAdmin() as unknown as StudioEventsClient))()
  } catch (error) {
    console.error('studio events api: admin client unavailable', error)
    return jsonResponse({ ok: false, error: 'Mesure indisponible' }, { status: 503 })
  }

  const result = await recordStudioEvents(client, parsed.batch, (deps.now ?? (() => new Date()))())
  if (!result.ok) {
    console.error('studio events api: insert failed', result.error)
    return jsonResponse({ ok: false, error: 'Mesure indisponible' }, { status: 503 })
  }
  return jsonResponse({ ok: true, inserted: result.inserted }, { status: 202 })
}

export const Route = createFileRoute('/api/studio/events')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handleStudioEvents(request),
    },
  },
})
