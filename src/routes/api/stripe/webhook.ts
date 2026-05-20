// POST /api/stripe/webhook — receives Stripe Checkout lifecycle events.
//
// Requirements:
//   - Raw request body (Stripe signs the unparsed bytes).
//   - `stripe-signature` header for verification.
//   - Idempotent updates (WHERE status = 'pending' ensures a retried
//     `checkout.session.completed` does not overwrite a row already paid /
//     refunded by another path).
//
// We always return 200 to Stripe for events we recognise, even when the
// update is a no-op — that prevents Stripe from retrying indefinitely. The
// only non-200 responses are:
//   - 503 when Stripe is not configured (no secret / webhook secret)
//   - 400 when the signature does not verify
//   - 405 for non-POST verbs

import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import {
  getStripe,
  getStripeCryptoProvider,
  getStripeWebhookSecret,
  isStripeConfigured,
} from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

type PaidUpdate = {
  status: "paid";
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  updated_at: string;
};

type ExpiredUpdate = {
  status: "expired";
  updated_at: string;
};

async function markReservationPaid(session: Stripe.Checkout.Session): Promise<void> {
  const reservationId = session.metadata?.reservation_id;
  if (!reservationId) {
    console.warn("stripe webhook: checkout.session.completed without reservation_id metadata", {
      sessionId: session.id,
    });
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);

  const update: PaidUpdate = {
    status: "paid",
    stripe_payment_intent_id: paymentIntentId,
    stripe_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin()
    .from("reservations")
    .update(update)
    .eq("id", reservationId)
    .eq("status", "pending");

  if (error) {
    console.error("stripe webhook: failed to mark reservation paid", {
      reservationId,
      error,
    });
  }
}

async function markReservationExpired(session: Stripe.Checkout.Session): Promise<void> {
  const reservationId = session.metadata?.reservation_id;
  if (!reservationId) {
    console.warn("stripe webhook: session expired without reservation_id metadata", {
      sessionId: session.id,
    });
    return;
  }

  const update: ExpiredUpdate = {
    status: "expired",
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin()
    .from("reservations")
    .update(update)
    .eq("id", reservationId)
    .eq("status", "pending");

  if (error) {
    console.error("stripe webhook: failed to mark reservation expired", {
      reservationId,
      error,
    });
  }
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isStripeConfigured()) {
          return new Response("Stripe not configured", { status: 503 });
        }

        const webhookSecret = getStripeWebhookSecret();
        if (!webhookSecret) {
          return new Response("Stripe webhook secret not configured", { status: 503 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("Missing stripe-signature header", { status: 400 });
        }

        const rawBody = await request.text();

        let event: Stripe.Event;
        try {
          // SubtleCrypto provider — required on Cloudflare Workers / workerd
          // because the default sync verifier uses Node's `crypto.createHmac`,
          // which is not available in this runtime.
          event = await getStripe().webhooks.constructEventAsync(
            rawBody,
            signature,
            webhookSecret,
            undefined,
            getStripeCryptoProvider(),
          );
        } catch (err) {
          console.error("stripe webhook: signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        switch (event.type) {
          case "checkout.session.completed": {
            await markReservationPaid(event.data.object);
            break;
          }
          case "checkout.session.expired":
          case "checkout.session.async_payment_failed": {
            await markReservationExpired(event.data.object);
            break;
          }
          default: {
            // Log unknown event types for observability but ack so Stripe
            // doesn't retry.
            console.info("stripe webhook: unhandled event", { type: event.type, id: event.id });
          }
        }

        return Response.json({ received: true }, { status: 200 });
      },
    },
  },
});
