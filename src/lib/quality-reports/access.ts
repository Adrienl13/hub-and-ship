// Gated access to quality-report PDFs. Public metadata stays exposed via
// the browser client (cf. RLS policy "Public reads published quality reports"),
// but the actual file lives in a PRIVATE Supabase Storage bucket and is
// only handed out as a short-lived signed URL to authenticated users.
//
// Architecture note (why a server fn rather than an API route):
//   - Stripe checkout already uses `createServerFn` in this codebase, so
//     we get the same lifecycle/error surface for free.
//   - The signed URL has to be generated server-side because the bucket is
//     private and the SDK helper requires the service-role key (or an authed
//     session that has explicit storage policies — we have neither in
//     production yet, so service-role is the simplest path that still gates
//     on user auth).

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { generateSignedFileUrl } from './repository'
import { parseCookieHeader } from '@/lib/auth/cookies'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const inputSchema = z.object({
  reportId: z.string().uuid(),
})

export type GetReportFileUrlResult =
  | { ok: true; url: string; expiresIn: number }
  | {
      ok: false
      reason: 'auth_required' | 'not_found' | 'no_file' | 'storage_unavailable'
    }

const SIGNED_URL_TTL_SECONDS = 60

export const getReportFileUrl = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<GetReportFileUrlResult> => {
    // 1) Resolve the requesting user from the inbound cookie header. We use
    //    the SSR-aware client (not the service role) so RLS / auth applies.
    const request = getRequest()
    const cookieEntries = parseCookieHeader(request.headers.get('cookie'))

    let userId: string | null = null
    try {
      const sessionClient = createSupabaseServerClient({
        cookies: { getAll: () => cookieEntries },
      })
      const { data: userData } = await sessionClient.auth.getUser()
      userId = userData.user?.id ?? null
    } catch (error) {
      // Supabase env missing in this runtime — treat as "auth not wired up"
      // rather than crashing the public page.
      console.warn('getReportFileUrl: session client unavailable', error)
      return { ok: false, reason: 'auth_required' }
    }

    if (!userId) {
      return { ok: false, reason: 'auth_required' }
    }

    // 2) Read the report row via the admin client (bypassing RLS) so we
    //    can fetch the `file_path` regardless of who owns it. The user is
    //    already proven to be authed above.
    const admin = getSupabaseAdmin()
    const { data: report, error } = await admin
      .from('quality_reports')
      .select('id, file_path, is_active, published_at')
      .eq('id', data.reportId)
      .maybeSingle()

    if (error) {
      console.error('getReportFileUrl: supabase read failed', error)
      return { ok: false, reason: 'not_found' }
    }

    if (!report || !report.is_active || !report.published_at) {
      return { ok: false, reason: 'not_found' }
    }

    if (!report.file_path) {
      return { ok: false, reason: 'no_file' }
    }

    // 3) Sign the URL. We use the admin client because the storage bucket
    //    is private and we have not yet shipped per-user storage policies.
    const signedUrl = await generateSignedFileUrl(
      admin,
      report.file_path,
      SIGNED_URL_TTL_SECONDS,
    )

    if (!signedUrl) {
      // Most likely the bucket has not been created yet — see the comment
      // in `repository.ts::generateSignedFileUrl`.
      return { ok: false, reason: 'storage_unavailable' }
    }

    return {
      ok: true,
      url: signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    }
  })
