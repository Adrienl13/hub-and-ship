// POST /api/partner-requests — public partner channel intake.
//
// Captures partner applications and optional deal-registration drafts through
// a same-origin server endpoint so partner/prospect data never depends on a
// browser anon key and never exposes partner pricing rules publicly.

import { createFileRoute } from '@tanstack/react-router'

import {
  buildPartnerSubmissionDraft,
  type PartnerSubmissionInput,
} from '@/lib/partners/submission'
import {
  createPartnerSubmissionInSupabase,
  type PartnerSubmissionRepositoryClient,
} from '@/lib/partners/repository'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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

function isExpectedServerConfigGap(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Supabase admin client misconfigured')
  )
}

export async function handleCreatePartnerRequest(
  request: Request,
  client?: PartnerSubmissionRepositoryClient,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { ok: false, error: 'Forbidden origin' },
      { status: 403 },
    )
  }

  const draftResult = buildPartnerSubmissionDraft(
    (await readJson(request)) as PartnerSubmissionInput,
  )

  if (!draftResult.ok) {
    return jsonResponse(
      { ok: false, error: draftResult.error },
      { status: 400 },
    )
  }

  try {
    const persistenceClient =
      client ??
      (getSupabaseAdmin() as unknown as PartnerSubmissionRepositoryClient)
    const created = await createPartnerSubmissionInSupabase({
      client: persistenceClient,
      draft: draftResult.draft,
    })

    return jsonResponse(
      {
        ok: true,
        persisted: true,
        mode: draftResult.draft.mode,
        application: created.application,
        deal: created.deal,
      },
      { status: 201 },
    )
  } catch (error) {
    if (!isExpectedServerConfigGap(error)) {
      console.error('partner request api: persistence failed', error)
    }
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Partner request persistence failed',
      },
      { status: 503 },
    )
  }
}

export const Route = createFileRoute('/api/partner-requests')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handleCreatePartnerRequest(request),
    },
  },
})
