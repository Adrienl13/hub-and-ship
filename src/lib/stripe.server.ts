// Server-only Stripe SDK wrapper.
//
// The Stripe SDK ships a worker-compatible build (`stripe.esm.worker.js`) that
// Wrangler / Vite picks up automatically via the `workerd` / `worker` export
// condition — no manual aliasing is required. We still pass an explicit
// `httpClient` so the SDK uses the global `fetch` available in Workers rather
// than trying to instantiate Node's `http` module.
//
// All env reads go through `process.env`. The Worker runtime exposes secrets
// and text vars on `process.env` thanks to `compatibility_flags: ["nodejs_compat"]`
// (see `wrangler.jsonc`).

import Stripe from "stripe";

let cachedClient: Stripe | null = null;
let cachedCryptoProvider: ReturnType<typeof Stripe.createSubtleCryptoProvider> | null = null;

/** True when `STRIPE_SECRET_KEY` is set. Used by callers to short-circuit. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Returns the configured webhook secret or `null` (instead of throwing). */
export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

/**
 * Returns a singleton `Stripe` instance. Throws if the secret key is missing —
 * callers MUST gate calls behind `isStripeConfigured()` to keep the
 * "fallback OFF" behaviour described in the integration plan.
 */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Configure the secret (wrangler secret put) " +
        "or guard the call site with isStripeConfigured().",
    );
  }

  cachedClient = new Stripe(secretKey, {
    // `Stripe.createFetchHttpClient` returns an httpClient that relies on the
    // global `fetch` — required on Cloudflare Workers / workerd.
    httpClient: Stripe.createFetchHttpClient(),
  });

  return cachedClient;
}

/**
 * SubtleCrypto-backed provider used for webhook signature verification.
 * Cloudflare Workers / workerd do not ship Node's `crypto.createHmac`, so the
 * default sync `constructEvent` will fail — we must call `constructEventAsync`
 * and pass this provider explicitly.
 */
export function getStripeCryptoProvider() {
  if (cachedCryptoProvider) return cachedCryptoProvider;
  cachedCryptoProvider = Stripe.createSubtleCryptoProvider();
  return cachedCryptoProvider;
}
