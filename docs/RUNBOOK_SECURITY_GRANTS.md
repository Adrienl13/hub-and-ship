# Runbook — Grants sur `products` et colonnes de coût

Objectif : que la fuite fermée par le lot 0.5 (09/2026) ne réapparaisse pas dans six mois, et que l'incident du 07/09/2026 (catalogue vide pour les visiteurs après une révocation) ne se reproduise pas.

## 1. Qui peut lire quoi (état cible, migrations 37 + 38)

| Objet | anon | authenticated non admin | admin (rôle `authenticated` + RLS) | service_role |
|---|---|---|---|---|
| `products` — 25 colonnes publiques (`PUBLIC_PRODUCT_COLUMNS`) | lecture colonne par colonne | lecture colonne par colonne | lecture colonne par colonne, écriture via RLS `admins write products` | tout |
| `products` — `fob_usd`, `qty_per_container`, `is_loss_leader`, `table_price_modifier_rate` (héritées, vides) | refusé | refusé | refusé en lecture directe (colonnes obsolètes, non utilisées par l'admin) | tout |
| `products?select=*` | refusé (42501) | refusé (42501) | refusé (42501) : l'admin utilise `PUBLIC_PRODUCT_SELECT` | tout |
| vue `products_public` (security_invoker) | lecture | lecture | lecture | tout |
| `product_pricing_inputs` (vrais coûts) | refusé | vide (RLS admin) | lecture / écriture | tout |
| vue `product_pricing_readiness` (security_invoker) | refusé | vide (RLS sur les tables sous-jacentes) | lecture | tout |
| `pricing_parameters`, `channel_price_overrides`, `channel_coefficients`, `product_partner_prices` | refusé / vide | vide (RLS admin ; partenaires : leurs prix nets actifs uniquement) | tout | tout |
| RPC `get_price`, `calculate_product_landed_cost_ht`, `product_hard_margin_floor`, `active_pricing_parameters` | non exécutable | non exécutable | non exécutable directement (appelées par d'autres fonctions definer) | — |
| RPC `admin_*`, `check_pricing_control` | non exécutable | exécutable mais `is_admin()` vérifié dans le corps | exécutable | — |
| RPC `get_catalogue_prices`, `get_public_pricing_rules`, `get_public_product_prices*` | exécutable (prix du canal appelant uniquement) | idem | idem | — |

Point de vigilance : l'admin n'est **pas** un rôle Postgres. C'est un utilisateur `authenticated` distingué par `is_admin()` dans les policies RLS. Un grant colonne par colonne s'applique donc aussi à l'admin : tout code admin doit sélectionner des colonnes explicites.

## 2. Ajouter une colonne à `products`

1. Décider si la colonne est **publique** (affichable à un visiteur) ou **interne**.
2. `src/lib/catalogue/product-columns.ts` : l'ajouter à `PUBLIC_PRODUCT_COLUMNS` ou à `INTERNAL_PRODUCT_COST_COLUMNS`. Le fichier ne compile plus tant qu'une colonne du type `products.Row` n'est pas classée (`EVERY_PRODUCT_COLUMN_IS_CLASSIFIED`). Mettre à jour `src/lib/supabase/types.ts` (types écrits à la main).
3. Colonne publique — la migration qui la crée doit contenir, dans le même fichier :
   ```sql
   alter table public.products add column if not exists <col> …;
   grant select (<col>) on table public.products to anon, authenticated;
   create or replace view public.products_public with (security_invoker = true) as
     select <liste complète incluant <col>> from public.products;
   grant select on public.products_public to anon, authenticated;
   -- depuis le lot 1 Studio : la vue studio_products liste aussi les colonnes
   create or replace view public.studio_products with (security_invoker = true) as
     select p.<liste complète incluant <col>>, <colonnes de profil> from public.products_public p
     left join public.studio_product_profiles sp on sp.product_id = p.id;
   grant select on public.studio_products to anon, authenticated;
   ```
   Sans le `grant select (<col>)`, la vue `products_public` (security_invoker) échoue en 42501 pour tout le monde : **c'est exactement l'incident du 07/09**.
4. Colonne interne — ne rien accorder ; ne pas l'ajouter à la vue ; la lire uniquement via une fonction `security definer` gardée par `is_admin()`, ou la mettre dans `product_pricing_inputs`.
5. Côté admin : `catalogue-admin/repository.ts` utilise `PUBLIC_PRODUCT_SELECT` ; une colonne publique ajoutée à la liste est donc automatiquement lue. Ne jamais réintroduire `select('*')` sur `products` (test `tests/security/products-cost-columns-grants.test.ts`).
6. Lancer `bun run test:security` (parité liste ↔ migrations, vues `products_public` et `studio_products` sans colonne de coût, absence de `select('*')`), puis `bun run security:grants` et `bun run security:studio` après application.

## 3. Vérifier après chaque migration touchant `products`

1. En local (`supabase start`) ou en staging, puis en production après déploiement :
   ```bash
   SUPABASE_URL=… SUPABASE_ANON_KEY=… \
   TEST_BUYER_EMAIL=… TEST_BUYER_PASSWORD=… \
   TEST_ADMIN_EMAIL=… TEST_ADMIN_PASSWORD=… \
   EXPECTED_MIN_ACTIVE_PRODUCTS=100 \
   bun run security:grants
   ```
   Le script échoue si un rôle non admin lit une colonne de coût **ou** si le catalogue public n'est plus lisible (vue vide / 401).
2. Même matrice sous Vitest avec les mêmes variables préfixées `SUPABASE_TEST_*` : `tests/integration/products-access.integration.test.ts` (ignoré sans variables).
3. Contrôle manuel minimal : `curl -H "apikey: $ANON" "$URL/rest/v1/products_public?select=id&limit=1"` → 200 et une ligne.

## 4. Ordre de déploiement d'une restriction de grant

Toujours : **déployer le code** qui sélectionne des colonnes explicites, **puis** appliquer la migration de grant. Dans l'autre sens, l'ancien bundle (qui fait `*`) casse jusqu'au déploiement. Migrations 31, 37 et 38 suivent cette règle (voir `RUNBOOK_FUSION_DEPLOY.md`).

## 4 bis. Rollback d'urgence de la migration 38 (`20260907110000_products_authenticated_column_grants.sql`)

Uniquement si un chemin applicatif critique non détecté casse après application (symptôme : erreur `42501 permission denied for table products` dans un écran connecté). Restaure l'ancien accès complet de `authenticated`, **y compris aux 4 colonnes de coût** :

```sql
grant select on table public.products to authenticated;
```

Retour au modèle sécurisé après correction du runtime (projection explicite déployée) :

```sql
revoke select on table public.products from authenticated;
grant select (
  id, sku, category, name, description,
  dim_length_cm, dim_width_cm, dim_height_cm,
  cbm_per_unit, weight_kg, moq_units,
  base_price_ht, retail_price_ref, eco_contribution,
  main_image_url, gallery_urls, features, fire_rating,
  is_active, sort_order, created_at, updated_at,
  table_shape, compatible_top_shapes, visibility
) on table public.products to authenticated;
```

puis `bun run security:grants` avec le compte de test non admin.

## 5. Comptes de test

Les contrôles `authenticated` exigent un compte **de test non admin** (jamais un vrai client) et, pour les chemins admin, un compte admin de test. Création : `docs/COMPTES_TEST.md` (Dashboard Supabase → Authentication → Add user, « Auto Confirm User »). Les identifiants restent dans l'environnement (`.env.local`, secrets CI), jamais dans le repo.

## 6. Ce que le lot 0.5 n'a pas fait (volontairement)

- Aucune colonne supprimée : les 4 colonnes de coût héritées existent toujours (vides). Leur suppression est un chantier séparé.
- `anon` et `authenticated` conservent des privilèges d'écriture table-level par défaut Supabase, neutralisés par la RLS (aucune policy d'écriture publique sur `products`). Non modifié.
