# Supabase Edge Functions

Stubs prêts à brancher. Chaque function est un fichier `index.ts` autonome
qui tourne en Deno sur l'infrastructure Supabase.

## Functions disponibles

| Function | Rôle | Secrets requis |
|---|---|---|
| `contact-email` | Envoie un email depuis le formulaire `/contact` | `RESEND_API_KEY`, `CONTACT_TO_EMAIL` |
| `quote-email` | Envoie un devis HTML à un pro | `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` |
| `stripe-checkout` | Crée une Stripe Checkout Session pour les frais de réservation | `STRIPE_SECRET_KEY`, `SITE_URL` |
| `stripe-webhook` | Reçoit les events Stripe et marque les résas `confirmed` | `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` |

## Déploiement

```bash
# Une fois linké au projet via supabase link
supabase functions deploy contact-email
supabase functions deploy quote-email
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` est requis uniquement pour le webhook Stripe (l'appel
vient de Stripe, pas d'un client Supabase authentifié).

## Secrets

```bash
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set CONTACT_TO_EMAIL="contact@container-club.fr"
supabase secrets set CONTACT_FROM_EMAIL="noreply@container-club.fr"
supabase secrets set STRIPE_SECRET_KEY="sk_test_..."
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
supabase secrets set SITE_URL="https://container-club.fr"
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont automatiquement
injectés par Supabase dans les edge functions.

## Côté front

À brancher ensuite :

```ts
// Exemple dans ReservationDialog après createReservation()
const { data, error } = await supabase.functions.invoke("stripe-checkout", {
  body: {
    reservationId,
    reservationFeeEur: totals.payNow,
    customerEmail: user.email,
    containerRef: container.reference,
  },
});
if (data?.url) window.location.href = data.url;
```

## Configuration Stripe

1. Dashboard Stripe → Developers → Webhooks → Add endpoint
2. URL : `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events :
   - `checkout.session.completed`
   - `payment_intent.succeeded` (optionnel pour acomptes)
4. Copier le signing secret → `supabase secrets set STRIPE_WEBHOOK_SECRET=...`
