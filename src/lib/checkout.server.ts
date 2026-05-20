// Stripe Checkout — server function that creates a Checkout Session for the
// reservation fee (Phase 2, fee-only). Called by the client right after the
// reservation row is inserted; returns the hosted Checkout URL.
//
// Security model:
//   - The client supplies ONLY the reservation id.
//   - This handler reads the reservation via the SERVICE ROLE client (RLS
//     bypassed) and uses ITS `reservation_fee_cents` — never a price sent by
//     the browser. Anti-tampering.
//   - If Stripe is not configured (no secret), we return `{ skipped: true }`
//     instead of throwing, so the client can fall back to the legacy "OK"
//     UX while the keys are being provisioned.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { getStripe, isStripeConfigured } from "./stripe.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

const inputSchema = z.object({
  reservationId: z.string().uuid(),
});

export type CreateCheckoutSessionResult =
  | {
      skipped: true;
      reason: "stripe_not_configured";
    }
  | {
      skipped: false;
      url: string;
      sessionId: string;
    };

/**
 * Derives the absolute origin the browser should be redirected back to.
 * Tries the `Origin` header first (set on `fetch()` calls), then `Referer`,
 * and finally falls back to the request URL itself. We avoid hardcoding a
 * domain so previews / local dev / production all work.
 */
function resolveOrigin(request: Request): string {
  const originHeader = request.headers.get("origin");
  if (originHeader) return originHeader;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore — fall through to request URL
    }
  }

  return new URL(request.url).origin;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<CreateCheckoutSessionResult> => {
    const supabase = getSupabaseAdmin();

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select(
        "id, email, name, company, container_reference, reservation_fee_cents, status, total_units",
      )
      .eq("id", data.reservationId)
      .maybeSingle();

    if (error) {
      // Surface the real DB error to the server logs but keep the client
      // message generic — we don't want to leak schema details.
      console.error("createCheckoutSession: supabase read failed", error);
      throw new Error("Reservation lookup failed");
    }

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    if (reservation.status !== "pending") {
      throw new Error(`Reservation is not pending (status=${reservation.status})`);
    }

    if (!isStripeConfigured()) {
      return { skipped: true, reason: "stripe_not_configured" };
    }

    const origin = resolveOrigin(getRequest());
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      locale: "fr",
      customer_email: reservation.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: reservation.reservation_fee_cents,
            product_data: {
              name: `Réservation Container Club ${reservation.container_reference}`,
              description: `${reservation.total_units} unités · ${reservation.company}`,
            },
          },
        },
      ],
      metadata: {
        reservation_id: reservation.id,
        container_reference: reservation.container_reference,
      },
      // Stripe substitutes {CHECKOUT_SESSION_ID} server-side; do not encode it.
      success_url: `${origin}/reservation/${reservation.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/reservation/${reservation.id}?canceled=true`,
    });

    if (!session.url) {
      // Per Stripe docs `url` is always present for `payment` mode sessions,
      // but TypeScript still types it as `string | null`. Treat the null case
      // as a real failure rather than crashing in the browser.
      throw new Error("Stripe did not return a Checkout URL");
    }

    return {
      skipped: false,
      url: session.url,
      sessionId: session.id,
    };
  });
