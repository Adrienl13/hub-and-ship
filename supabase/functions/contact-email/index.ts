// Edge function : envoie un email à partir du formulaire de contact public.
// Déploiement : `supabase functions deploy contact-email`
// Secrets requis : RESEND_API_KEY (ou autre service transactionnel)

interface ContactPayload {
  name: string;
  email: string;
  company?: string;
  message: string;
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

  let payload: ContactPayload;
  try {
    payload = (await req.json()) as ContactPayload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  // Validation minimale
  if (
    !payload.name?.trim() ||
    !payload.email?.includes("@") ||
    !payload.message?.trim() ||
    payload.message.length < 10
  ) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const toEmail = Deno.env.get("CONTACT_TO_EMAIL") ?? "contact@container-club.fr";
  const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") ?? "noreply@container-club.fr";

  if (!apiKey) {
    console.error("[contact-email] RESEND_API_KEY non configurée");
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const subject = `Contact site — ${payload.company || payload.name}`;
  const html = `
    <h2>Nouveau message de contact</h2>
    <p><strong>Nom :</strong> ${escapeHtml(payload.name)}</p>
    <p><strong>Email :</strong> ${escapeHtml(payload.email)}</p>
    ${payload.company ? `<p><strong>Société :</strong> ${escapeHtml(payload.company)}</p>` : ""}
    <hr/>
    <p>${escapeHtml(payload.message).replace(/\n/g, "<br/>")}</p>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: payload.email,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[contact-email] Resend error:", resp.status, text);
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

// Deno global for type stubs (this file is run in Deno on Supabase, ignore TS errors locally)
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
