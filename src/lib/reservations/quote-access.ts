// Gated access to a reservation's official quote PDF (uploaded by an admin to
// the private `reservation-quotes` bucket). Mirrors quality-reports/access.ts,
// but additionally verifies the caller OWNS the reservation before signing.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { parseCookieHeader } from '@/lib/auth/cookies'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const inputSchema = z.object({
  reservationId: z.string().min(1),
})

export type GetQuoteUrlResult =
  | { ok: true; url: string; expiresIn: number }
  | {
      ok: false
      reason: 'auth_required' | 'forbidden' | 'no_file' | 'storage_unavailable'
    }

const SIGNED_URL_TTL_SECONDS = 60

export const getReservationQuoteUrl = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<GetQuoteUrlResult> => {
    const request = getRequest()
    const cookieEntries = parseCookieHeader(request.headers.get('cookie'))

    let userId: string | null = null
    let userEmail: string | null = null
    try {
      const sessionClient = createSupabaseServerClient({
        cookies: { getAll: () => cookieEntries },
      })
      const { data: userData } = await sessionClient.auth.getUser()
      userId = userData.user?.id ?? null
      userEmail = userData.user?.email?.toLowerCase() ?? null
    } catch (error) {
      console.warn('getReservationQuoteUrl: session client unavailable', error)
      return { ok: false, reason: 'auth_required' }
    }

    if (!userId) {
      return { ok: false, reason: 'auth_required' }
    }

    const admin = getSupabaseAdmin()
    const { data: row, error } = await admin
      .from('reservations')
      .select('*')
      .eq('id', data.reservationId)
      .maybeSingle<{
        quote_pdf_path: string | null
        user_id: string | null
        contact_snapshot: { email?: string } | null
      }>()

    if (error || !row) {
      return { ok: false, reason: 'no_file' }
    }

    const ownerEmail = row.contact_snapshot?.email?.toLowerCase() ?? null
    const owns =
      row.user_id === userId ||
      (userEmail !== null && ownerEmail !== null && ownerEmail === userEmail)
    if (!owns) {
      return { ok: false, reason: 'forbidden' }
    }

    if (!row.quote_pdf_path) {
      return { ok: false, reason: 'no_file' }
    }

    const { data: signed, error: signError } = await admin.storage
      .from('reservation-quotes')
      .createSignedUrl(row.quote_pdf_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      return { ok: false, reason: 'storage_unavailable' }
    }

    return { ok: true, url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }
  })
