# Runbook — Relances automatiques (réservations impayées)

## Ce qui existe

`POST /api/cron/payment-reminders` relance les réservations bloquées en
`pending_reservation_fee` :

- **J+1** (24 h après création) : rappel doux « votre place n'est pas encore
  verrouillée ».
- **J+3** (72 h, et ≥ 24 h après la 1re relance) : dernier rappel « votre
  place sera libérée ».
- **Maximum 2 relances** par réservation, à vie. L'email contient un magic
  link qui connecte le client directement sur sa page de réservation avec le
  bouton « régler ». Idempotent : deux exécutions simultanées ne peuvent pas
  envoyer deux fois (verrou par compteur conditionnel).

Prérequis : migration `20260706090000_payment_reminders.sql` appliquée.

## Configuration (2 minutes)

1. **Secret** : générer une valeur aléatoire longue et la poser en secret
   Workers :
   ```bash
   openssl rand -hex 32          # copier la valeur
   npx wrangler secret put CRON_SECRET
   ```
2. **Scheduler** — au choix (il faut UN déclencheur qui appelle l'endpoint
   toutes les heures) :

   **Option A — cron-job.org (recommandé : gratuit, 0 code)**
   Créer un job horaire → URL `https://prosimport.com/api/cron/payment-reminders`,
   méthode POST, header `x-cron-secret: <valeur>`.

   **Option B — Supabase pg_cron + pg_net**
   ```sql
   select cron.schedule('payment-reminders', '15 * * * *', $$
     select net.http_post(
       url := 'https://prosimport.com/api/cron/payment-reminders',
       headers := '{"x-cron-secret": "<valeur>"}'::jsonb
     );
   $$);
   ```
   (nécessite les extensions pg_cron + pg_net activées dans le dashboard).

3. **Supabase Auth** : vérifier que
   `https://prosimport.com/account/reservations/*` est dans Auth → URL
   Configuration → Redirect URLs (sinon le magic link retombe sur l'accueil —
   le paiement reste accessible après connexion manuelle).

## Vérifier que ça tourne

```bash
# Sans secret → 403 (endpoint protégé) :
curl -s -X POST https://prosimport.com/api/cron/payment-reminders -o /dev/null -w "%{http_code}\n"

# Avec secret → 200 + bilan JSON :
curl -s -X POST https://prosimport.com/api/cron/payment-reminders \
  -H "x-cron-secret: <valeur>" | jq
# → {"ok":true,"scanned":N,"due":n,"sent":n,"failures":[]}
```

En base : `select reference, payment_reminder_count, payment_reminder_last_at
from reservations where status = 'pending_reservation_fee';`

## Étendre plus tard

Le même endpoint/pattern accueillera : accusé notify_leads, campagne
« container ouvert », demande d'avis J+7 post-livraison (roadmap
STRATEGIE_IA_2026.md, D1b-e).
