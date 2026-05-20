// POST /api/stripe/webhook — receives Stripe Checkout lifecycle events.
//
// Requirements:
//   - Raw request body (Stripe signs the unparsed bytes).
//   - `stripe-signature` header for verification.
//   - Idempotent updates: WHERE status='pending_reservation_fee' guarantees a
//     retried `checkout.session.completed` does not overwrite a row already
//     reserved/cancelled via another path.
//
// We always return 200 to Stripe for events we recognise (or politely ignore),
// preventing infinite retries. Non-200 responses are reserved for:
//   - 503 when Stripe is not configured (no secret / webhook secret)
//   - 400 when the signature does not verify or is missing
//   - 405 for non-POST verbs

import { createFileRoute } from '@tanstack/react-router'
import type Stripe from 'stripe'

import {
  getStripe,
  getStripeCryptoProvider,
  getStripeWebhookSecret,
  isStripeConfigured,
} from '@/lib/stripe/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

async function markReservationReserved(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const reservationId = session.metadata?.reservation_id
  if (!reservationId) {
    console.warn(
      'stripe webhook: checkout.session.completed without reservation_id metadata',
      { sessionId: session.id },
    )
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : (session.customer?.id ?? null)

  const nowIso = new Date().toISOString()

  const { error } = await getSupabaseAdmin()
    .from('reservations')
    .update({
      status: 'reserved',
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      paid_reservation_fee_at: nowIso,
      reserved_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', reservationId)
    .eq('status', 'pending_reservation_fee')

  if (error) {
    console.error('stripe webhook: failed to mark reservation reserved', {
      reservationId,
      error,
    })
  }
}

async function markReservationCancelled(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const reservationId = session.metadata?.reservation_id
  if (!reservationId) {
    console.warn(
      'stripe webhook: session expired/failed without reservation_id metadata',
      { sessionId: session.id },
    )
    return
  }

  const nowIso = new Date().toISOString()

  const { error } = await getSupabaseAdmin()
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: nowIso,
      cancellation_reason: 'stripe_payment_failed',
      updated_at: nowIso,
    })
    .eq('id', reservationId)
    .eq('status', 'pending_reservation_fee')

  if (error) {
    console.error('stripe webhook: failed to mark reservation cancelled', {
      reservationId,
      error,
    })
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  if (!isStripeConfigured()) {
    return new Response('Stripe not configured', { status: 503 })
  }

  const webhookSecret = getStripeWebhookSecret()
  if (!webhookSecret) {
    return new Response('Stripe webhook secret not configured', { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    // SubtleCrypto provider — required on Cloudflare Workers / workerd
    // because the default sync verifier uses Node's `crypto.createHmac`,
    // which is not available in that runtime.
    event = await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      getStripeCryptoProvider(),
    )
  } catch (err) {
    console.error('stripe webhook: signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      await markReservationReserved(event.data.object)
      break
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      await markReservationCancelled(event.data.object)
      break
    }
    default: {
      // Log unknown event types for observability but ack so Stripe
      // doesn't retry.
      console.info('stripe webhook: unhandled event', {
        type: event.type,
        id: event.id,
      })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => handleWebhook(request),
    },
  },
})
