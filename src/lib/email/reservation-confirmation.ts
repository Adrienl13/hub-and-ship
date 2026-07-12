// Server function that triggers the post-reservation transactional emails
// (user + admin). Loads the reservation via the SERVICE ROLE client so the
// browser never sees the raw row; this also bypasses the write-only RLS
// posture of `reservations` for anon visitors.
//
// Honest non-configured state: when email is not configured the function
// returns `{ ok: true, skipped: true }` rather than throwing — the client UX
// already promises that we recontact within 24 h, so a missing email
// pipeline is a degraded mode, not a failure.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getAdminNotificationEmail,
  isEmailConfigured,
  sendEmail,
} from './server'
import {
  buildReservationCreatedEmailToAdmin,
  buildReservationCreatedEmailToUser,
  type ReservationEmailInput,
} from './templates'

const inputSchema = z.object({
  reservationId: z.string().uuid(),
})

export type SendReservationConfirmationResult =
  | { readonly ok: true; readonly skipped: false }
  | { readonly ok: true; readonly skipped: true; readonly reason: string }

interface ContactSnapshot {
  readonly name?: string
  readonly email?: string
  readonly company?: string
  readonly phone?: string
}

function readContactSnapshot(value: unknown): ContactSnapshot {
  if (!value || typeof value !== 'object') return {}
  return value as ContactSnapshot
}

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

export const sendReservationConfirmation = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<SendReservationConfirmationResult> => {
    if (!isEmailConfigured()) {
      return { ok: true, skipped: true, reason: 'not_configured' }
    }

    const supabase = getSupabaseAdmin()

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select(
        'id, reference, container_reference, siret, contact_snapshot, subtotal_ht, volume_discount, total_ht, total_ttc, pay_now',
      )
      .eq('id', data.reservationId)
      .maybeSingle()

    if (error) {
      console.error(
        'sendReservationConfirmation: reservation lookup failed',
        error,
      )
      return { ok: true, skipped: true, reason: 'reservation_lookup_failed' }
    }
    if (!reservation) {
      return { ok: true, skipped: true, reason: 'reservation_not_found' }
    }

    const { data: items, error: itemsError } = await supabase
      .from('reservation_items')
      .select('product_name, variant_name, quantity, subtotal_ht')
      .eq('reservation_id', reservation.id)

    if (itemsError) {
      console.error(
        'sendReservationConfirmation: items lookup failed',
        itemsError,
      )
      return { ok: true, skipped: true, reason: 'items_lookup_failed' }
    }

    const contact = readContactSnapshot(reservation.contact_snapshot)
    if (!contact.email) {
      return { ok: true, skipped: true, reason: 'no_contact_email' }
    }

    const origin = resolveOrigin(getRequest())

    const payload: ReservationEmailInput = {
      reference: reservation.reference,
      contactName: contact.name ?? 'Bonjour',
      contactCompany: contact.company ?? '',
      contactEmail: contact.email,
      contactPhone: contact.phone ?? '',
      siret: reservation.siret,
      containerReference: reservation.container_reference,
      subtotalHt: Number(reservation.subtotal_ht),
      volumeDiscount: Number(
        (reservation as { volume_discount?: number }).volume_discount ?? 0,
      ),
      totalHt: Number(reservation.total_ht),
      totalTtc: Number(reservation.total_ttc),
      payNow: Number(reservation.pay_now),
      lines: (items ?? []).map((item) => ({
        productName: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        subtotalHt: Number(item.subtotal_ht),
      })),
      accountUrl: `${origin}/account/reservations/${reservation.id}`,
    }

    const userEmail = buildReservationCreatedEmailToUser(payload)
    const adminEmail = buildReservationCreatedEmailToAdmin(payload)

    // Fire both in parallel; log individual failures but don't fail the
    // overall request — the reservation already exists in the DB.
    const [userResult, adminResult] = await Promise.all([
      sendEmail({
        to: contact.email,
        subject: userEmail.subject,
        html: userEmail.html,
        text: userEmail.text,
        replyTo: getAdminNotificationEmail(),
      }),
      sendEmail({
        to: getAdminNotificationEmail(),
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
        replyTo: contact.email,
      }),
    ])

    if (!userResult.ok) {
      console.error(
        'sendReservationConfirmation: user email failed',
        userResult,
      )
    }
    if (!adminResult.ok) {
      console.error(
        'sendReservationConfirmation: admin email failed',
        adminResult,
      )
    }

    return { ok: true, skipped: false }
  })
