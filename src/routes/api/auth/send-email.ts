// POST /api/auth/send-email — hook Supabase Auth « Send Email ».
//
// Supabase appelle cette URL au lieu d'envoyer lui-même l'email de connexion.
// Le Worker vérifie la signature, construit le lien vers /auth/callback et
// expédie l'email de marque via Brevo. Contrat de réponse imposé par Supabase :
//
//   - 200 « {} »                               → l'email est parti ;
//   - { error: { http_code, message } } + statut → Supabase fait échouer
//     signInWithOtp, et la page de connexion affiche « Connexion indisponible ».
//     C'est VOULU : on ne renvoie jamais 200 si l'email n'est pas parti.
//
// Pas de contrôle d'origine ni de limite de débit par IP ici, volontairement :
// Supabase n'envoie pas d'en-tête Origin et ses adresses varient. La signature
// Standard Webhooks (secret partagé, horodatage ±5 min) est la seule porte, et
// Supabase applique déjà sa propre limite d'envoi en amont.
//
// Le hook dispose de 5 s : un seul appel Brevo par email, aucune nouvelle
// tentative. Jamais de token, de token_hash ni de lien complet dans les logs.

import { createFileRoute } from '@tanstack/react-router'

import {
  parseHookSecret,
  parseSendEmailPayload,
  planAuthEmails,
  verifyStandardWebhook,
} from '@/lib/auth/send-email-hook'
import { sendEmail } from '@/lib/email/server'
import { buildAuthEmail } from '@/lib/email/templates'

export interface SendEmailHookDeps {
  readonly send: typeof sendEmail
  readonly secret: () => string | undefined
  /** Horloge en millisecondes (Date.now), injectable pour les tests. */
  readonly now: () => number
}

const defaultDeps: SendEmailHookDeps = {
  send: sendEmail,
  secret: () => process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET,
  now: () => Date.now(),
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

/** Forme d'erreur attendue par Supabase : { error: { http_code, message } }. */
function hookError(
  status: number,
  message: string,
  headers: HeadersInit = {},
): Response {
  return jsonResponse(
    { error: { http_code: status, message } },
    { status, headers },
  )
}

export async function handleSendEmailHook(
  request: Request,
  deps: SendEmailHookDeps = defaultDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return hookError(405, 'method_not_allowed', { Allow: 'POST' })
  }

  const secret = parseHookSecret(deps.secret())
  if (!secret) {
    // Jamais d'envoi non signé : sans secret, l'endpoint refuse tout.
    console.error(
      'SUPABASE_SEND_EMAIL_HOOK_SECRET absent : l’email de connexion ne peut pas partir',
    )
    return hookError(503, 'hook_secret_missing')
  }

  const body = await request.text()
  const verification = await verifyStandardWebhook({
    headers: request.headers,
    body,
    secret,
    nowSeconds: Math.floor(deps.now() / 1000),
  })
  if (!verification.ok) {
    console.warn('send-email hook: signature refusée', {
      reason: verification.reason,
    })
    return hookError(401, `invalid_signature:${verification.reason}`)
  }

  let json: unknown = null
  try {
    json = JSON.parse(body)
  } catch {
    return hookError(400, 'invalid_json')
  }
  const parsed = parseSendEmailPayload(json)
  if (!parsed.ok) {
    console.warn('send-email hook: corps invalide', { error: parsed.error })
    return hookError(400, `invalid_payload: ${parsed.error}`)
  }

  const actionType = parsed.payload.email_data.email_action_type
  for (const planned of planAuthEmails(parsed.payload)) {
    const email = buildAuthEmail({
      kind: planned.kind,
      link: planned.link,
      code: planned.code,
      firstName: planned.firstName,
      noticeLabel: planned.noticeLabel,
    })
    const result = await deps.send({
      to: planned.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })
    if (!result.ok) {
      console.error('send-email hook: email non envoyé', {
        to: planned.to,
        kind: planned.kind,
        actionType,
        reason: result.reason,
      })
      return hookError(500, 'email_not_sent')
    }
    console.info('send-email hook: email envoyé', {
      kind: planned.kind,
      to: planned.to,
      actionType,
    })
  }

  return jsonResponse({}, { status: 200 })
}

export const Route = createFileRoute('/api/auth/send-email')({
  server: {
    handlers: {
      GET: () => hookError(405, 'method_not_allowed', { Allow: 'POST' }),
      POST: async ({ request }) => handleSendEmailHook(request),
    },
  },
})
