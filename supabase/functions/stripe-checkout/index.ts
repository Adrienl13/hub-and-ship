// Edge function : crée une Stripe Checkout Session pour le paiement
// des frais de réservation (3% plafonné).
//
// Appelée par le client après avoir créé une réservation
// (status='pending_payment'). Le webhook stripe-webhook met ensuite
// le statut à 'confirmed' à réception du payment_intent.succeeded.
//
// Déploiement : `supabase functions deploy stripe-checkout`
// Secrets requis :
//   - STRIPE_SECRET_KEY (sk_test_... ou sk_live_...)
//   - SITE_URL (pour les URLs de redirection)

interface CheckoutPayload {
  reservationId: string;
  reservationFeeEur: number; // ex: 300 = 300€
  customerEmail: string;
  containerRef: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const payload = (await req.json()) as CheckoutPayload;
  if (!payload?.reservationId || !payload.reservationFeeEur) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://container-club.fr";
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  // Stripe API en form-encoded
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][quantity]", "1");
  params.set(
    "line_items[0][price_data][currency]",
    "eur",
  );
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(Math.round(payload.reservationFeeEur * 100)),
  );
  params.set(
    "line_items[0][price_data][product_data][name]",
    `Réservation Container ${payload.containerRef}`,
  );
  params.set("customer_email", payload.customerEmail);
  params.set("client_reference_id", payload.reservationId);
  params.set("metadata[reservation_id]", payload.reservationId);
  params.set(
    "success_url",
    `${siteUrl}/compte?paid=${payload.reservationId}`,
  );
  params.set("cancel_url", `${siteUrl}/compte?cancelled=${payload.reservationId}`);

  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    console.error("[stripe-checkout] error:", resp.status, await resp.text());
    return new Response(JSON.stringify({ error: "stripe_failed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const session = await resp.json();
  return new Response(
    JSON.stringify({ url: session.url, id: session.id }),
    { headers: { ...CORS_HEADERS, "content-type": "application/json" } },
  );
});

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
