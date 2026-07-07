# Runbook — Déploiement de la fusion (DB puis code)

> Contexte : la prod Supabase contient des migrations CODEX non commitées
> (re-timestampées, dont le moteur `pricing_parameters`). `supabase db push`
> échoue donc sur « Remote migration versions not found ». Ce runbook applique
> les migrations de la branche fusion SANS toucher au tracking des migrations
> prod existantes. **Ne jamais lancer `supabase migration repair --status
> reverted`** : cela abandonnerait le suivi de ~50 vraies migrations prod.

## Ordre absolu : migrations d'abord, deploy ensuite

Le code de la fusion appelle `get_catalogue_prices()` et lit les nouvelles
colonnes : déployer le worker avant la base casserait le catalogue canal et
le formulaire partenaires.

## 1. Sauvegarde

Dashboard Supabase → Database → Backups : vérifier qu'un backup récent existe
(ou déclencher un backup manuel / noter le point PITR).

## 2. Appliquer les 6 migrations fusion (SQL Editor, dans cet ordre)

Toutes sont **additives et idempotentes** (`if not exists`, `create or
replace`, seeds `on conflict do nothing`) — les rejouer est sans danger.

| # | Fichier | Ce que ça crée |
|---|---------|----------------|
| 1 | `20260702100000_attribution_columns.sql` | utm_* + partner_ref sur reservations / stock_requests |
| 2 | `20260702120000_sales_channels.sql` | enum sales_channel, companies.channel (trigger admin-only), channel_coefficients, channel_price_overrides (règle d'or), RPC get_catalogue_prices + current_channel |
| 3 | `20260702130000_commission_ledger.sql` | partner_codes, commission_ledger (accrual idempotent), companies.referred_by/at |
| 4 | `20260702140000_partner_self_read.sql` | RLS self-read espace partenaire |
| 5 | `20260703140000_partner_applications_extend.sql` | enum partner_target_status + colonnes mockup/attribution sur partner_applications |
| 6 | `20260705090000_pricing_engine_bridge.sql` | rapatrie pricing_parameters & co (no-op en prod), get_catalogue_prices v2 (marges actives), désactive le parrainage B2C |
| 7 | `20260706090000_payment_reminders.sql` | colonnes + index des relances impayés (J+1/J+3) |
| 8 | `20260706100000_reservation_rpc_channel_attribution.sql` | create_reservation_with_items v3 : validation au prix CANAL du caller + persistance utm_*/partner_ref |

Procédure : ouvrir chaque fichier depuis `supabase/migrations/`, copier tout,
coller dans le SQL Editor, Run. Une erreur = STOP, me coller le message.

## 3. Vérifications post-migrations (SQL Editor)

```sql
-- Le RPC résout les prix direct pour un anonyme (doit rendre ~165 lignes) :
select count(*) from public.get_catalogue_prices();

-- Le moteur est intact et actif (1 ligne, is_active = true) :
select version, label, is_active, direct_margin_rate, tier3_discount
from public.pricing_parameters order by version;

-- Le parrainage B2C est bien coupé :
select is_active from public.referral_program_settings;

-- Les nouvelles colonnes candidatures existent :
select column_name from information_schema.columns
where table_name = 'partner_applications'
  and column_name in ('activity_profile','target_status','partner_ref');
```

Attendu : count > 0, `is_active=true` côté pricing, `is_active=false` côté
parrainage, 3 colonnes listées.

## 4. (Optionnel, recommandé) Enregistrer le tracking

Pour que `supabase migration list` reflète la réalité, marquer les 6 versions
comme appliquées (ceci ÉCRIT dans la table de tracking, ne touche pas au
schéma) :

```bash
supabase migration repair --status applied 20260702100000 20260702120000 \
  20260702130000 20260702140000 20260703140000 20260705090000 \
  20260706090000 20260706100000
```

## 5. Déployer le code

Depuis le Mac, dans le dossier du projet :

```bash
git fetch origin claude/fusion-network-v2
git checkout claude/fusion-network-v2
git pull origin claude/fusion-network-v2
bun install
bun run deploy
```

## 6. Smoke tests post-deploy (2 minutes)

- `/` : badge container SANS fausse date de clôture ; prix catalogue inchangés
  en anonyme (canal direct).
- `/partenaires` : page mockup, formulaire → toast « Candidature envoyée »,
  la candidature apparaît dans Admin → Partenaires (+ email Brevo).
- Checkout : le panneau s'appelle « Code apporteur » (plus de promesse
  −100 €) ; « À payer aujourd'hui » = frais de réservation pleins.
- `/account/parrainage` : pitch apporteur 8 % (plus de code −100 €).
- `robots.txt` : `Allow: /partenaires` présent ; `sitemap.xml` contient `/avis`.
- Admin → Commissions : saisir l'id d'une réservation test payée avec un code
  partenaire → l'accrual 8 % s'écrit une seule fois (relancer = no-op).

## Rollback

- Parrainage : ré-activable en 1 clic (Admin → Parrainage) ou
  `update referral_program_settings set is_active = true;`
- Les migrations sont additives : aucun drop, aucune donnée modifiée hors le
  kill switch ci-dessus. Un rollback code = redéployer le commit précédent.
