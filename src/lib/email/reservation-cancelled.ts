// Fired after an admin cancels a reservation from the back-office. Loads the
// row via the SERVICE ROLE client so the email content can't be tampered with
// from the browser and to bypass anon RLS on `reservations`.
//
// Returns `{ ok: true, skipped: true }` when RESEND_API_KEY is missing or the
// contact email is unknown — the cancellation is already persisted and the
// user can still be reached out-of-band.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getAdminNotificationEmail,
  isEmailConfigured,
  sendEmail,
} from './server'
import { buildReservationCancelledEmailToUser } from './templates'

const inputSchema = z.object({
  reservationId: z.string().uuid(),
})

export type SendReservationCancelledResult =
  | { readonly ok: true; readonly skipped: false }
  | { readonly ok: true; readonly skipped: true; readonly reason: string }

interface ContactSnapshot {
  readonly name?: string
  readonly email?: string
}

function readContactSnapshot(value: unknown): ContactSnapshot {
  if (!value || typeof value !== 'object') return {}
  return value as ContactSnapshot
}

export const sendReservationCancelled = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(
    async ({ data }): Promise<SendReservationCancelledResult> => {
      if (!isEmailConfigured()) {
        return { ok: true, skipped: true, reason: 'not_configured' }
      }

      const supabase = getSupabaseAdmin()

      const { data: reservation, error } = await supabase
        .from('reservations')
        .select(
          'id, reference, container_reference, contact_snapshot, cancellation_reason, paid_reservation_fee_at',
        )
        .eq('id', data.reservationId)
        .maybeSingle()

      if (error) {
        console.error(
          'sendReservationCancelled: reservation lookup failed',
          error,
        )
        return { ok: true, skipped: true, reason: 'reservation_lookup_failed' }
      }
      if (!reservation) {
        return { ok: true, skipped: true, reason: 'reservation_not_found' }
      }

      const contact = readContactSnapshot(reservation.contact_snapshot)
      if (!contact.email) {
        return { ok: true, skipped: true, reason: 'no_contact_email' }
      }

      const email = buildReservationCancelledEmailToUser({
        reference: reservation.reference,
        contactName: contact.name ?? 'Bonjour',
        containerReference: reservation.container_reference,
        cancellationReason: reservation.cancellation_reason,
        hasPaidReservationFee: Boolean(reservation.paid_reservation_fee_at),
      })

      const result = await sendEmail({
        to: contact.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: getAdminNotificationEmail(),
      })

      if (!result.ok) {
        console.error(
          'sendReservationCancelled: user email failed',
          result,
        )
        return { ok: true, skipped: true, reason: 'send_failed' }
      }

      return { ok: true, skipped: false }
    },
  )
