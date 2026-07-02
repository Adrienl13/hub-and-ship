// Emails fired when a new partner_applications row is created:
//   1. admin notification (to triage the candidature)
//   2. candidate acknowledgement ("réponse sous 48h")
//
// Re-fetches the row via the service-role client so the content can't be
// tampered with from the browser and to bypass the write-only RLS posture on
// `partner_applications` for anon visitors.
//
// Returns `{ ok: true, skipped: true }` when RESEND_API_KEY is missing so the
// candidature funnel keeps working in dev / degraded mode.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  PARTNER_ACTIVITY_PROFILE_LABEL,
  PARTNER_TARGET_STATUS_LABEL,
  type PartnerActivityProfile,
} from '@/lib/partner-applications'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { PartnerTargetStatus } from '@/lib/supabase/types'
import {
  getAdminNotificationEmail,
  isEmailConfigured,
  sendEmail,
} from './server'
import {
  buildPartnerApplicationAckToUser,
  buildPartnerApplicationNotificationToAdmin,
} from './templates'

const inputSchema = z.object({
  partnerApplicationId: z.string().uuid(),
})

export type SendPartnerApplicationNotificationResult =
  | { readonly ok: true; readonly skipped: false }
  | { readonly ok: true; readonly skipped: true; readonly reason: string }

function resolveOrigin(request: Request): string {
  const originHeader = request.headers.get('origin')
  if (originHeader) return originHeader
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      // fall through
    }
  }
  return new URL(request.url).origin
}

function activityProfileLabel(value: string): string {
  return (
    PARTNER_ACTIVITY_PROFILE_LABEL[value as PartnerActivityProfile] ?? value
  )
}

function targetStatusLabel(value: PartnerTargetStatus): string {
  return PARTNER_TARGET_STATUS_LABEL[value] ?? value
}

export const sendPartnerApplicationNotification = createServerFn({
  method: 'POST',
})
  .inputValidator(inputSchema)
  .handler(
    async ({ data }): Promise<SendPartnerApplicationNotificationResult> => {
      if (!isEmailConfigured()) {
        return { ok: true, skipped: true, reason: 'not_configured' }
      }

      const supabase = getSupabaseAdmin()

      const { data: row, error } = await supabase
        .from('partner_applications')
        .select(
          'id, company_name, siret, siret_verified, contact_name, email, phone, activity_profile, target_status, zone, estimated_volume, message, partner_ref, utm_source',
        )
        .eq('id', data.partnerApplicationId)
        .maybeSingle()

      if (error) {
        console.error(
          'sendPartnerApplicationNotification: lookup failed',
          error,
        )
        return { ok: true, skipped: true, reason: 'lookup_failed' }
      }
      if (!row) {
        return { ok: true, skipped: true, reason: 'not_found' }
      }

      const origin = resolveOrigin(getRequest())
      const adminUrl = `${origin}/admin?tab=partner-applications`
      const statusLabel = targetStatusLabel(row.target_status)

      const adminEmail = buildPartnerApplicationNotificationToAdmin({
        reference: row.id,
        companyName: row.company_name,
        siret: row.siret,
        siretVerified: row.siret_verified,
        contactName: row.contact_name,
        email: row.email,
        phone: row.phone,
        activityProfileLabel: activityProfileLabel(row.activity_profile),
        targetStatusLabel: statusLabel,
        zone: row.zone,
        estimatedVolume: row.estimated_volume,
        message: row.message,
        partnerRef: row.partner_ref,
        utmSource: row.utm_source,
        adminUrl,
      })

      const ackEmail = buildPartnerApplicationAckToUser({
        companyName: row.company_name,
        contactName: row.contact_name,
        targetStatusLabel: statusLabel,
      })

      const [adminResult, ackResult] = await Promise.all([
        sendEmail({
          to: getAdminNotificationEmail(),
          subject: adminEmail.subject,
          html: adminEmail.html,
          text: adminEmail.text,
          replyTo: row.email,
        }),
        sendEmail({
          to: row.email,
          subject: ackEmail.subject,
          html: ackEmail.html,
          text: ackEmail.text,
        }),
      ])

      if (!adminResult.ok) {
        console.error(
          'sendPartnerApplicationNotification: admin email failed',
          adminResult,
        )
      }
      if (!ackResult.ok) {
        console.error(
          'sendPartnerApplicationNotification: ack email failed',
          ackResult,
        )
      }

      if (!adminResult.ok && !ackResult.ok) {
        return { ok: true, skipped: true, reason: 'send_failed' }
      }

      return { ok: true, skipped: false }
    },
  )
