// POST /api/stripe/webhook — receives Stripe Checkout lifecycle events.
//
// Requirements:
//   - Raw request body (Stripe signs the unparsed bytes).
//   - `stripe-signature` header for verification.
//   - Idempotent updates: status filters prevent retries from overwriting a
//     settled row; expired/failed sessions also match the current
//     stripe_checkout_session_id so an old session cannot cancel a newer one.
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
import {
  createAccountAccessLink,
  type MagicLinkAdminClient,
} from '@/lib/auth/magic-link'
import { notifyPaymentConfirmed } from '@/lib/email/notify-leads'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  markReservationCancelled,
  markReservationReserved,
  type WebhookReservationClient,
} from '@/lib/stripe/webhook-handlers'

async function handleWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed()
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
      const session = event.data.object
      await markReservationReserved({
        client: getSupabaseAdmin() as unknown as WebhookReservationClient,
        session,
      })
      // Notify (no-op when email is not configured); never fail the webhook.
      try {
        const customerEmail = session.customer_details?.email ?? null
        // Deliver the sign-in promised at checkout: a guest buyer gets an
        // account (email pre-confirmed by the payment) + a one-time link;
        // claim_my_reservations attaches their reservations on first visit.
        const accountAccessLink = customerEmail
          ? await createAccountAccessLink({
              client: getSupabaseAdmin() as unknown as MagicLinkAdminClient,
              email: customerEmail,
              redirectTo: 'https://prosimport.com/account/reservations',
            })
          : null
        await notifyPaymentConfirmed({
          reference: session.metadata?.reference ?? 'réservation',
          containerReference: session.metadata?.container_reference ?? '',
          customerEmail,
          amountPaid:
            typeof session.amount_total === 'number'
              ? session.amount_total / 100
              : null,
          accountAccessLink,
        })
      } catch (notifyError) {
        console.error('stripe webhook: payment email failed', notifyError)
      }
      break
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      await markReservationCancelled({
        client: getSupabaseAdmin() as unknown as WebhookReservationClient,
        session: event.data.object,
      })
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

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handleWebhook(request),
    },
  },
})
