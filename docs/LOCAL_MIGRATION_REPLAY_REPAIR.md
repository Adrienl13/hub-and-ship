# Fresh-local-replay repair — chaîne historique Supabase

Validation du 9 septembre 2026, branche `codex/studio-lot-4-bring`, départ `7325ece2f323c5ec6409ea13171b2cf1531d7abb`. Arbre propre et branche vérifiés avant modification. Le Lot 4 reste CODE REVIEW PASSED ; aucune feature Studio ajoutée.

## Audit avant correction

Recherche dans toutes les migrations et tout `src` des références `reservation_status`, `pending_payment`, `confirmed`, `pending_reservation_fee`, `reserved`, `container_reservations`, `container_reservation_items`, `container_variant_commitments`. Recherche complémentaire dans tout le dépôt et l'historique Git. Les occurrences de `confirmed`/`reserved` relevant des deals partenaires, du stock ou d'états visuels ne désignent pas l'enum des réservations.

- `20260518162000_reservation_foundation.sql` crée le cycle actuel à neuf statuts : draft, pending_reservation_fee, reserved, deposit_called, deposit_paid, in_production, in_transit, delivered, cancelled. Il appartient à `reservations` et `reservation_items`.
- `20260520101823_rattrapage_schema.sql` récupère un modèle parallèle : `container_reservations`, `container_reservation_items`, `container_seed_commitments`, `container_variant_commitments`. Sa création conditionnelle de la même enum publique ne complète pas une enum existante. Son défaut, sa vue et ses politiques utilisent pourtant pending_payment/confirmed/cancelled. C'est la cause racine du premier échec.
- Les migrations Stripe, insertion anon, RPC de création, revalidation, attribution et remise volume continuent à utiliser pending_reservation_fee/reserved sur **reservations**. Aucune migration suivante ne renomme les deux anciens statuts, ne transforme les tables historiques ni ne sépare leur enum.
- Le checkout actuel passe par `src/lib/reservations/persistence.ts`, la RPC `create_reservation_with_items`, `src/lib/stripe/checkout.ts` et `webhook-handlers.ts`. Les interfaces compte/admin et `src/lib/supabase/types.ts` conservent le vocabulaire actuel. Aucun chemin TypeScript actuel ne crée de `container_reservations` ni n'écrit pending_payment/confirmed comme statut de réservation.
- Le modèle ancien n'est pas supprimable : `20260823100000_admin_delete_product.sql` consulte encore `container_reservation_items` pour protéger l'historique. Le runtime appelle cette RPC depuis l'admin catalogue. La vue de commitments conserve son contrat historique ; le catalogue actuel lit directement `container_seed_commitments` (`src/lib/catalogue/db.ts`, lignes 273+), et non cette vue. Le constat de `STUDIO_PROJECT_AUDIT.md:328` était donc pertinent ; il s'agit d'une collision de définitions du **même** type, pas de deux types simultanés dans le même schéma.
- Un précédent correctif de replay existe déjà dans l'historique : `c2c41de` a déplacé `is_admin()` après la création de `professionals` dans le rattrapage. Il reste inchangé.

## Corrections minimales retenues

Chaque ajout SQL est marqué **fresh-local-replay repair**. Une migration située après un fichier qui échoue ne pourrait pas le réparer ; aucune nouvelle version de migration n'est ajoutée.

1. **Fondation réservations `20260518162000`** : ajout des deux littéraux historiques à la déclaration initiale de `reservation_status`. Les neuf statuts actuels et leur ordre relatif sont conservés, ainsi que tous les défauts, casts et politiques des deux modèles. L'enum est créée et validée avant la migration de rattrapage : aucun `ALTER TYPE ADD VALUE` suivi d'un usage non committé dans la même transaction. Pas de renommage ni de conversion sémantique pending_payment → pending_reservation_fee.
2. **Stock `20260601090000`** : le premier replay corrigé a ensuite échoué sur les FK des cinq fixtures stock (p1/v1a, etc.). Ces produits ne sont semés par aucune migration. Les valeurs de fixture restent identiques, mais leur insertion exige maintenant la présence du produit et de sa variante correspondante. Une base vide reste sans stock fictif, les FK restent actives, et une base contenant les anciennes références conserve les insertions prévues.
3. **Bridge pricing `20260705090000`** : le replay suivant a échoué sur le type `pricing_channel`, absent de la chaîne mais utilisé dans la signature de `get_price` de `20260706110000_admin_pricing_engine_parity.sql`, puis dans `20260826100000_partner_floor_inactive_product.sql`. Définition originale retrouvée par `git show 4a7906b:supabase/migrations/20260701110000_pricing_engine_phase1.sql` : direct, reseller, distributor, admin. Seule cette déclaration idempotente est restaurée. Aucune formule ni aucun prix n'est modifié.
4. **Grants produits `20260907110000`** : le troisième replay a échoué sur l'auto-vérification des droits d'écriture authenticated. Ils étaient supposés hérités des anciens defaults Supabase, sans déclaration dans la chaîne. INSERT/UPDATE/DELETE sont désormais explicitement accordés, toujours sous les politiques RLS admin existantes. La lecture reste limitée aux colonnes publiques, aucun accès aux coûts n'est ajouté. L'auto-vérification reste intacte.

Les anciennes versions sont déjà enregistrées en production : ces éditions ne sont pas des migrations distantes exécutées ni des demandes de réparation d'historique distant. **Ne pas rejouer ces fichiers sur la production.** Aucune lecture du schéma distant n'a été faite : cette réparation valide le schéma reproductible du dépôt, sans prétendre auditer une éventuelle dérive de la production.

## Preuve de replay complet depuis zéro

Docker ne contenait initialement **aucun conteneur ni volume**. Chaque échec de `supabase start` a arrêté les conteneurs ; avant chaque nouveau replay, exécution ciblée de :

```sh
# Destructif pour cette instance LOCALE uniquement ; sauvegarder les données utiles avant réutilisation.
bunx supabase stop --project-id hub-and-ship --no-backup
bunx supabase start
bunx supabase status
```

Supabase CLI utilisé : **2.109.0**, Docker Desktop. Aucun `--linked`, `--db-url`, db push, migration repair ou SQL distant.

Le quatrième replay est réussi depuis la base vide. Les **94 fichiers SQL** sont enregistrés dans `supabase_migrations.schema_migrations`, et la comparaison de leurs versions triées avec les noms du dépôt donne une égalité exacte, sans fichier sauté :

- 39 : `20260907120000_studio_foundation.sql` — appliquée localement.
- 40 : `20260907130000_studio_sessions_events.sql` — appliquée localement.
- 41 : `20260908090000_studio_visual_intelligence.sql` — appliquée localement.
- 42 : `20260909100000_studio_table_compatibility.sql` — appliquée localement, dernière version.

39–42 sont les désignations de lots existantes, pas les positions 39–42 parmi les 94 fichiers présents.

Vérifications exclusivement via `docker exec supabase_db_hub-and-ship psql -U postgres -d postgres` : enum réservations à 11 valeurs attendues, pricing_channel à 4 valeurs originales, catalogue et stock vides, droits INSERT/UPDATE authenticated présents, SELECT fob_usd authenticated absent. Une tentative d'INSERT produit complète avec le rôle authenticated non admin est refusée par la **RLS** ; transaction annulée, aucune ligne conservée. Les vues `studio_products` et `studio_tabletop_base_rules_public` sont lisibles comme anon et renvoient zéro ligne.

`supabase status` : réussite. API locale `http://127.0.0.1:54321`, Studio DB `http://127.0.0.1:54323`, boîte mail locale `http://127.0.0.1:54324`. Treize conteneurs actifs ; les services munis d'un healthcheck sont healthy. Les services optionnels imgproxy/pooler sont signalés arrêtés. L'instance locale reste démarrée pour la validation de données suivante ; aucune donnée commerciale importée.

Journaux locaux (non committés, le journal de démarrage peut contenir les clés locales générées par Supabase) : `/tmp/supabase-fresh-replay{,2,3,4}.log`, `/tmp/replay-applied-versions.txt`, `/tmp/replay-buyer-denied.log`. Ne pas publier les journaux bruts de démarrage/status.

## Tests et impact

- Régression PostgreSQL PGlite : **3 tests réussis**, enum et casts réels, défaut historique, commitments pending/confirmed mais pas cancelled, stock vide et fixture valide/idempotente, définition originale du canal de prix.
- `bun run check` : typage/lint OK, **954 tests réussis, 8 ignorés**.
- `bun run test:security` : **250 tests réussis**, dont les tests Studio et le nouveau replay historique.
- `bun run build` : réussi, budgets respectés, aucun marqueur interne dans **214 chunks client**.
- Aucun contrat runtime Studio modifié : couverture Studio unitaire/SQL existante incluse dans les commandes ci-dessus, plus lectures réelles des vues locales. Pas de nouveau parcours E2E nécessaire pour ces déclarations SQL ; les E2E à fixtures ne prouveraient pas le replay Docker.

Fichiers modifiés : les quatre migrations historiques détaillées ci-dessus. Fichiers ajoutés : `tests/security/historical-reservation-replay.test.ts` et ce rapport. Les migrations **41/42 sont inchangées**.

**Impact production : aucun. MIGRATION 41 PROD = NON APPLIQUÉE. MIGRATION 42 PROD = NON APPLIQUÉE.** Aucun SQL distant, db push, migration repair distante, déploiement, merge main, secret ou flag modifié. Aucun appel Stripe ou contact réel.

## Inventaire des références recherchées

Les fichiers suivants contiennent les termes audités ; les références transactionnelles principales sont analysées ci-dessus. La recherche a couvert tous les autres fichiers de migrations et de code, sans autre transformation du modèle ancien.

- `src/components/AdminCatalogueTab.tsx`
- `src/components/AdminPackshotBatchNormalizer.tsx`
- `src/components/AdminPartnersTab.tsx`
- `src/components/ContainerScene.tsx`
- `src/components/OrderSidebar.tsx`
- `src/components/studio/SeatQuantityField.test.tsx`
- `src/components/studio/SeatQuantityField.tsx`
- `src/lib/account/admin-reservations.repository.ts`
- `src/lib/account/dashboard.test.ts`
- `src/lib/account/dashboard.ts`
- `src/lib/account/reservations.test.ts`
- `src/lib/account/reservations.ts`
- `src/lib/account/timeline.test.ts`
- `src/lib/account/timeline.ts`
- `src/lib/admin/command-center.ts`
- `src/lib/admin/overview.ts`
- `src/lib/auth/magic-link.test.ts`
- `src/lib/auth/magic-link.ts`
- `src/lib/commission/accrual.test.ts`
- `src/lib/commission/accrual.ts`
- `src/lib/container/packing.ts`
- `src/lib/container/reserved-load.ts`
- `src/lib/email/lead-templates.test.ts`
- `src/lib/email/templates.ts`
- `src/lib/order.ts`
- `src/lib/partners/attribution.ts`
- `src/lib/partners/reporting.test.ts`
- `src/lib/partners/reporting.ts`
- `src/lib/partners/types.ts`
- `src/lib/pricing/commission.ts`
- `src/lib/reservations/local-history.test.ts`
- `src/lib/reservations/local-history.ts`
- `src/lib/reservations/payment-reminders.test.ts`
- `src/lib/reservations/payment-reminders.ts`
- `src/lib/reservations/payment-status.test.ts`
- `src/lib/reservations/payment-status.ts`
- `src/lib/reservations/persistence.test.ts`
- `src/lib/reservations/persistence.ts`
- `src/lib/reservations/repository.test.ts`
- `src/lib/stock-requests.ts`
- `src/lib/stripe/checkout.ts`
- `src/lib/stripe/webhook-handlers.test.ts`
- `src/lib/stripe/webhook-handlers.ts`
- `src/lib/studio/discovery.test.ts`
- `src/lib/studio/fixtures.test-helpers.ts`
- `src/lib/studio/fulfillment.test.ts`
- `src/lib/studio/fulfillment.ts`
- `src/lib/studio/project-state.ts`
- `src/lib/studio/quantity-feedback.ts`
- `src/lib/supabase/types.ts`
- `src/routes/account.reservations.$reservationId.tsx`
- `src/routes/admin.tsx`
- `src/routes/api/cron/payment-reminders.ts`
- `src/routes/api/stripe/webhook.ts`
- `src/routes/catalogue.tsx`
- `supabase/migrations/20260518162000_reservation_foundation.sql`
- `supabase/migrations/20260518204500_stock_requests.sql`
- `supabase/migrations/20260520101823_rattrapage_schema.sql`
- `supabase/migrations/20260522072655_stripe_payment_columns.sql`
- `supabase/migrations/20260523150000_anon_reservation_insert.sql`
- `supabase/migrations/20260605183000_create_reservation_with_items_rpc.sql`
- `supabase/migrations/20260606190000_partner_applications_and_deals.sql`
- `supabase/migrations/20260606210000_partner_attribution_on_reservations.sql`
- `supabase/migrations/20260607090000_partner_link_attribution.sql`
- `supabase/migrations/20260611102000_revalidate_reservation_prices.sql`
- `supabase/migrations/20260706090000_payment_reminders.sql`
- `supabase/migrations/20260706100000_reservation_rpc_channel_attribution.sql`
- `supabase/migrations/20260709090000_pricing_pilotage_p0.sql`
- `supabase/migrations/20260711120000_reservation_volume_discount.sql`
- `supabase/migrations/20260823100000_admin_delete_product.sql`
- `STUDIO_PROJECT_AUDIT.md:256,271,275,328`
- `STUDIO_IMPLEMENTATION_PLAN.md:416`
- Historique `c2c41de`, `4a7906b` (déclarations SQL originales).
