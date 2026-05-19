// Edge function : envoie un devis PDF au pro qui a fait une réservation.
// Appelée depuis /compte ou depuis l'OrderSidebar via le bouton "Devis par email".
//
// Stub : la génération PDF reste actuellement côté client (lib/quote.ts).
// Cette function envoie un email contenant le récap + un lien.
//
// Déploiement : `supabase functions deploy quote-email`
// Secrets requis : RESEND_API_KEY

interface QuotePayload {
  reservationId?: string; // si déjà persisté
  to: string;
  containerRef: string;
  port: string;
  subtotalHt: number;
  reservationFee: number;
  payAt80Percent: number;
  payBeforeShipping: number;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceHt: number;
  }>;
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

  const payload = (await req.json()) as QuotePayload;
  if (!payload?.to?.includes("@") || !payload.items?.length) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const itemsRows = payload.items
    .map(
      (it) =>
        `<tr>
          <td>${it.quantity}× ${escapeHtml(it.productName)} — ${escapeHtml(it.variantName)}</td>
          <td style="text-align:right">${formatEUR(it.unitPriceHt * it.quantity)}</td>
        </tr>`,
    )
    .join("");

  const html = `
    <h1 style="font-family:sans-serif">Devis Container Club</h1>
    <p>Container ${escapeHtml(payload.containerRef)} · Destination ${escapeHtml(payload.port)}</p>
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif">
      ${itemsRows}
      <tr><td colspan="2"><hr/></td></tr>
      <tr><td>Sous-total HT</td><td style="text-align:right"><strong>${formatEUR(payload.subtotalHt)}</strong></td></tr>
      <tr><td>Acompte payé</td><td style="text-align:right">${formatEUR(payload.reservationFee)}</td></tr>
      <tr><td>À régler à 80% remplissage</td><td style="text-align:right">${formatEUR(payload.payAt80Percent)}</td></tr>
      <tr><td>Solde avant expédition</td><td style="text-align:right">${formatEUR(payload.payBeforeShipping)}</td></tr>
    </table>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("CONTACT_FROM_EMAIL") ?? "noreply@container-club.fr",
      to: [payload.to],
      subject: `Votre devis Container Club — ${payload.containerRef}`,
      html,
    }),
  });

  if (!resp.ok) {
    console.error("[quote-email] Resend error:", resp.status, await resp.text());
    return new Response(JSON.stringify({ error: "send_failed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
