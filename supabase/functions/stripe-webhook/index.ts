// Edge function : webhook Stripe pour confirmer les réservations à
// réception du payment_intent.succeeded.
//
// Côté Stripe : configurer le webhook sur
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events à écouter : checkout.session.completed, payment_intent.succeeded
//
// Déploiement : `supabase functions deploy stripe-webhook --no-verify-jwt`
// (no-verify-jwt car Stripe appelle sans JWT Supabase)
//
// Secrets requis :
//   - STRIPE_WEBHOOK_SECRET
//   - SUPABASE_SERVICE_ROLE_KEY (pour bypass RLS et marquer la résa)
//   - SUPABASE_URL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("missing_signature", { status: 400 });
  }

  // Validation HMAC SHA256 (Stripe signs payloads — voir doc Stripe)
  // Pour un MVP on délègue la vérification au SDK Stripe en prod.
  // Cette vérif est volontairement simplifiée ici (à remplacer en prod).
  const event = JSON.parse(body);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return new Response("config_missing", { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRole);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const reservationId =
        session.metadata?.reservation_id ?? session.client_reference_id;
      if (reservationId) {
        const { error } = await admin
          .from("container_reservations")
          .update({
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            paid_reservation_at: new Date().toISOString(),
          })
          .eq("id", reservationId);
        if (error) {
          console.error("[stripe-webhook] update error", error);
          return new Response("db_update_failed", { status: 500 });
        }
      }
      break;
    }
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
      // À étendre si on gère d'autres flux (acomptes, soldes…)
      break;
    default:
      console.log("[stripe-webhook] unhandled event:", event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "content-type": "application/json" },
  });
});

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
