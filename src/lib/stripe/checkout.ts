// Stripe Checkout — server function that creates a Checkout Session for the
// reservation fee only (mode redirect). Called by the client right after the
// reservation row is inserted; returns the hosted Checkout URL.
//
// Security model:
//   - The client supplies ONLY the reservation id (uuid).
//   - This handler reads the reservation via the SERVICE ROLE client (RLS
//     bypassed) and uses its `reservation_fee` value — never a price sent by
//     the browser. Anti-tampering.
//   - If Stripe is not configured (no secret), we return `{ skipped: true }`
//     instead of throwing, so the client can fall back to the legacy "OK"
//     UX while the keys are being provisioned.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured } from './server'

const inputSchema = z.object({
  reservationId: z.string().uuid(),
})

export type CreateCheckoutSessionResult =
  | {
      skipped: true
      reason: 'stripe_not_configured'
    }
  | {
      skipped: false
      url: string
      sessionId: string
    }

type ReservationContactSnapshot = {
  readonly email?: string | null
  readonly name?: string | null
  readonly company?: string | null
  readonly phone?: string | null
}

function extractContactEmail(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const email = (snapshot as ReservationContactSnapshot).email
  return typeof email === 'string' && email.length > 0 ? email : null
}

/**
 * Derives the absolute origin the browser should be redirected back to.
 * Tries the `Origin` header first (set on fetch() calls), then `Referer`,
 * and finally falls back to the request URL itself. We avoid hardcoding a
 * domain so previews / local dev / production all work.
 */
function resolveOrigin(request: Request): string {
  const originHeader = request.headers.get('origin')
  if (originHeader) return originHeader

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      // ignore — fall through to request URL
    }
  }

  return new URL(request.url).origin
}

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<CreateCheckoutSessionResult> => {
    const supabase = getSupabaseAdmin()

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select(
        'id, reference, reservation_fee, contact_snapshot, status, container_reference, requested_container_type',
      )
      .eq('id', data.reservationId)
      .maybeSingle()

    if (error) {
      // Surface the real DB error to the server logs but keep the client
      // message generic — we don't want to leak schema details.
      console.error('createCheckoutSession: supabase read failed', error)
      throw new Error('Reservation lookup failed')
    }

    if (!reservation) {
      throw new Error('Reservation not found')
    }

    if (reservation.status !== 'pending_reservation_fee') {
      throw new Error(
        `Reservation is not pending_reservation_fee (status=${reservation.status})`,
      )
    }

    if (!isStripeConfigured()) {
      return { skipped: true, reason: 'stripe_not_configured' }
    }

    const origin = resolveOrigin(getRequest())
    const stripe = getStripe()
    const customerEmail = extractContactEmail(reservation.contact_snapshot)
    const unitAmount = Math.round(Number(reservation.reservation_fee) * 100)

    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      throw new Error(
        `Invalid reservation_fee for ${reservation.id} (got=${reservation.reservation_fee})`,
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      locale: 'fr',
      customer_email: customerEmail ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: unitAmount,
            product_data: {
              name: `Réservation Container Club ${reservation.container_reference}`,
              description: `Frais de réservation · ${reservation.reference}`,
            },
          },
        },
      ],
      metadata: {
        reservation_id: reservation.id,
        reference: reservation.reference,
        container_reference: reservation.container_reference,
        // Surface the requested ISO format so the ops team sees in the
        // Stripe Dashboard which payments belong to distributor-scale
        // 40' demand orders (vs a standard 20' group-buy).
        requested_container_type: reservation.requested_container_type ?? '',
      },
      // Stripe substitutes {CHECKOUT_SESSION_ID} server-side; do not encode it.
      success_url: `${origin}/account/reservations/${reservation.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/account/reservations/${reservation.id}?canceled=true`,
    })

    if (!session.url) {
      // Per Stripe docs `url` is always present for `payment` mode sessions,
      // but TypeScript still types it as `string | null`. Treat the null case
      // as a real failure rather than crashing in the browser.
      throw new Error('Stripe did not return a Checkout URL')
    }

    // Best-effort: persist the session id on the reservation so we can
    // correlate webhook events with the row even if metadata drift occurs.
    const { error: updateError } = await supabase
      .from('reservations')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', reservation.id)

    if (updateError) {
      console.error(
        'createCheckoutSession: failed to persist stripe_checkout_session_id',
        { reservationId: reservation.id, error: updateError },
      )
      // Do not fail the checkout for this — the webhook still works via
      // metadata.reservation_id.
    }

    return {
      skipped: false,
      url: session.url,
      sessionId: session.id,
    }
  })
