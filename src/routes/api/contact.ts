// POST /api/contact — public contact form intake.
//
// No DB table: a contact message is an email conversation. The endpoint
// validates server-side, notifies the admin (Reply-To = requester) and sends
// an acknowledgement. Email failures surface as 503 so the UI can offer the
// mailto fallback instead of pretending the message went through.

import { createFileRoute } from '@tanstack/react-router'

import { buildContactMessageDraft, CONTACT_TOPIC_LABEL } from '@/lib/contact'
import { notifyContactMessage } from '@/lib/email/notify-leads'

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

export async function handleContactMessage(
  request: Request,
  notify: typeof notifyContactMessage = notifyContactMessage,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { ok: false, error: 'Forbidden origin' },
      { status: 403 },
    )
  }

  const draftResult = buildContactMessageDraft(await readJson(request))
  if (!draftResult.ok) {
    return jsonResponse(
      { ok: false, error: draftResult.error },
      { status: 400 },
    )
  }

  try {
    await notify({
      name: draftResult.draft.name,
      email: draftResult.draft.email,
      company: draftResult.draft.company,
      phone: draftResult.draft.phone,
      topicLabel: CONTACT_TOPIC_LABEL[draftResult.draft.topic],
      message: draftResult.draft.message,
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
