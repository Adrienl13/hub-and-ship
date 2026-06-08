// POST /api/stock-requests — server-side fallback for urgent 24h stock leads.
//
// The public page first tries the browser Supabase insert, but this endpoint
// lets production keep capturing leads when anon env keys/RLS drift. It
// rebuilds the draft from the stock line id instead of trusting price/product
// snapshots sent by the browser.

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { getAvailableStockLineById } from '@/lib/stock'
import { buildStockRequestDraft } from '@/lib/stock-requests'
import {
  createStockRequestInSupabase,
  type StockRequestRepositoryClient,
} from '@/lib/stock-requests.repository'
import { notifyStockRequest } from '@/lib/email/notify-leads'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const stockRequestApiSchema = z.object({
  stockLineId: z.string().trim().min(1),
  companyName: z.string().trim().min(2).max(160),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().min(6).max(40),
  requestedQuantity: z.number().int().positive().max(10_000),
  customerNote: z.string().trim().max(500).optional().nullable(),
})

type StockRequestApiInput = z.infer<typeof stockRequestApiSchema>

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

function buildDraftFromInput(input: StockRequestApiInput) {
  const line = getAvailableStockLineById(input.stockLineId)
  if (!line) {
    return {
      ok: false as const,
      response: jsonResponse(
        { ok: false, error: 'Stock line not found' },
        { status: 404 },
      ),
    }
  }

  const draftResult = buildStockRequestDraft({
    line,
    companyName: input.companyName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    requestedQuantity: input.requestedQuantity,
    customerNote: input.customerNote ?? undefined,
  })

  if (!draftResult.ok) {
    return {
      ok: false as const,
      response: jsonResponse(
        {
          ok: false,
          error:
            draftResult.issues[0]?.message ?? 'Invalid stock request payload',
        },
        { status: 400 },
      ),
    }
  }

  return { ok: true as const, draft: draftResult.draft }
}

function isExpectedServerConfigGap(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Supabase admin client misconfigured')
  )
}

export async function handleCreateStockRequest(
  request: Request,
  client?: StockRequestRepositoryClient,
): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed()
  }

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { ok: false, error: 'Forbidden origin' },
      { status: 403 },
    )
  }

  const parsed = stockRequestApiSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? 'Invalid stock request payload',
      },
      { status: 400 },
    )
  }

  const draftResult = buildDraftFromInput(parsed.data)
  if (!draftResult.ok) return draftResult.response

  try {
    const persistenceClient =
      client ?? (getSupabaseAdmin() as unknown as StockRequestRepositoryClient)
    const created = await createStockRequestInSupabase({
      client: persistenceClient,
      draft: draftResult.draft,
    })

    // Fire notifications, but never let an email failure break lead capture.
    try {
      const d = draftResult.draft
      await notifyStockRequest({
        companyName: d.companyName,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone,
        productName: d.productName,
        requestedQuantity: d.requestedQuantity,
        estimatedTotalHt: d.estimatedTotalHt,
        customerNote: d.customerNote ?? null,
      })
    } catch (notifyError) {
      console.error('stock request api: notification failed', notifyError)
    }

    return jsonResponse(
      {
        ok: true,
        persisted: true,
        request: created,
      },
      { status: 201 },
    )
  } catch (error) {
    if (!isExpectedServerConfigGap(error)) {
      console.error('stock request api: persistence failed', error)
    }
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Stock request persistence failed',
      },
      { status: 503 },
    )
  }
}

export const Route = createFileRoute('/api/stock-requests')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handleCreateStockRequest(request),
    },
  },
})
