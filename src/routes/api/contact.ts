// POST /api/contact — réception publique du formulaire de contact.
//
// Depuis la migration contact_requests, la table est la source de vérité :
// chaque demande valide y est enregistrée AVANT l'email (clé anon, même
// modèle que /api/stock-requests), puis l'admin est notifié (Reply-To =
// demandeur) et le demandeur reçoit un accusé. L'insertion est tolérante :
// si la base refuse, on journalise et l'email part quand même — jamais de
// 503 à cause de la base. L'email reste, lui, bloquant : sans notification
// le lead serait perdu en silence derrière un « Message envoyé », donc 503
// et l'UI propose l'adresse directe.

import { createFileRoute } from '@tanstack/react-router'

import { buildContactMessageDraft, CONTACT_TOPIC_LABEL } from '@/lib/contact'
import {
  insertContactRequest,
  type ContactRequestRepositoryClient,
} from '@/lib/contact-requests/repository'
import { notifyContactMessage } from '@/lib/email/notify-leads'
import { enforceApiRateLimit } from '@/lib/security/api-rate-limit'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
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

// Client anon côté serveur : la politique RLS publique n'autorise que
// l'insertion d'un lead « new ». Sans clés Supabase (dev local sans .env),
// on prévient une fois et l'email reste le seul canal.
let warnedMissingConfig = false
function resolvePublicClient(): ContactRequestRepositoryClient | null {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      console.warn(
        'contact api: Supabase public config missing, contact requests are not persisted',
      )
    }
    return null
  }
  return createSupabaseBrowserClient(
    config,
  ) as unknown as ContactRequestRepositoryClient
}

export async function handleContactMessage(
  request: Request,
  notify: typeof notifyContactMessage = notifyContactMessage,
  client?: ContactRequestRepositoryClient | null,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { ok: false, error: 'Forbidden origin' },
      { status: 403 },
    )
  }

  const limited = enforceApiRateLimit(request, 'contact')
  if (!limited.allowed) return limited.response!

  const draftResult = buildContactMessageDraft(await readJson(request))
  if (!draftResult.ok) {
    return jsonResponse(
      { ok: false, error: draftResult.error },
      { status: 400 },
    )
  }
  const draft = draftResult.draft

  // 1. Base d'abord : la table est la source de vérité du suivi admin.
  // L'état de persistance ne sort jamais dans la réponse publique (il
  // révélerait l'état de l'infrastructure) : il reste dans les logs serveur.
  let persisted = false
  try {
    const persistenceClient =
      client === undefined ? resolvePublicClient() : client
    if (persistenceClient) {
      await insertContactRequest(persistenceClient, draft)
      persisted = true
    }
  } catch (error) {
    console.error('contact api: persistence failed', error)
  }
  if (!persisted) {
    console.warn('contact api: contact request not persisted, email only')
  }

  // 2. Puis l'email, notification et accusé de réception.
  try {
    await notify({
      name: draft.name,
      email: draft.email,
      company: draft.company,
      phone: draft.phone,
      topicLabel: CONTACT_TOPIC_LABEL[draft.topic],
      message: draft.message,
      attribution: draft.attribution,
    })
    return jsonResponse({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('contact api: notification failed', error)
    return jsonResponse(
      { ok: false, error: 'Envoi impossible pour le moment' },
      { status: 503 },
    )
  }
}

export const Route = createFileRoute('/api/contact')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handleContactMessage(request),
    },
  },
})
