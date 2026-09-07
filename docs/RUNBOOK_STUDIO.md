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

Contenu : tables `studio_model_families`, `studio_product_profiles`, `studio_fulfillment_options` (RLS lecture publique, écriture `is_admin()`), vue `studio_products` (security_invoker, colonnes publiques explicites + profil, aucune colonne de coût), peuplement idempotent des profils (rôle par catégorie, sous-type et matière estimés, prix public reconnu, `model_family_id` jamais renseigné) et d'une option `standard_production` par produit public actif au MOQ de la fiche. Auto-vérification en fin de migration.

Ordre : code puis migration (le code lit la vue avec des colonnes explicites ; l'ancien bundle ne la référence pas). Application : `supabase db push` ou éditeur SQL, comme les migrations 30 à 38 (`RUNBOOK_FUSION_DEPLOY.md`).

### Rollback

```sql
drop view if exists public.studio_products;
drop table if exists public.studio_fulfillment_options;
drop table if exists public.studio_product_profiles;
drop table if exists public.studio_model_families;
```

Aucune donnée existante n'est touchée par la migration ni par son rollback.

## 4. Contrôles

- `bun run test:security` : parité migration ↔ code (vue sans colonne de coût, grants, RLS, peuplement prudent, absence de `select('*')`).
- `bun run security:studio` (script `scripts/security/check-studio-access.mjs`, aucune écriture) : après application de la migration, avec la clé anon et, si possible, le compte de test non admin :

```
SUPABASE_URL=… SUPABASE_ANON_KEY=… TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=… \
EXPECTED_MIN_ACTIVE_PRODUCTS=100 bun run security:studio
```

Échec (code 1) si la vue est illisible, si une colonne de coût apparaît, si `product_pricing_inputs` devient lisible ou si les tables `studio_*` ne sont plus accessibles.

- `bun run security:grants` reste le contrôle des colonnes de `products` (lot 0.5).

## 5. Ajouter une colonne publique à `products`

Depuis le lot 1, **deux vues** listent explicitement les colonnes : `products_public` et `studio_products`. Une colonne ajoutée à `products` doit être ajoutée aux grants `anon` + `authenticated`, aux deux vues, à `PUBLIC_PRODUCT_COLUMNS` (`src/lib/catalogue/product-columns.ts`) et au type `Database`. Procédure complète : `RUNBOOK_SECURITY_GRANTS.md` § 2.

## 6. Modèle métier posé par le lot 1 (rappel pour les lots suivants)

- Readiness (`src/lib/studio/readiness.ts`) : `discovery` → `project` → `quote` → `reservation`, chaque niveau expliqué par des raisons. Le prix public actif de la base est une vérité commerciale ; il n'est `pending` que s'il est absent et `estimated` (indicatif) que si un admin le marque ainsi. `reservation` exige une voie de fulfillment ouverte (stock réel, production ouverte, regroupement confirmé), jamais uniquement un container ouvert.
- Fulfillment (`src/lib/studio/fulfillment.ts`) : `stock` (lu en direct dans `stock_lines`, vérifié avant le MOQ) → `standard_production` → `grouped_production` (confirmé par un admin) → `manual_review` avec raisons. Aucune quantité n'est refusée, aucune disponibilité n'est inventée.
- État projet (`src/lib/studio/project-state.ts`) : `manual_quote_required` > `feasibility_review` > `auto_quote_ready` > `reservation_ready`, raisons par ligne.
- Qualité de données (`src/lib/studio/data-quality.ts`) : `verified | estimated | pending` + provenance ; une provenance heuristique n'est jamais `verified`.
- Store local (`src/stores/studio.store.ts`, clé `terrassea-studio-v1`) : projet en cours, quantité libre, Undo profondeur 50. Les favoris existants restent un système distinct.
