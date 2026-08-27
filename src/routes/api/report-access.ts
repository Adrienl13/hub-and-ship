// /api/report-access — demande d'accès aux rapports de tests & certifications.
//
// Les rapports SGS ne sont PAS téléchargeables par n'importe quel compte :
// le professionnel demande l'accès (prénom, nom, email, téléphone, SIREN),
// l'admin valide, puis le téléchargement (getReportFileUrl) exige un compte
// connecté dont la demande est approuvée.
//
// POST  — création de la demande (public, rate-limité, insert service role :
//         pas de policy INSERT anon sur la table) + email de notification admin.
// PATCH — décision admin (approve/reject). L'update passe par le client de
//         SESSION (cookies) : la policy RLS « admin » fait office de contrôle
//         d'accès — pas de logique de rôle à dupliquer ici. L'email « accès
//         validé » ne part que si l'update a réellement abouti.

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import {
  notifyReportAccessApproved,
  notifyReportAccessRequest,
} from '@/lib/email/notify-leads'
import { enforceApiRateLimit } from '@/lib/security/api-rate-limit'
import { parseCookieHeader } from '@/lib/auth/cookies'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { validateSirenFormat } from '@/lib/validation/siret'

const createSchema = z.object({
  firstName: z.string().trim().min(2, 'Prénom requis').max(80),
  lastName: z.string().trim().min(2, 'Nom requis').max(80),
  email: z.string().trim().email('Email invalide').max(254),
  phone: z.string().trim().min(6, 'Téléphone requis').max(40),
  siren: z.string().trim().min(9, 'SIREN requis').max(20),
})

const decideSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  adminNote: z.string().trim().max(500).optional(),
})

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
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

/** Utilisateur connecté (via cookies) — null si anonyme ou env absente. */
async function resolveSessionUser(
  request: Request,
): Promise<{ id: string; email: string | null } | null> {
  try {
    const cookieEntries = parseCookieHeader(request.headers.get('cookie'))
    const sessionClient = createSupabaseServerClient({
      cookies: { getAll: () => cookieEntries },
    })
    const { data } = await sessionClient.auth.getUser()
    if (!data.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  } catch {
    return null
  }
}

export async function handleCreateReportAccessRequest(
  request: Request,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ ok: false, error: 'Forbidden origin' }, { status: 403 })
  }

  const limited = enforceApiRateLimit(request, 'report-access')
  if (!limited.allowed) return limited.response!

  const parsed = createSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonResponse(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Demande invalide' },
      { status: 400 },
    )
  }

  const siren = validateSirenFormat(parsed.data.siren)
  if (!siren.valid) {
    return jsonResponse(
      { ok: false, error: siren.reason ?? 'SIREN invalide' },
      { status: 400 },
    )
  }

  const email = parsed.data.email.toLowerCase()
  const sessionUser = await resolveSessionUser(request)

  try {
    const admin = getSupabaseAdmin()

    // Une demande vivante par email : renvoyer son statut plutôt que
    // d'échouer — la personne sait immédiatement où elle en est.
    const { data: existing } = await admin
      .from('report_access_requests')
      .select('id, status')
      .ilike('email', email)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existing) {
      return jsonResponse({ ok: true, status: existing.status, already: true })
    }

    const { error: insertError } = await admin
      .from('report_access_requests')
      .insert({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        email,
        phone: parsed.data.phone,
        siren: siren.cleaned,
        user_id: sessionUser?.id ?? null,
      })

    if (insertError) {
      // Course sur l'index unique (double clic) : la demande existe déjà.
      if (insertError.code === '23505') {
        return jsonResponse({ ok: true, status: 'pending', already: true })
      }
      throw new Error(insertError.message)
    }

    try {
      await notifyReportAccessRequest({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        phone: parsed.data.phone,
        siren: siren.cleaned,
      })
    } catch (notifyError) {
      console.error('report access: admin notification failed', notifyError)
    }

    return jsonResponse({ ok: true, status: 'pending' }, { status: 201 })
  } catch (error) {
    console.error('report access: persistence failed', error)
    return jsonResponse(
      { ok: false, error: 'Enregistrement impossible, réessayez dans un instant.' },
      { status: 503 },
    )
  }
}

export async function handleDecideReportAccessRequest(
  request: Request,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ ok: false, error: 'Forbidden origin' }, { status: 403 })
  }

  const parsed = decideSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonResponse(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Décision invalide' },
      { status: 400 },
    )
  }

  const cookieEntries = parseCookieHeader(request.headers.get('cookie'))
  let sessionClient
  try {
    sessionClient = createSupabaseServerClient({
      cookies: { getAll: () => cookieEntries },
    })
  } catch {
    return jsonResponse({ ok: false, error: 'Auth indisponible' }, { status: 401 })
  }

  const { data: userData } = await sessionClient.auth.getUser()
  if (!userData.user) {
    return jsonResponse({ ok: false, error: 'Connexion requise' }, { status: 401 })
  }

  // L'update passe par la session : la policy RLS admin est le contrôle
  // d'accès. 0 ligne touchée = pas admin (ou demande inexistante) → 403.
  const { data: updatedRaw, error: updateError } = await sessionClient
    .from('report_access_requests')
    .update({
      status: parsed.data.decision,
      admin_note: parsed.data.adminNote ?? null,
      decided_at: new Date().toISOString(),
      decided_by: userData.user.id,
      updated_at: new Date().toISOString(),
      // Même contournement de typage que les updates admin existants
      // (cf. AdminQualityReportsTab) : la version de supabase-js du projet
      // résout mal les génériques d'Update.
    } as never)
    .eq('id', parsed.data.requestId)
    .select('id, first_name, email, status')
    .maybeSingle()

  const updated = updatedRaw as {
    id: string
    first_name: string
    email: string
    status: 'pending' | 'approved' | 'rejected'
  } | null

  if (updateError || !updated) {
    return jsonResponse(
      { ok: false, error: updateError?.message ?? 'Accès refusé (admin requis).' },
      { status: 403 },
    )
  }

  if (updated.status === 'approved') {
    try {
      await notifyReportAccessApproved({
        firstName: updated.first_name,
        email: updated.email,
      })
    } catch (notifyError) {
      console.error('report access: approval email failed', notifyError)
    }
  }

  return jsonResponse({ ok: true, status: updated.status })
}

export const Route = createFileRoute('/api/report-access')({
  server: {
    handlers: {
      GET: () =>
        jsonResponse(
          { ok: false, error: 'Method Not Allowed' },
          { status: 405, headers: { Allow: 'POST, PATCH' } },
        ),
      POST: async ({ request }) => handleCreateReportAccessRequest(request),
      PATCH: async ({ request }) => handleDecideReportAccessRequest(request),
    },
  },
})
