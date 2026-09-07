# Runbook — Studio Projet (lot 1 : fondation)

État : fondation invisible. Aucune expérience utilisateur Studio n'existe encore (lot 2). Ce runbook couvre l'activation, la preview sécurisée, les migrations, les contrôles et le rollback.

## 1. Activer le Studio en local

```
# .env.local (jamais commité)
VITE_STUDIO_ENABLED=true
```

`bun run dev` puis `http://localhost:5173/studio` → page « Fondation en place ». Sans cette variable, `/studio` renvoie la 404 du site.

`VITE_STUDIO_ENABLED` est une variable de build Vite : elle est inlinée dans le bundle et donc publique par nature. Elle ne doit passer à `true` en production que le jour de l'ouverture publique. Tant qu'elle est absente, les routes `/studio` portent `noindex`.

### Tester la preview en local (flag OFF)

Le code serveur tourne dans le runtime Cloudflare (workerd) même en `bun run dev` : les secrets serveur ne viennent **pas** du shell ni de `.env.local`, mais du fichier `.dev.vars` (gitignoré), comme pour `CRON_SECRET`.

```
# .dev.vars (jamais commité)
STUDIO_PREVIEW_KEY=<au moins 16 caractères>
```

Puis `http://localhost:5173/studio/preview?key=<la clé>` → redirection vers `/studio` avec le cookie (sans `Secure` en HTTP local). Vérifié le 07/09/2026 : sans cookie 404, clé fausse 404, clé bonne 302 + cookie, `/studio` 200 avec `noindex, nofollow`, cookie forgé 404, `?clear=1` efface.

## 2. Preview sécurisée en production (flag OFF)

Objectif : voir `/studio` en production sans l'ouvrir au public, sans redéployer.

1. Générer un secret d'au moins 16 caractères (32 recommandés) : `openssl rand -base64 32`.
2. Le poser côté serveur uniquement : Cloudflare → Worker `container-club` → Variables → `STUDIO_PREVIEW_KEY` (secret). **Jamais** dans une variable `VITE_*`, jamais dans Git.
3. Ouvrir `https://prosimport.com/studio/preview?key=<secret>` : le serveur compare la clé en temps constant, pose le cookie `studio_preview` (HMAC-SHA256 signé avec le secret, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/studio`, 7 jours) et redirige vers `/studio`.
4. Toute autre réponse est un 404 : secret non configuré, clé fausse, méthode POST, plus de 10 tentatives par 10 minutes et par IP.

Ce que la preview ne fait pas : elle n'accorde aucun accès admin, aucune session Supabase, aucune donnée supplémentaire. Elle ne fait qu'exister les routes `/studio`.

### Révoquer

- Tous les cookies de preview : changer `STUDIO_PREVIEW_KEY` (ou le supprimer). Les jetons signés avec l'ancien secret deviennent invalides immédiatement.
- Son propre navigateur : `https://prosimport.com/studio/preview?clear=1`.

## 3. Migrations du lot 1

| # | Fichier | Statut |
|---|---|---|
| 39 | `supabase/migrations/20260907120000_studio_foundation.sql` | **non appliquée** (à appliquer après déploiement du bundle du lot 1) |

Contenu : tables internes `studio_model_families`, `studio_product_profiles`, `studio_fulfillment_options` ; surfaces publiques `studio_product_profiles_public`, `studio_fulfillment_options_public`, `studio_model_families_public` et `studio_products` ; fonction `studio_public_data_quality()` ; peuplement idempotent des profils (rôle par catégorie, sous-type et matière estimés, prix public reconnu, `model_family_id` jamais renseigné) et d'une option `standard_production` **non confirmée** (`seed_moq`) par produit public actif au MOQ de la fiche. Auto-vérification en fin de migration (colonnes internes absentes des surfaces publiques, aucun droit anon sur les tables, projection de qualité étanche, aucune option semée confirmée).

Ordre : code puis migration (le code lit les vues avec des colonnes explicites ; l'ancien bundle ne les référence pas). Application : `supabase db push` ou éditeur SQL, comme les migrations 30 à 38 (`RUNBOOK_FUSION_DEPLOY.md`).

### Surface publique minimale (principe du lot 0.5)

| Surface | Lisible par | Colonnes |
|---|---|---|
| `studio_products` (vue, security_invoker) | anon, authenticated | les 25 colonnes publiques de `products_public` + `studio_role`, `seat_kind`, `material`, `model_family_id`, `visual_traits`, `data_quality` (projetée) |
| `studio_product_profiles_public` (vue) | anon, authenticated | `product_id`, `studio_role`, `seat_kind`, `material`, `model_family_id`, `visual_traits`, `data_quality` (projetée) — produits actifs |
| `studio_fulfillment_options_public` (vue) | anon, authenticated | `id`, `product_id`, `variant_id`, `mode`, `min_quantity`, `max_quantity`, `price_basis`, `source`, `is_active`, `is_confirmed`, `available_from`, `expires_at` — options actives |
| `studio_model_families_public` (vue) | anon, authenticated | `id`, `label`, `status` — familles vérifiées |
| tables `studio_*` | admin uniquement (RLS `is_admin()` ; anon : aucun grant ; buyer : zéro ligne) | tout, dont `notes`, `note`, `created_by`, `updated_by`, `confirmed_by`, `data_quality` complète |

Règles :

- Jamais de `notes`, `note`, `created_by`, `updated_by`, `confirmed_by` ni d'UUID `auth.users` dans une surface publique. La confirmation d'une option est publiée comme booléen `is_confirmed`.
- `data_quality` publique (`studio_public_data_quality()`) = vraie liste blanche SQL : champs de premier niveau limités à `dimensions`, `weight`, `material`, `price`, `compatibility`, `customization`, `media`, `model_family` (toute autre clé, par exemple une vérification interne, disparaît entièrement) ; par champ uniquement `status`, `source`, `updatedAt` ; `status` normalisé à `verified | estimated | pending` (sinon `pending`), `source` aux provenances connues (sinon `none`) ; une provenance heuristique n'est jamais publiée `verified`. Le client (`data-quality.ts`) applique la même liste blanche.
- `model_family_id` n'est public que si la famille référencée est `verified` ; candidate, rejetée ou absente → `null` publiquement (la valeur interne n'est pas modifiée). `studio_products` hérite de cette projection. `studio_model_families_public` ne liste que les familles vérifiées.
- Les surfaces publiques ne montrent que des produits actifs : profils et options d'un produit inactif sont absents (les produits `on_request` sont actifs, donc inchangés).
- `studio_fulfillment_options.mode` n'accepte en base que `standard_production` et `grouped_production`. `stock` (lu dans `stock_lines`) et `manual_review` (résultat de résolution) sont des modes du code, jamais des lignes d'options.
- Les vues `*_public` lisent les tables avec les droits du propriétaire (pas de `security_invoker`, `security_barrier`) : un rôle public n'a aucun droit sur les tables. Une colonne ajoutée à une table est donc invisible tant qu'elle n'est pas ajoutée explicitement à une vue, à la constante du repository et au script `security:studio` (parité testée dans `tests/security`).
- Le navigateur (`src/lib/studio/repository.ts`) ne lit que `studio_products`, `studio_fulfillment_options_public`, `product_variants`, `stock_lines`, toujours avec des colonnes explicites. Il ne lit ni `containers` ni aucune table `studio_*`.

### Rollback

```sql
drop view if exists public.studio_products;
drop view if exists public.studio_fulfillment_options_public;
drop view if exists public.studio_product_profiles_public;
drop view if exists public.studio_model_families_public;
drop function if exists public.studio_public_data_quality(jsonb);
drop table if exists public.studio_fulfillment_options;
drop table if exists public.studio_product_profiles;
drop table if exists public.studio_model_families;
```

Aucune donnée existante n'est touchée par la migration ni par son rollback.

## 4. Contrôles

- `bun run test:security` : parité migration ↔ code (surfaces publiques sans colonne de coût ni interne, tables internes sans grant anon et sous RLS `is_admin()` seule, projection de qualité, option semée jamais confirmée, absence de `select('*')`, parité du script `security:studio`).
- `bun run security:studio` (script `scripts/security/check-studio-access.mjs`, aucune écriture) : après application de la migration, avec la clé anon et, si possible, le compte de test non admin :

```
SUPABASE_URL=… SUPABASE_ANON_KEY=… TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=… \
EXPECTED_MIN_ACTIVE_PRODUCTS=100 bun run security:studio
```

Échec (code 1) si une vue publique est illisible, si `select=*` sur une vue publique renvoie autre chose que la liste blanche, si une colonne interne (`notes`, `note`, `created_by`, `updated_by`, `confirmed_by`) ou de coût est lisible quelque part (tables internes : anon refusé, buyer refusé ou zéro ligne), si `data_quality` publie autre chose que `status`/`source`/`updatedAt`, ou si `product_pricing_inputs` devient lisible.

- `tests/integration/studio-access.integration.test.ts` : même matrice en Vitest, ignorée sans `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` (+ `TEST_BUYER_*`).

- `bun run security:grants` reste le contrôle des colonnes de `products` (lot 0.5).

## 5. Ajouter une colonne publique à `products`

Depuis le lot 1, **deux vues** listent explicitement les colonnes : `products_public` et `studio_products`. Une colonne ajoutée à `products` doit être ajoutée aux grants `anon` + `authenticated`, aux deux vues, à `PUBLIC_PRODUCT_COLUMNS` (`src/lib/catalogue/product-columns.ts`) et au type `Database`. Procédure complète : `RUNBOOK_SECURITY_GRANTS.md` § 2.

## 6. Modèle métier posé par le lot 1 (rappel pour les lots suivants)

- Readiness (`src/lib/studio/readiness.ts`) : `discovery` → `project` → `quote` → `reservation`, chaque niveau expliqué par des raisons. Le prix public actif de la base est une vérité commerciale ; il n'est `pending` que s'il est absent et `estimated` (indicatif) que si un admin le marque ainsi. `reservation` exige une voie de fulfillment **confirmée pour ce produit**.
- Voie confirmée (`src/lib/studio/fulfillment.ts`, `confirmedFulfillmentPaths`) : exactement trois cas — (1) stock réel (`stock_lines`) couvrant la quantité demandée pour ce coloris ; (2) `standard_production` explicitement confirmée par un admin pour ce produit/variant (`is_confirmed`) ; (3) `grouped_production` explicitement confirmée. Un MOQ, une option `seed_moq`, une option déclarée sans confirmation ou n'importe quel container ouvert ne confirment rien. Il n'existe plus aucun signal global de production.
- `seed_moq` : l'option `standard_production` semée par la migration au MOQ de la fiche signifie « la série standard de ce produit est connue ». Elle rend une quantité ≥ MOQ quotable (`standard_production` non confirmée, raison `production_unconfirmed` → projet `auto_quote_ready`), jamais réservable. Pour ouvrir la réservation d'un produit, un admin renseigne `confirmed_by` sur une option (ou en crée une, `source = 'admin'`).
- Fulfillment, ordre de priorité déterministe (`resolveFulfillment`) : (0) coloris RAL / dimensions spéciales ou produit sur demande → `manual_review` ; (1) stock réel couvrant la quantité → `stock`, confirmé ; (2) `standard_production` **confirmée** couvrant la quantité, quantité au niveau de la série → confirmé ; (3) `grouped_production` **confirmée** couvrant la quantité (même sous la série) → confirmé ; (4) aucune voie confirmée : `standard_production` non confirmée couvrant une quantité au niveau de la série → `production_unconfirmed`, devis seulement ; (5) `manual_review` avec raisons (`below_moq`, `colour_minimum`, `stock_insufficient`, `no_fulfillment_path`). Une voie confirmée n'est jamais masquée par une voie non confirmée ; entre standard confirmée et regroupement confirmé, la standard gagne. Aucune quantité n'est refusée, aucune disponibilité n'est inventée.
- État projet (`src/lib/studio/project-state.ts`) : `manual_quote_required` > `feasibility_review` > `reservation_ready` > `auto_quote_ready`, raisons par ligne. `reservation_ready` = toutes les lignes quote-ready **et** servies par une voie confirmée (`fulfillment.confirmed`).
- Qualité de données (`src/lib/studio/data-quality.ts`) : `verified | estimated | pending` + provenance ; une provenance heuristique n'est jamais `verified`.
- Store local (`src/stores/studio.store.ts`, clé `terrassea-studio-v1`) : projet en cours, quantité libre, Undo profondeur 50. Les favoris existants restent un système distinct.
