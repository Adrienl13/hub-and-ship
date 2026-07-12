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

## 2. Appliquer les migrations fusion (SQL Editor, dans cet ordre)

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
| 9 | `20260706110000_admin_pricing_engine_parity.sql` | parité moteur : get_price/landed_cost + admin_save_product_full (FOB dans la table PRIVÉE) — version miroir du fix privacy CODEX |
| 10 | `20260709090000_pricing_pilotage_p0.sql` | **P0 pilotage** : sauvegarde versionnée des paramètres + re-tampon du témoin, check_pricing_control, recalcul explicite (preview/apply), get_public_pricing_rules (paliers + frais, AUCUNE marge), create_reservation_with_items v4 (frais depuis paramètres) |
| 11 | `20260709120000_scoped_price_adjustment.sql` | Ajustement ciblé des prix : ±X % (borné -50..+100) sur une catégorie et/ou un préfixe SKU, preview → apply, admin only |
| 12 | `20260711120000_reservation_volume_discount.sql` | **Sprint 1 (C3)** : colonne `volume_discount` + create_reservation_with_items **v5** — remise volume (−6 %/−10 %, canal direct) appliquée au sous-total et revalidée ; durcit aussi pay_now = frais − parrainage |
| 13 | `20260711140000_pricing_guardrails.sql` | **Sprint 2 (M1/M2/M9)** : bornes CHECK sur pricing_parameters (NOT VALID, écritures futures), plancher de marge SQL sur les 2 tables de prix nets partenaires, purge des overrides invalides après changement de base_price_ht |
| 14 | `20260711160000_bistro_tables_moq_fix.sql` | **Sprint 3 (M4)** : MOQ des 7 tables bistro alignés sur le réel (50 → 20 unités) dans products + descriptions |
| 15 | `20260711170000_users_profile_signup_repair.sql` | **Sprint 3 (M14)** : SECOND trigger sur auth.users → handle_new_user (users_profile) + backfill des comptes créés depuis la casse du 20/05 — répare toute la chaîne canal (current_company_id) |
| 16 | `20260711180000_admin_create_partner_code.sql` | **Sprint 3 (M13)** : RPC admin_create_partner_code — provisionne la société (résolution SIRET d'abord), relie users_profile, génère le code AP-XXXXXX (unicité case-insensitive + retry + verrou anti-concurrence), refuse les candidatures non approuvées, admin only (is_admin). Inclut claim_partner_access **v2** : un partenaire qui crée son compte APRÈS la génération du code est rattaché à sa société au premier login |
| 17 | `20260711190000_selection_snapshot_price_repair.sql` | **Sprint 3 (M11 rétroactif)** : retamponne les snapshots de sélections partenaires déjà persistés au prix PUBLIC (les anciennes sélections d'un revendeur figeaient son prix NET, servi aux anonymes sur /p/slug) |

> Migrations 1-8 déjà appliquées le 08-09/07, 9-10 le 09/07. **Ordre
> impératif** : appliquer 11 → 12 → 13 → 14 → 15 → 16 → 17 (12 remplace le
> RPC de réservation en v5 ; 13 s'appuie sur les fonctions des migrations
> précédentes ; 16 dépend du backfill users_profile de 15) AVANT le deploy du
> code. Le code Sprint 1+2+3 et les migrations 12-17 vont ENSEMBLE : déploie
> le code juste après avoir passé les migrations (l'ancien code envoie des
> payloads sans `volume_discount`, tolérés par v5 ; mais le nouveau code avec
> l'ancien RPC refuserait les paniers ≥ 100 unités, et le bouton « Générer le
> code » de l'onglet Partenaires échouerait sans la migration 16).

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

-- Après la migration 12 (remise volume) : la colonne existe (défaut 0) :
select column_name from information_schema.columns
where table_name = 'reservations' and column_name = 'volume_discount';

-- Après la migration 13 (garde-fous) : les triggers de plancher/purge sont là :
select tgname from pg_trigger
where tgname in ('product_partner_prices_floor', 'products_prune_overrides');

-- Après la migration 14 (MOQ bistro) : les 7 tables sont à 20 unités :
select sku, moq_units from public.products
where sku in ('BIS-031','BIS-032','BIS-033','BIS-034','BIS-036','BIS-038','BIS-042');

-- Après la migration 15 (réparation signup) : les DEUX triggers coexistent
-- et plus aucun compte n'est orphelin de users_profile (doit rendre 0) :
select tgname from pg_trigger
where tgname in ('on_auth_user_created', 'on_auth_user_created_profile');
select count(*) from auth.users u
where not exists (select 1 from public.users_profile p where p.id = u.id);

-- Après la migration 16 (code partenaire) : le RPC existe, l'index
-- d'unicité case-insensitive est en place et la colonne de rattachement
-- candidature → société existe :
select proname from pg_proc where proname = 'admin_create_partner_code';
select indexname from pg_indexes
where indexname = 'partner_codes_code_lower_uidx';
select column_name from information_schema.columns
where table_name = 'partner_applications' and column_name = 'company_id';

-- Après la migration 17 (snapshots sélections) : plus aucun snapshot ne
-- diverge du prix public courant (doit rendre 0) :
select count(*) from public.partner_selection_items psi
join public.products p on p.id::text = psi.product_id
where psi.product_snapshot ? 'basePriceHt'
  and (psi.product_snapshot -> 'basePriceHt') is distinct from to_jsonb(p.base_price_ht);

-- Après les migrations 9-10 (pilotage P0) :
-- Les règles publiques ne rendent QUE paliers + frais (7 clés, aucune marge) :
select public.get_public_pricing_rules();
-- NE PAS appeler check_pricing_control() depuis le SQL Editor : la session
-- n'est pas authentifiée, la fonction refuse avec « caller is not admin » —
-- c'est le garde-fou qui fonctionne. La vérification du témoin se fait dans
-- l'admin (bandeau de l'onglet Catalogue). Équivalent sans guard :
select p2.control_sku, p2.control_direct_price_ht,
       (select id from public.products p
        where p.sku = p2.control_sku or p.id = p2.control_sku
        limit 1) as produit_resolu
from public.pricing_parameters p2 where p2.is_active;
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
  20260706090000 20260706100000 20260706110000 20260709090000 \
  20260709120000
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
