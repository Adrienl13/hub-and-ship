# Stripe Checkout — Setup (mode test)

## Vue d'ensemble

On encaisse via Stripe Checkout (mode redirect) **uniquement les frais de réservation** : 3 % de la commande, plancher 150 €, plafond 500 €. Le reste de la commande est réglé hors Stripe, à la livraison du container.

Tant que le flux n'est pas validé bout en bout, **on reste en mode test Stripe**. Aucune carte réelle, aucun mouvement d'argent.

Si les secrets Stripe ne sont pas posés (clé secrète ou webhook), le code retombe sur un **fallback "contact manuel sous 24 h"** : la réservation est enregistrée mais aucun paiement n'est déclenché. Pas de plantage côté client.

---

## 1. Côté Stripe Dashboard

1. Créer un compte Stripe : <https://dashboard.stripe.com/register>.
2. Activer le **mode test** via le toggle en haut à droite du dashboard (libellé "Test mode"). Tout ce qui suit se fait en mode test.
3. Récupérer les clés API depuis **Developers → API keys** :
   - `Publishable key` (`pk_test_*`) — non utilisée pour Checkout redirect côté serveur. À noter quand même, on en aura besoin si on bascule plus tard sur Stripe.js (Elements).
   - `Secret key` (`sk_test_*`) — c'est celle qu'on va injecter dans les secrets serveur.
4. Configurer le **webhook endpoint** :
   - **Developers → Webhooks → Add endpoint**.
   - **URL** : `https://<your-cloudflare-worker-url>/api/stripe/webhook`
     - En dev local : **ne pas** créer d'endpoint dans le dashboard. Utiliser à la place **Stripe CLI** :
       ```bash
       stripe listen --forward-to localhost:8080/api/stripe/webhook
       ```
       La commande affiche un `whsec_*` local à utiliser comme `STRIPE_WEBHOOK_SECRET` dans `.env`.
   - **Events to send** :
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `checkout.session.async_payment_failed`
   - Une fois l'endpoint créé, récupérer le **Signing secret** (`whsec_*`) dans l'écran de détail du webhook.

---

## 2. Côté Supabase

1. Ouvrir le dashboard du projet autorisé (`mkfztwibolswqcggukeq`) → **Settings → API**.
2. Copier la clé `service_role`.
   - ⚠️ Cette clé **bypass RLS**. Elle ne doit **jamais** être exposée côté browser, ni commitée en clair, ni partagée hors environnement serveur. Elle sert uniquement au webhook Stripe pour mettre à jour `reservations.status = 'paid'`.

---

## 3. Côté Cloudflare Workers (production)

Depuis la racine du projet :

```bash
cd hub-and-ship
bunx wrangler secret put STRIPE_SECRET_KEY
# coller sk_test_... (puis Entrée)

bunx wrangler secret put STRIPE_WEBHOOK_SECRET
# coller whsec_... (puis Entrée)

bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# coller la clé service_role Supabase (puis Entrée)
```

Vérifier la présence des 3 secrets :

```bash
bunx wrangler secret list
```

On doit voir `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` dans la liste.

---

## 4. Côté dev local (`.env`)

Le fichier `.env` (gitignored, ne **jamais** commit) doit contenir, en plus des `VITE_SUPABASE_*` existants :

```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

Vite, en mode dev, charge automatiquement ces variables côté serveur uniquement. Elles ne sont **pas** exposées dans le bundle client puisqu'elles n'ont pas le préfixe `VITE_`. Ne jamais leur ajouter ce préfixe — sinon elles fuitent dans le browser.

---

## 5. Test du flux complet

Dans un premier terminal :

```bash
bun run dev
```

Dans un second terminal :

```bash
# Installation de Stripe CLI (une seule fois)
brew install stripe/stripe-cli/stripe
stripe login

# Forward des webhooks vers l'app locale
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

Le `whsec_*` affiché par `stripe listen` doit correspondre à celui dans `.env` (sinon le copier-coller dans `.env` et redémarrer `bun run dev`).

Puis :

1. Ouvrir <http://localhost:8080>.
2. Soumettre une réservation.
3. Sur la page Stripe Checkout, utiliser :
   - **Numéro de carte** : `4242 4242 4242 4242`
   - **Date d'expiration** : n'importe quelle date future (ex. `12/34`)
   - **CVC** : n'importe quel code à 3 chiffres (ex. `123`)
   - **Code postal** : n'importe quel code valide
4. Valider le paiement.
5. Vérifier dans Supabase (`reservations`) que la ligne a bien :
   - `status = 'paid'`
   - `stripe_payment_intent_id` rempli

Autres cartes test utiles (<https://docs.stripe.com/testing>) :

- `4000 0000 0000 9995` — paiement refusé (insufficient funds)
- `4000 0025 0000 3155` — déclenche 3D Secure

---

## 6. Mode prod (plus tard)

À faire **seulement** quand le flux test est validé :

1. Basculer en **mode live** sur Stripe (toggle en haut à droite).
2. Récupérer les nouvelles clés : `sk_live_*` et reconfigurer un webhook live → nouveau `whsec_*`.
3. Re-pusher les secrets Cloudflare avec les valeurs live :
   ```bash
   bunx wrangler secret put STRIPE_SECRET_KEY        # sk_live_...
   bunx wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_... (live)
   ```
4. Pointer le webhook endpoint Stripe vers l'URL Cloudflare de prod (`https://<worker-prod-url>/api/stripe/webhook`).
5. Tester avec **une vraie carte sur un petit montant** (ex. réservation de test à 150 € de frais), puis rembourser depuis le dashboard Stripe, avant d'ouvrir au public.

---

## 7. Sécurité (rappels)

- **JAMAIS** commit `.env`, `sk_*`, `whsec_*`, ni la clé `service_role` en clair. Ils sont gitignored — vérifier `git status` avant chaque commit.
- **JAMAIS** de préfixe `VITE_` sur ces secrets : tout ce qui est préfixé `VITE_` finit dans le bundle browser.
- Le webhook doit **toujours** vérifier la signature Stripe via `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`. Sans cette vérification, n'importe qui peut appeler l'endpoint et marquer une réservation comme payée.
- Le serveur **re-lit** `reservation_fee_cents` depuis la base de données (à partir de l'`id` de réservation) avant de créer la Checkout Session. **Jamais** depuis un montant passé par le client — sinon trivial à falsifier côté browser.
- En cas de fuite suspectée d'un secret : révoquer immédiatement depuis le dashboard Stripe (Developers → API keys → Roll key) ou Supabase (Settings → API → Reset service_role), puis re-`wrangler secret put`.
