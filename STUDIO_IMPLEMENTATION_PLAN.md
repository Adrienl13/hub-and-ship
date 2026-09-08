# STUDIO PROJET — PLAN D'IMPLÉMENTATION

Compagnon de `STUDIO_PROJECT_AUDIT.md`. Version 2 du 08/09/2026, intégrant les décisions de relecture (16 points). Ce plan ne contient aucune implémentation ; il décrit lot par lot ce qui sera créé, modifié, migré et testé, avec critères d'acceptation et rollback. Tout est **additif** : aucune colonne existante n'est modifiée ni supprimée sans décision explicite, aucun chemin commercial existant (panier, réservation, Stripe, devis) n'est réécrit.

Règle transverse : `AI may rank, compare, interpret and explain. AI must never create, alter or infer commercial facts used for pricing, compatibility, availability or reservation.` Tout ce qui est prix, MOQ, stock, dimensions, matières, disponibilité, compatibilité, coloris, conditions, garanties, délais et réservation est lu depuis Postgres, jamais produit par le moteur de recommandation.

## Décisions de relecture intégrées (08/09/2026)

| # | Décision | Où dans le plan |
|---|---|---|
| 1 | Lot 0.5 Security hardening, prérequis au Lot 1 | Lot 0.5 |
| 2 | MOQ jamais bloquant ; vérifier le stock avant `below_moq` ; modes de fulfillment et états projet | Lot 1 (modèle), Lot 2, Lot 7, Lot 8 |
| 3 | `reservation_ready` ne dépend plus d'un container ouvert ; readiness par voie de fulfillment | Lot 1 (readiness) |
| 4 | `style_tags` retiré ; `visual_traits` calculés, non bloquants ; aucun étiquetage manuel de style | Lot 1 (schéma), Lot 2, Lot 3, Livrable 5 |
| 5 | `data_quality` granulaire avec provenance ; jamais `verified` par heuristique | Lot 1 (schéma), Livrable 4 |
| 6 | `model_family_id` jamais déduit du nom ; candidats de familles à valider | Lot 1, Lot 3 |
| 7 | Prix retiré du moteur de goût V0 | Lot 2 |
| 8 | V0 = moteur heuristique assumé, sans promesse de compréhension | Lot 2 |
| 9 | Finalistes : 3 maximum, 2 possibles, « voir plus » à la demande | Lot 2 |
| 10 | Duels facultatifs, uniquement sur paires diagnostiques explicites ; désactivés sinon | Lot 2, Lot 3 |
| 11 | Decision Images : extension de `normalize-packshot.ts` et `normalize-packshots.mjs`, pas de second pipeline | Lot 3 |
| 12 | Lot 2 fonctionne sur toutes les assises Studio Ready ; évaluation qualitative sur un jeu curé de 30 à 50 | Lot 2 (étape 2.0), Livrable 5 |
| 13 | Plateaux : expérience légère, tout est affiché, jamais caché | Lot 4 |
| 14 | Piètements : `table-composer.ts` réutilisé, compatibilité déterministe, seuls les compatibles proposés | Lot 4 |
| 15 | Flag + preview obligatoires avant Lot 2 ; staging recommandé avant bêta publique ; Lot 1 non bloqué par le staging | Lot 1, section Staging |
| 16 | Aucun code Studio à cette étape | ce document seulement |

---

## Vue d'ensemble des lots

| Lot | Contenu | Dépend de | Bloquant pour |
|---|---|---|---|
| 0 | Audit | — | tous |
| 0.5 | Security hardening des coûts internes (`products`, vues, RPC) + tests `anon` et `authenticated` | 0 | 1 |
| 1 | Fondations : flag + preview, tables `studio_*` de base, readiness, modèle de fulfillment, vue `studio_products`, store | 0.5 | 2 à 8 |
| 2 | Tranche verticale Assises (moteur V0 heuristique, découverte, j'aime / pas pour moi / passer, undo, favoris, finalistes ≤ 3, choix, quantité libre, rail + barre) + étape 2.0 curation pilote | 1 | 4 |
| 3 | Pipeline visuel : Decision Images (extension du pipeline existant), `visual_traits`, features, voisins, paires diagnostiques, versions d'algorithme, moteur V1 | 1 | évaluation qualitative de 2, moteur V1 |
| 4 | Plateaux (léger) + piètements (compatibilité déterministe) | 1, 2 | 5 |
| 5 | Personnalisation (groupes d'options, zones) | 1, 4 | 7 |
| 6 | Sauvegarde projet, reprise, versions, partage lecture seule | 1, 2 | 7, 8 |
| 7 | Devis (snapshot figé, états projet, PDF) | 6 | 8 |
| 8 | Réservation (conversion projet → RPC existant, par voie de fulfillment) | 7 | — |

Les lots 3 et 5 avancent en parallèle de 2 et 4. La partie « Decision Images + métriques objectives » du Lot 3 doit être disponible **avant l'évaluation qualitative** du Lot 2 (étape 2.0), pas avant son développement.

---

## LOT 0 — Audit

Terminé (`STUDIO_PROJECT_AUDIT.md` + addendum du 08/09).

---

## LOT 0.5 — Security hardening (prérequis au Lot 1)

### Constat de départ (vérifié en base le 08/09)
- `products` porte encore 4 colonnes de coût héritées : `fob_usd`, `qty_per_container`, `is_loss_leader`, `table_price_modifier_rate`. Elles sont **vides sur les 196 lignes** (0 valeur non nulle, 0 loss leader). Les vrais coûts sont dans `product_pricing_inputs` (121 FOB renseignés), admin only.
- `anon` : grant colonne par colonne (migration 37 du 07/09), les 4 colonnes exclues.
- `authenticated` : `select` complet sur `products`, donc lecture possible des 4 colonnes par tout compte connecté non admin. Exposition théorique aujourd'hui (colonnes vides), réelle dès qu'une valeur y serait réécrite.
- Le code admin lit les coûts via `product_pricing_inputs` (`src/lib/catalogue-admin/types.ts`), mais deux requêtes admin font `select('*')` sur `products` (`src/lib/catalogue-admin/repository.ts` lignes 41 et 530) : un retrait de colonnes pour `authenticated` ferait échouer ces deux requêtes (l'admin est un utilisateur `authenticated` filtré par RLS, pas un rôle Postgres distinct).

### Objectifs
1. Inventaire exact des grants (`anon`, `authenticated`, admin via RLS) sur `products`, `products_public`, `product_pricing_readiness`, `product_variants`, `product_pricing_inputs`, `channel_price_overrides`, `product_partner_prices`, `pricing_parameters`, `stock_lines`, et de la surface RPC (`get_catalogue_prices`, `get_public_pricing_rules`, `get_public_product_prices*`, `get_price`, `calculate_product_landed_cost_ht`, fonctions `admin_*`).
2. Aucune colonne de coût lisible par un client non admin, `anon` **et** `authenticated`.
3. Accès admin préservé (éditeur produit, onglet catalogue, normaliseur de packshots, vue de readiness pricing).
4. Tests automatisés rejouables.
5. Aucune régression « catalogue vide » (incident du 07/09).

### Deux options de correction (décision Adrien)
- **Option A, non destructive (recommandée pour démarrer)** : `revoke select on products from authenticated` puis `grant select (liste explicite des colonnes publiques) on products to authenticated` (même liste que la migration 37) ; modifier les deux `select('*')` admin en listes de colonnes explicites ; vérifier `upsert`/`update` admin (`repository.ts` 603 et 614) qui n'écrivent pas ces colonnes. `security definer` (`get_price`, `calculate_product_landed_cost_ht`, `admin_save_product_full`) n'est pas affecté (exécution en tant qu'owner).
- **Option B, nettoyage définitif** : supprimer les 4 colonnes de `products` (elles sont vides ; la vue `products_public` ne les référence pas ; à vérifier : `admin_save_product_full` et `products_prune_overrides` ne les lisent pas), mettre à jour `src/lib/supabase/types.ts` et `db.ts`. Plus propre, mais c'est une suppression de colonnes : à faire seulement après sauvegarde et validation explicite. Peut suivre l'option A dans un second temps.

### Fichiers à créer
- `supabase/migrations/2026MMDD_products_authenticated_column_grants.sql` (option A) : revoke + grant colonne par colonne pour `authenticated` ; commentaire listant les dépendances (policies de `product_variants` et `stock_lines` référençant `products.is_active` et `products.id` : les colonnes `id`, `is_active` restent accordées).
- `scripts/security/check-cost-exposure.mjs` : avec la clé anon, (1) `products_public?select=count` doit renvoyer le nombre de produits actifs, (2) `products?select=fob_usd` doit renvoyer 401/42501, (3) `product_variants?select=count` doit réussir ; avec un JWT `authenticated` non admin (fourni par variable d'environnement, compte de test de `docs/COMPTES_TEST.md` ou créé en local), mêmes assertions plus `products?select=*` → refusé et `products?select=id,sku,name` → accepté. Échec = code de sortie 1. Exécutable en local (`supabase start`) et en production après déploiement.
- `tests/security/cost-columns-exposure.test.ts` : test texte des migrations 37 + nouvelle (présence des revoke/grant, absence des 4 colonnes dans les grants `anon` et `authenticated`, présence dans aucune vue publique).
- `tests/integration/cost-columns.integration.test.ts` (exécuté seulement si `SUPABASE_LOCAL_URL` est défini) : crée un utilisateur `buyer` via `service_role` sur la base locale, s'authentifie, vérifie les mêmes assertions que le script, vérifie que `is_admin()` renvoie `false`, puis avec un utilisateur admin de test vérifie que `products` (colonnes explicites), `product_pricing_inputs` et `product_pricing_readiness` restent lisibles.
- `docs/RUNBOOK_SECURITY_GRANTS.md` : procédure « ajouter une colonne à `products` » (mettre à jour les deux grants et la vue), et procédure de vérification post-migration (script ci-dessus, curl `anon`), pour ne pas rejouer l'incident du 07/09.

### Fichiers à modifier
- `src/lib/catalogue-admin/repository.ts` : deux `select('*')` → colonnes explicites (option A). Aucun changement de comportement pour l'admin.
- `.env.example` : `TEST_BUYER_JWT` (optionnel, pour le script) et `SUPABASE_LOCAL_URL`.

### Tests
- Unitaires/texte : `tests/security/cost-columns-exposure.test.ts`.
- Intégration locale : `cost-columns.integration.test.ts`.
- Post-déploiement prod : `scripts/security/check-cost-exposure.mjs` en `anon`, puis avec un compte acheteur de test non admin ; contrôle visuel de l'admin (onglet catalogue, ouverture d'une fiche, sauvegarde) ; `select count(*) from products_public` en `anon` = nombre d'actifs.

### Risques
- Oublier une colonne référencée par une policy (`is_active`, `id`) : le test d'intégration lit `product_variants` et `stock_lines` en `anon` et `authenticated`.
- Une future colonne ajoutée à `products` sans mise à jour des grants : le runbook et le script de contrôle sont là pour ça ; ajouter le script à la checklist du runbook de déploiement.

### Critères d'acceptation
- `anon` et `authenticated` non admin : impossible de lire `fob_usd`, `qty_per_container`, `is_loss_leader`, `table_price_modifier_rate` via `products`, via une vue ou via une RPC publique.
- Admin : éditeur produit et onglet catalogue fonctionnent sans erreur ; readiness pricing lisible.
- Catalogue public, fiches produit, landings, `product_variants`, `stock_lines` : lisibles en `anon` et `authenticated` (test automatisé).

### Rollback
Migration inverse : `grant select on products to authenticated` (état antérieur), retour des deux `select('*')`. Aucune donnée touchée.

---

## LOT 1 — Fondations, couche de données, feature flag

### Objectifs
1. Déployer du code Studio en production sans l'exposer (flag + preview sécurisé).
2. Créer les tables descriptives qui qualifient le catalogue pour le Studio, sans toucher aux tables existantes.
3. Poser le modèle de readiness, de qualité de données et de fulfillment sans le rendre difficile à étendre.
4. Rendre le catalogue lisible par le Studio via une vue unique, testée en `anon` et `authenticated`.
5. Poser le store client et les types.

### Feature flag et preview (obligatoires avant Lot 2)
- `VITE_STUDIO_ENABLED` (build) : local ON, prod OFF.
- Preview sécurisée sans redéploiement : route serveur `/studio/preview?key=` comparée à `STUDIO_PREVIEW_KEY` (comparaison à temps constant, pattern `api/cron/payment-reminders.ts`), cookie `studio_preview` signé HMAC, `HttpOnly`, `Secure`, TTL 7 jours ; garde de route `beforeLoad` → `notFound()` si flag OFF et pas de cookie ; `noindex` sur toutes les routes Studio tant que le flag prod est OFF ; la clé est révocable en changeant la variable.

### Staging : quand devient-il obligatoire
- Lot 1 et développement du Lot 2 : **non bloqués**. Suffisant : Supabase local (`supabase start`, migrations locales, seed), flag local, preview sécurisée en prod, script de contrôle `anon`/`authenticated`.
- Obligatoire **avant la bêta publique du Lot 2** (ouverture à des visiteurs hors équipe) : environnement `env.staging` dans `wrangler.jsonc` + projet ou branche Supabase séparé, pour tester migrations et flag sans toucher aux données de production.
- Obligatoire **avant le Lot 6** (persistance de données personnelles de projets, emails Brevo réels) et **avant le Lot 8** (Stripe en mode test sur un environnement isolé).

### Fichiers à créer
- `src/lib/studio/flags.ts`, `src/routes/studio.tsx` (layout + garde), `src/routes/studio.preview.tsx`.
- `src/lib/studio/types.ts` : `StudioRole`, `SeatKind`, `SeatMaterial`, `DataQualityStatus`, `DataQualityEntry`, `FulfillmentMode`, `ProjectState`, `CommercialReason`, `StudioProduct`.
- `src/lib/studio/readiness.ts` : voir « Modèle de readiness » ci-dessous.
- `src/lib/studio/fulfillment.ts` : `resolveFulfillment(item, product, stock, production)` → mode ou `manual_review` + raisons ; voir « Modèle de fulfillment ».
- `src/lib/studio/project-state.ts` : `computeProjectState(items)` → `auto_quote_ready | manual_quote_required | reservation_ready | feasibility_review`.
- `src/lib/studio/repository.ts` : lecture de `studio_products` (vue) et des tables descriptives, pattern `src/lib/catalogue/db.ts` (client injecté, fallback vide sans Supabase).
- `src/stores/studio.store.ts` : Zustand `persist`, clé `terrassea-studio-v1`, `version`, `migrate`, journal d'actions inversibles (Undo, profondeur 50).
- `supabase/migrations/2026MMDD_studio_foundation.sql` + `tests/security/studio-foundation-migration.test.ts`.
- `scripts/studio/check-anon-access.mjs` (ou extension du script du Lot 0.5) : `studio_products` lisible en `anon` et `authenticated`, sans colonne de coût.
- `docs/RUNBOOK_STUDIO.md` : flag, preview, rollback, moment du staging.
- `.env.example` : `VITE_STUDIO_ENABLED`, `STUDIO_PREVIEW_KEY`.

### Fichiers à modifier (minimes)
- `src/vite-env.d.ts` : `VITE_STUDIO_ENABLED`.
- `wrangler.jsonc` : bloc `env.staging` préparé mais commenté tant que le projet Supabase de staging n'existe pas (décision Adrien).

### Modèle de qualité de données (`data_quality`)
JSON par produit, une entrée par dimension de qualité :
```
{
  "dimensions":   {"status":"estimated","source":"family_mode","updated_at":"…","by":"migration:studio_foundation"},
  "weight":       {"status":"estimated","source":"family_mode", …},
  "material":     {"status":"estimated","source":"sku_prefix", …},
  "price":        {"status":"pending",  "source":"admin_input", …},
  "compatibility":{"status":"pending",  "source":"none", …},
  "customization":{"status":"pending",  "source":"none", …},
  "media":        {"status":"pending",  "source":"none", …},
  "model_family": {"status":"pending",  "source":"none", …}
}
```
- `status ∈ {verified, estimated, pending}` ; `source ∈ {admin_input, supplier_sheet, sku_prefix, name_heuristic, family_mode, pipeline:<version>, none}`.
- Règle absolue : une valeur issue de `sku_prefix`, `name_heuristic`, `family_mode` ou d'un pipeline est au mieux `estimated`, jamais `verified`. Seul un admin (ou une fiche fournisseur importée avec provenance) peut poser `verified`.
- Le prix saisi par l'admin dans `base_price_ht` reste `pending` tant que l'admin ne l'a pas confirmé explicitement dans l'éditeur Studio (case « prix confirmé »), afin que `quote_ready` ne devienne pas vrai par défaut. Exception pragmatique à décider (voir décisions) : considérer `verified` les prix des produits ayant déjà fait l'objet d'une réservation ou d'un devis partenaire.

### Modèle de readiness (produit)
- `discovery_ready` : actif, `studio_role ≠ catalog_only`, image principale présente (media `≠ pending` n'est pas requis en V0).
- `project_ready` : discovery + dimensions non nulles (verified ou estimated) + prix > 0.
- `quote_ready` : project + `price.status = verified` + `retail_price_ref ≥ base_price_ht` + variante choisie avec photo.
- `reservation_ready` (produit) : quote + `visibility = public` + **au moins une voie de fulfillment ouverte pour ce produit** parmi : stock disponible (`stock_lines` actives avec `available_units > 0`), production standard ouverte (un container `status='open'` acceptant la catégorie, ou un « créneau de production » déclaré par l'admin), production groupée confirmée par l'admin, ou tout mode futur ajouté dans `studio_fulfillment_options`. Le container ouvert est **un** signal, pas la condition.

### Modèle de fulfillment (ligne de projet)
Table `studio_fulfillment_options` (par produit, éventuellement par variante) :
- `mode` texte contraint par `check` (extensible sans migration d'enum) : `stock`, `standard_production`, `grouped_production`, `manual_review`.
- `min_quantity`, `max_quantity` (nullable), `price_basis` (`container` | `stock`), `available_from`, `expires_at`, `note`, `confirmed_by` (admin), `is_active`.
- Peuplement initial : une option `standard_production` par produit actif (`min_quantity = moq_units`, `price_basis = container`) ; une option `stock` par ligne de `stock_lines` active (`max_quantity = available_units`, `price_basis = stock`). Les options `grouped_production` sont créées par l'admin au cas par cas.

`resolveFulfillment(item)` (fonction pure, Lot 1, testée) :
1. Si une option `stock` active couvre la quantité (`available_units ≥ requested_quantity`) → `stock` (aucune raison `below_moq`, même sous MOQ).
2. Sinon si `requested_quantity ≥ min_quantity` d'une option `standard_production` active → `standard_production`.
3. Sinon si une option `grouped_production` confirmée couvre la quantité → `grouped_production`.
4. Sinon → `manual_review` avec raisons (`below_moq`, `colour_minimum`, `stock_insufficient`, `on_request_product`, `price_unconfirmed`, `dimensions_unconfirmed`, `compatibility_unconfirmed`, `custom_colour_requested`, `custom_tabletop_requested`).

Le stock est donc consulté **avant** d'assigner `below_moq`. Aucune fonction ne renvoie d'erreur ; toutes renvoient un mode et des raisons. Le moteur complet (regroupements, créneaux) n'est pas implémenté au Lot 1 ; seule la structure et la résolution de base le sont.

### Modèle d'état de projet
`computeProjectState(items)` :
- `reservation_ready` : toutes les lignes ont un mode ≠ `manual_review`, tous les produits sont `reservation_ready`, aucune raison ouverte.
- `auto_quote_ready` : toutes les lignes ont un mode ≠ `manual_review` et tous les produits sont `quote_ready`, mais au moins une condition de réservation manque (ex. prix confirmé mais aucune voie ouverte à cette date).
- `feasibility_review` : au moins une ligne en `manual_review` pour une raison de quantité/stock (`below_moq`, `stock_insufficient`) sans autre blocage de données.
- `manual_quote_required` : au moins une ligne en `manual_review` pour une raison de données ou de personnalisation (`price_unconfirmed`, `on_request_product`, `custom_*`, `compatibility_unconfirmed`).
Ordre de priorité si plusieurs raisons : `manual_quote_required` > `feasibility_review` > `auto_quote_ready` > `reservation_ready`. Aucun état n'interdit la découverte, les favoris, la sélection, la création du projet, le plateau, le pied, la personnalisation, la sauvegarde ni l'envoi d'une demande.

### Migration (additive, résumé)
```sql
create table studio_model_families (id text primary key, label text not null, notes text, status text not null default 'candidate' check (status in ('candidate','verified','rejected')), created_at timestamptz default now());

create table studio_product_profiles (
  product_id text primary key references products(id) on delete cascade,
  studio_role text not null default 'catalog_only' check (studio_role in ('seat','tabletop','base','catalog_only')),
  seat_kind text check (seat_kind in ('chair','armchair','stool','lounger','other')),
  material text check (material in ('pe_weave','cane','rope','textilene','aluminium','hpl','metal','other')),
  model_family_id text references studio_model_families(id),      -- null au peuplement, jamais déduit du nom
  visual_traits jsonb,                                              -- rempli par le pipeline (Lot 3), avec {version, computed_at}
  data_quality jsonb not null default '{}'::jsonb,
  price_confirmed_at timestamptz, price_confirmed_by uuid,
  notes text, updated_by uuid, updated_at timestamptz default now()
);
create table studio_fulfillment_options ( … voir modèle ci-dessus … );
create view studio_products with (security_invoker = true) as
  select p.*, sp.studio_role, sp.seat_kind, sp.material, sp.model_family_id, sp.visual_traits, sp.data_quality
  from products_public p left join studio_product_profiles sp on sp.product_id = p.id;
grant select on studio_products to anon, authenticated;
-- RLS : select public sur profils, familles, options de fulfillment ; write admin via is_admin().
```
Peuplement initial (idempotent, `insert … on conflict do nothing`) : `studio_role` dérivé de `category` ; `seat_kind` chair/armchair, `stool` si le nom contient « haute », `lounger` si « bain de soleil » ; `material` par préfixe SKU (BIS → pe_weave, ROP → rope, TES → textilene, plateaux HPL → hpl, LOUVRE → metal) avec `data_quality.material = {estimated, sku_prefix}` ; `model_family_id = null` ; `visual_traits = null` ; dimensions/poids : `estimated` + `family_mode` si la valeur est la valeur modale de la famille, `pending` si nulle, sinon `estimated` + `admin_input` ; prix : `pending`. Les 7 fiches mal catégorisées (ROP-031, ROP-016, TES-031, BIS-049, TBA-010, TES-024, TES-043) sont forcées `catalog_only` jusqu'à correction manuelle. Aucun `style_tags`.

### Tests
- `readiness.test.ts` : matrice (image absente, prix pending, retail < base, produit sans voie de fulfillment mais container ouvert pour une autre catégorie, produit en stock sans container ouvert → `reservation_ready` vrai).
- `fulfillment.test.ts` : 6 chaises MOQ 50 avec 30 en stock → `stock` ; 6 sans stock → `manual_review` + `below_moq` ; 60 → `standard_production` ; jamais d'exception.
- `project-state.test.ts` : priorités d'état.
- `studio.store.test.ts` : persist, migrate, undo.
- Migration : tests texte ; script REST `anon` + `authenticated` (`studio_products` sans colonne de coût, compte = actifs).
- Route : `/studio` 404 flag OFF, 200 avec cookie preview, `noindex`.

### Risques
- Vue `security_invoker` : reprendre exactement la liste de colonnes accordées à `anon` et `authenticated` (Lot 0.5) ; toute colonne ajoutée à `products` impose la mise à jour des deux grants (runbook).
- `price.status = pending` par défaut rendrait `quote_ready` faux pour tout le catalogue au démarrage : prévoir dans l'admin une confirmation en masse par famille (action explicite, tracée) ou l'exception pragmatique listée dans les décisions.

### Critères d'acceptation
- `bun run check` vert ; `/studio` invisible en prod, visible en local et en preview.
- `studio_products` lisible en `anon` et `authenticated` sans colonne de coût ; 100 % des actifs ont un profil ; 87 assises ont `seat_kind` et `material` (estimés) ; `model_family_id` null partout ; aucun `style_tags`.
- `resolveFulfillment` et `computeProjectState` ne lèvent jamais d'erreur sur une quantité valide ≥ 1.

### Rollback
`drop view studio_products; drop table studio_fulfillment_options, studio_product_profiles, studio_model_families;` ; retirer le flag. Aucun impact catalogue.

---

## LOT 2 — Tranche verticale Assises

> État réel (09/2026) : livré sur la branche `claude/studio-lot-2` (moteur V0 `v0.1`, routes `/studio` et `/studio/assises`, composants Studio, store v2, `POST /api/studio/events`, migration 40 `20260907130000_studio_sessions_events.sql` **appliquée en production**, Lot 2 PRODUCTION VERIFIED, hotfix preview Path=/ déployé et validé). L'étape 2.0 n'a créé que l'infrastructure (`studio_curation_sets` vide, `?set=pilot` géré sans jeu) ; la curation qualitative attend les métriques du lot 3. Duels désactivés, `studio_diagnostic_pairs` vide. Détails : `docs/RUNBOOK_STUDIO.md`.

### Objectifs
Parcours Assises complet avec le moteur **V0 heuristique** : entrée (Projet complet / Assises / Tables), découverte carte par carte, J'aime / Pas pour moi / Passer, Undo, favoris, finalistes (3 max), choix d'une assise, quantité libre, rail projet desktop, barre projet mobile. Les branches Tables renvoient vers le catalogue tant que le Lot 4 n'est pas livré. Le Lot 2 fonctionne sur **toutes** les assises `discovery_ready` ; l'évaluation qualitative se fait sur le jeu curé de l'étape 2.0.

### Moteur V0 : ce qu'il est et ce qu'il n'est pas
- Rôle : développer l'UX, garantir la diversité, enregistrer correctement les interactions, tester les transitions et l'Undo. Il **ne prétend pas** comprendre le goût ; l'interface n'affiche aucune formulation du type « nous avons compris votre style » avant le Lot 3. Vocabulaire autorisé : « Voici des assises variées », « Vos favoris », « Vos finalistes ».
- Signaux utilisés avec prudence : `material`, `seat_kind`, `model_family_id` **vérifiée uniquement** (`studio_model_families.status = verified`), diversité, likes / dislikes / pass.
- **Prix : poids zéro** dans le score de découverte. Le prix n'est ni un signal ni un filtre pendant la découverte ; il apparaît à la comparaison des finalistes et dans le projet, et pourra alimenter une demande explicite (« réduire le budget », « monter en gamme ») au Lot 3 ou plus tard, hors profil esthétique.
- Ordre initial : round-robin déterministe par `material` puis `seat_kind`, seedé par `sessionId`.
- Score : `+1` par like / `−1` par dislike sur `material`, `seat_kind`, famille vérifiée ; `pass` = vu, poids 0 ; bonus nouveauté ; malus répétition (même famille ou même matière 3 fois de suite) ; exploration ε = 0,2 seedée.
- Finalistes : 3 maximum parmi les favoris, 2 si le troisième n'a pas de score positif ; action « Voir plus de finalistes » qui en ajoute par groupe de 2.
- Duels : **désactivés par défaut** au Lot 2. L'architecture les supporte (`studio_diagnostic_pairs` lu par le moteur) mais l'UX ne crée aucune paire automatique ; les duels ne s'affichent que si des paires diagnostiques explicites existent pour les finalistes en présence (saisies à la main par l'admin ou produites au Lot 3).
- Interface `nextCard(state, catalogue, version)` pure, `ALGORITHM_VERSION = 'v0.x'` inscrit dans chaque événement et chaque projet.

### Étape 2.0 — Curation pilote (avant évaluation qualitative)
- Sélection d'environ 30 à 50 assises parmi les `discovery_ready`, basée sur des critères objectifs : score de qualité de Decision Image (issu du pipeline, Lot 3), diversité de `material` et `seat_kind`, métriques d'image calculées (rapport largeur/hauteur de silhouette, densité de contours comme proxy de complexité, contraste global), une seule référence par famille candidate identique (structure, dimensions, prix identiques). Aucun étiquetage manuel de style.
- Stockage : table `studio_curation_sets` (id, label, `product_ids text[]`, `criteria jsonb`, `created_by`) ; le flag `?set=pilot` (preview uniquement) restreint la découverte au jeu curé.
- Le Livrable 5 fournit la méthode et une première liste de candidats à confirmer par ces métriques.

### Fichiers à créer
- `src/routes/studio.index.tsx`, `src/routes/studio.assises.tsx`.
- `src/components/studio/` : `StudioShell`, `DecisionCard` (image dominante, nom, matière, une spécification, trois boutons visibles ≥ 44 px, `aria-label`, raccourcis clavier documentés), `DecisionActions`, `UndoButton`, `FavoritesTray`, `Finalists` (≤ 3, « voir plus »), `SeatQuantityField` (quantité libre ≥ 1 ; affiche la règle `getQuantityRule` à titre informatif ; badge de mode de fulfillment / raisons ; jamais d'arrondi imposé), `ProjectRail` (desktop), `ProjectBottomBar` (mobile), `StudioProductDetails` (réutilise galerie, specs, `DesignSelector` de `ProductDetailDialog`, sans stepper).
- `src/lib/studio/engine/{index,v0,scoring,diversity}.ts`.
- `src/lib/studio/events.ts`, `src/routes/api/studio/events.ts` (POST, origin-check, `enforceApiRateLimit`, zod, écriture `studio_events` via `service_role`).
- Migration `studio_sessions`, `studio_events`, `studio_curation_sets`, `studio_diagnostic_pairs` (vide) + tests texte.
- `src/components/Header.tsx` : lien « Studio » sous flag.

### Fichiers à modifier
- `src/lib/analytics.ts` : événements miroir marketing minimaux (`studio_started`, `project_completed`), soumis au consentement.
- `src/hooks/useFavorites.ts` : inchangé ; miroir des favoris Studio dans `product_favorites` pour les connectés via les fonctions existantes.

### Tests
- `engine/v0.test.ts` : déterminisme pour un seed ; diversité initiale ; effet like/dislike/pass ; malus répétition ; **le prix n'influence jamais l'ordre** (deux catalogues identiques à prix différents → même séquence) ; famille non vérifiée ignorée ; finalistes ≤ 3 ; aucun duel sans paire explicite.
- `DecisionCard.test.tsx`, `SeatQuantityField.test.tsx` (6 unités acceptées, mode/raisons affichés, aucun blocage, aucun arrondi), `-events.test.ts`.
- E2E local : mobile + desktop, clavier, Undo, session persistée, jeu curé via preview.

### Risques
- Perception d'un moteur « bête » : assumée et annoncée dans l'UX ; l'évaluation qualitative porte sur l'UX et la diversité, pas sur la pertinence.
- Poids des images sans Decision Images : `loading="eager"` sur la carte courante, préchargement des 2 suivantes ; corrigé au Lot 3.

### Critères d'acceptation
- Un visiteur anonyme sur mobile choisit une assise avec une quantité de 6 (MOQ 50) : il voit « Quantité sous le minimum de série : nous étudions la faisabilité » ou « Disponible en stock » selon le stock, et continue sans obstacle.
- Undo exact ; tout au clavier ; `prefers-reduced-motion` respecté.
- Aucun prix dans le calcul du moteur (test dédié) ; aucune promesse de compréhension dans les textes ; finalistes ≤ 3.

### Rollback
Flag OFF ; suppression des routes ; `drop table studio_events, studio_sessions, studio_curation_sets, studio_diagnostic_pairs`.

---

## LOT 3 — Pipeline visuel, Decision Images, embeddings, moteur V1

> Implémentation locale sur `codex/studio-lot-3` depuis `2ee0174` : Decision Images, pipeline DINOv2 offline, migration 41, admin, V1 et convergence adaptative. Migration 41 **NON APPLIQUÉE PROD**, couverture réelle non établie. Le [runbook Lot 3](docs/STUDIO_LOT_3_RUNBOOK.md) décrit les contrats effectivement implémentés, seuils, tests et actions humaines. Les critères de couverture ci-dessous concernent DATA READY, pas le seul code.


### Objectifs
1. Decision Images standardisées en **étendant** le pipeline existant (`src/lib/images/normalize-packshot.ts`, `scripts/normalize-packshots.mjs`) : pas de second pipeline.
2. `visual_traits` objectifs par assise (calculés, versionnés, contrôlables), features et voisins précalculés, paires diagnostiques réelles.
3. Familles de design proposées par similarité et **validées** par l'admin.
4. Moteur V1 versionné, A/B par session.

### Decision Images (extension du pipeline existant)
- `scripts/normalize-packshots.mjs` gagne un mode `--role decision` : mêmes primitives (détection fond blanc, trim, canevas carré, marge), sortie fixe 1 200×1 200 + 600×600, WebP q85, préfixe Storage `studio/`, sans jamais écraser `main_image_url`.
- Transformations autorisées : recadrage, fond blanc, redimensionnement, correction d'exposition globale légère. **Interdites** : toute modification du design réel (retouche de couleur locale, remplissage génératif, suppression d'éléments du produit, changement de proportions).
- Ajouts en base (`studio_product_media`) : `role` (`decision`, `thumb`), `quality_score` (0–1, calculé : fond, centrage, netteté, taille du produit dans le cadre), `pipeline_version`, `source_url`, `validated_by` / `validated_at` (validation admin), `rejected_reason`.
- Admin : `AdminStudioTab` (liste, aperçu avant/après, valider/rejeter, relancer).
- `src/lib/images/normalize-packshot.ts` : extraction des primitives partagées (détection fond, bounding box) pour que le script et l'admin utilisent le même code ; aucun changement de comportement pour l'upload admin actuel.

### `visual_traits` (objectifs, calculés)
Par assise et par Decision Image validée : `silhouette_ratio`, `edge_density` (complexité), `global_contrast`, `dominant_colors[]` (hex + part), `pattern_score` (régularité de motif), `openness` (proportion de vide dans la silhouette, proxy fine/enveloppante). Stockés dans `studio_product_profiles.visual_traits` avec `{version, computed_at}` ; `data_quality.media = {estimated, pipeline:vX}`. Ces traits alimentent la curation (étape 2.0), la diversité et, plus tard, des filtres explicites ; ils ne sont pas des étiquettes de style et ne sont jamais présentés comme telles.

### Features, voisins, paires
- `pipeline/` (Python isolé, `requirements.txt`, jamais dans le build Cloudflare) ou `scripts/studio/*.mjs` : embeddings image (modèle open source local), écriture `studio_product_visual_features` (`features jsonb`, `embedding float8[]`, `model_version`), voisins k = 12 (`studio_product_neighbors`), paires diagnostiques = paires maximisant la distance sur un axe mesuré (`studio_diagnostic_pairs.axis` ∈ traits ci-dessus ou embedding), avec `source = pipeline` et `pipeline_version` séparée ; l'admin peut aussi saisir des paires `source = manual`.
- `pgvector` : optionnel ; à activer seulement si le calcul des voisins en SQL est préféré. Le runtime n'exécute jamais d'opération vectorielle.

### Familles de design
- `scripts/studio/propose-families.mjs` : groupes par similarité d'embedding **et** identité de structure (dimensions, poids, prix, préfixe) → `studio_model_families` en `status = candidate` + `studio_model_family_candidates` (product_id, family_id, score). Jamais par le nom.
- Admin : validation/refus des candidats ; seules les familles `verified` sont utilisées par les moteurs.

### Moteur V1
- Score = affinité visuelle (similarité moyenne aux likes − aux dislikes) + nouveauté + diversité (pénalité de proximité aux 5 dernières cartes) + exploration ε ; plusieurs directions de goût = clustering des likes (k = 2 ou 3) et alternance ; prix toujours à poids zéro dans le score de découverte ; demandes explicites de budget traitées comme filtre séparé après finalisation.
- Duels activés uniquement sur paires diagnostiques existantes pour les finalistes en présence.

### Tests
- Pipeline : idempotence, sortie 1 200×1 200 fond blanc, `quality_score` bas sur une image à fond gris de fixture, aucune modification de pixel du produit hors recadrage (comparaison de la zone produit).
- `engine/v1.test.ts` : jeu de features synthétiques à 2 clusters ; après 3 likes dans A, ≥ 70 % des 10 suivantes viennent de A hors exploration ; un dislike éloigne ; diversité ; prix sans effet.
- `check-visual-coverage.mjs` : assises sans Decision Image validée ou sans voisins.

### Risques
- Packshots hétérogènes : passe admin sur les rejets.
- Dépendance Python : isolée hors Worker ; exécution sur la machine d'Adrien ou en GitHub Actions avec secrets.

### Critères d'acceptation
- ≥ 90 % des assises `discovery_ready` ont une Decision Image validée et 12 voisins ; `visual_traits` présents ; familles utilisées = `verified` uniquement ; V1 remplace V0 sans changer store ni interface.

### Rollback
`studio_algorithm_versions.status = disabled` pour V1 ; repli V0 au rechargement, attribution de session conservée et tables visuelles conservées. Aucun rollout public.

---

## LOT 4 — Plateaux et piètements

### Plateaux : expérience volontairement légère
- Pas de moteur de goût. Trois choix directs : forme → dimension → finition (décor), avec photo de variante, prix, MOQ et minimum coloris affichés. **Toutes** les possibilités disponibles sont affichées ; le moteur pourra plus tard réordonner (ex. forme cohérente avec le nombre d'assises), jamais masquer une sélection, même petite.
- Quantité de tables suggérée = `ceil(assises / 2)`, toujours modifiable ; suggestion de forme informative selon `seat_kind` et quantité.
- Sur mesure : `CustomTableTopDialog` réutilisé tel quel ; la demande devient une ligne `custom_tabletop` du projet, mode `manual_review`, raison `custom_tabletop_requested`.

### Piètements : compatibilité déterministe, IA sans rôle
- `src/lib/studio/compatibility.ts` réutilise `table-composer.ts` (`isCompatibleTop`, `compatibleBases`, `composedQuantityRule`, `composedCartLines`) et ajoute une couche de règles : exception par couple (`studio_tabletop_base_rules` avec `base_id` + `tabletop_id`) > règle générale par type de piètement, forme et dimension max > `compatible_top_shapes` **seulement si non vide** (une liste vide n'est plus « tout accepté » dans le Studio ; le composer catalogue garde son comportement actuel) > sinon `requires_confirmation`.
- **Seuls les piètements `allowed` sont proposés.** Les `requires_confirmation` ne sont pas sélectionnables ; un bouton « Aucun piètement compatible ? Demander une vérification » crée une ligne `manual_review` (raison `compatibility_unconfirmed`). Les `forbidden` ne sont jamais montrés.
- Conséquence : tant que les règles ne sont pas saisies, aucun piètement n'est proposé. La saisie des règles générales (8 piètements × 5 plateaux, 40 couples ou quelques règles par type) est un **prérequis de livraison** du Lot 4, à valider par Adrien (l'IA ne propose aucune valeur).
- Admin : `AdminStudioRulesTab` (CRUD, `verified_by`).

### Fichiers à créer
`src/routes/studio.tables.tsx`, `src/components/studio/{TabletopPicker,BasePicker,TableQuantityField}.tsx`, `src/lib/studio/{compatibility,table-suggestion}.ts`, migration `studio_tabletop_base_rules`, onglet admin.

### Tests
- `compatibility.test.ts` : exception > règle > `compatible_top_shapes` non vide > `requires_confirmation` ; liste vide ≠ allowed ; aucun `allowed` sans règle.
- `table-suggestion.test.ts` : 6 → 3, 7 → 4, 50 → 25 ; suggestion modifiable.
- E2E : parcours assise → plateau → piètement, cas « aucun compatible ».

### Critères d'acceptation
- Aucun couple `allowed` sans règle en base ; aucune sélection de plateau cachée ; quantité de tables jamais imposée.

### Rollback
`drop table studio_tabletop_base_rules` ; le Studio Tables se replie sur « demander une vérification ».

---

## LOT 5 — Personnalisation

Inchangé sur le fond (voir version 1) : `studio_option_groups`, `studio_options` (RAL/Pantone de référence, `is_on_request`), `studio_variant_options`, `studio_product_zones` ; `resolveVariantForOptions` renvoie une variante existante (prix et minimum réels) ou `null` → ligne `manual_review`, raison `custom_colour_requested` ; script de proposition de rattachements à partir des noms de variantes, **sans insertion automatique** ; `data_quality.customization` passe à `verified` uniquement après validation admin des rattachements.

Tests, risques, acceptation et rollback : identiques à la version 1.

---

## LOT 6 — Sauvegarde, reprise, versions, partage

Inchangé sur le fond : `studio_projects` (contact minimal prénom, nom, email ; token haché ; `status` texte contraint : `draft | saved | quoted | reserved | archived` ; `project_state` calculé et stocké à chaque version), `studio_project_versions` (`reason` : `initial | seat_replaced | tabletop_replaced | base_replaced | variant_saved | quantity_changed | quote_generated | manual` ; `payload` = lignes `{product_id, variant_id, requested_quantity, role, options[], fulfillment_mode, reasons[], price_basis}` ; `catalog_snapshot`), `studio_project_shares` (lecture seule, expiration), RPC `security definer` à écriture étroite, rattachement par `claim_my_studio_projects` sur email vérifié. Staging obligatoire avant ce lot (données personnelles, emails réels).

---

## LOT 7 — Devis

- `studio_quotes` : `snapshot`, `pricing_parameters_snapshot`, `project_state` au moment de l'émission, `reasons[]`, `valid_until`, `pdf_path` (bucket `reservation-quotes` à créer par migration), `price_basis` par ligne (container ou stock).
- Émission : server function qui recalcule côté serveur depuis `studio_products` et `get_public_pricing_rules` ; `auto_quote_ready` → devis ferme ; `feasibility_review` ou `manual_quote_required` → **devis indicatif** portant la mention « sous réserve d'étude » + notification admin ; jamais de refus.
- Réutilisation de `buildQuoteHTML` ; extraction en lecture des textes fixes dans `src/lib/commercial-policy.ts` (validité, TVA, garantie) pour que catalogue et Studio lisent la même source.

Tests, acceptation et rollback : version 1, plus test « devis indicatif sous MOQ sans stock » et « devis ferme sous MOQ avec stock suffisant ».

---

## LOT 8 — Réservation

- Conversion projet → panier (`projectToCartLines`) **uniquement** si `project_state = reservation_ready` ; les lignes en mode `stock` suivent le chemin `stock_requests` existant (prix stock), les lignes en `standard_production` / `grouped_production` suivent `ReservationDialog` → `create_reservation_with_items`. Un projet mixte génère les deux demandes ; le projet est marqué `reserved` avec les identifiants correspondants (colonnes sur `studio_projects`, pas sur `reservations`).
- Aucune modification de `ReservationDialog`, du RPC, du webhook Stripe.

Tests, acceptation et rollback : version 1, plus test « projet en `feasibility_review` ne peut pas atteindre Stripe ».

---

## LIVRABLE 3 — Schéma de données proposé (mis à jour)

| Concept | Réutilisation existante | Extension proposée | Nouveau stockage |
|---|---|---|---|
| Produits | `products`, `products_public` | vue `studio_products` | `studio_product_profiles` (role, kind, material, `model_family_id` null par défaut, `visual_traits` calculés, `data_quality` granulaire avec provenance, `price_confirmed_at`) |
| Familles de design | — | — | `studio_model_families` (statut candidate / verified / rejected), `studio_model_family_candidates` (propositions du pipeline) |
| Fulfillment | `stock_lines`, `containers`, `moq_units` | — | `studio_fulfillment_options` (mode texte contraint, extensible : stock, standard_production, grouped_production, manual_review ; min/max ; price_basis ; validité ; confirmation admin) |
| Variantes | `product_variants` | — | `studio_variant_options` |
| Médias | `catalogue-images`, pipeline packshot existant | préfixe `studio/`, mode `--role decision` | `studio_product_media` (role, quality_score, pipeline_version, validation admin) |
| Zones / options | — | — | `studio_product_zones`, `studio_option_groups`, `studio_options` |
| Visual features | — | `vector` optionnel | `studio_product_visual_features` |
| Neighbors | — | — | `studio_product_neighbors` |
| Diagnostic pairs | — | — | `studio_diagnostic_pairs` (axis mesuré, source manual / pipeline) |
| Compatibilité | `compatible_top_shapes` (repli si non vide), `table-composer.ts` | — | `studio_tabletop_base_rules` (verdict allowed / forbidden / requires_confirmation, verified_by) |
| Curation | — | — | `studio_curation_sets` |
| Sessions, interactions | localStorage, `AnalyticsEvent` (miroir) | — | `studio_sessions`, `studio_events` (écriture serveur) |
| Projets, versions, contacts, partages | `partner_selections`, `reservations.contact_snapshot`, `claim_my_reservations` | — | `studio_projects` (état projet stocké), `studio_project_versions`, `studio_project_shares` |
| Devis | `buildQuoteHTML`, bucket `reservation-quotes` | migration du bucket | `studio_quotes` |
| Versions d'algorithme | — | — | `studio_algorithm_versions` |

Choix d'implémentation : `text + check` plutôt qu'`enum` pour `studio_role`, `mode`, `status`, `project_state`, afin d'ajouter des valeurs par simple migration de contrainte (les enums Postgres se modifient aussi, mais les contraintes textuelles évitent le piège des deux `reservation_status` homonymes relevé par l'audit).

---

## LIVRABLE 4 — Data gap report (mis à jour)

### Déjà disponible
SKU 100 % ; catégorie 100 % ; image principale 98 % des assises actives ; galerie ≥ 2 photos sur 92 % ; prix pro 100 % (mais `price.status = pending` tant que non confirmé) ; MOQ 100 % ; minimum coloris 6 variantes ; forme et dimensions des plateaux 100 % ; règles de prix publiques 100 % ; stock : 7 lignes (5 avec unités).

### À vérifier (jamais `verified` automatiquement)
Dimensions et poids des assises (valeurs modales par famille → `estimated`/`family_mode`) ; `cbm_per_unit` par défaut sur 13 produits ; catégorie de 7 produits ; prix public < prix pro (BIS-030, ROP-001, TES-027) ; décors HPL (3 orthographes) ; 52 variantes « Design présenté » ; dimensions d'embase des piètements ; matière des 10 fiches SKU-*/SK-*/CHA-* (`sku_prefix` ne s'applique pas).

### À ajouter manuellement (admin, jamais par heuristique)
Confirmation des prix (`price_confirmed_at`) ; correction ou exclusion des 7 catégories ; règles de compatibilité plateau/piètement (prérequis Lot 4) ; validation des Decision Images (Lot 3) ; validation des familles candidates (Lot 3) ; rattachement variantes ↔ options (Lot 5) ; options de fulfillment `grouped_production` au cas par cas ; un container ouvert ou un créneau de production déclaré pour que `standard_production` soit « ouvert ».

### Automatisable plus tard (avec provenance `pipeline:vX`)
Decision Images et `quality_score` ; `visual_traits` ; embeddings, voisins, paires diagnostiques ; candidats de familles ; propositions de rattachement options ; normalisation des noms de décors ; curation pilote par métriques.

### Bloquant pour le Lot 2 (développement)
Lot 0.5 terminé ; vue `studio_products` + profils (Lot 1) ; flag + preview ; exclusion `catalog_only` des 7 fiches douteuses.

### Bloquant pour l'évaluation qualitative du Lot 2
Decision Images + métriques objectives sur les candidats (Lot 3, partie images) ; jeu curé enregistré (`studio_curation_sets`).

### Non bloquant pour le Lot 2
Poids/dimensions vérifiés (badge « estimé ») ; familles vérifiées ; embeddings ; règles de compatibilité ; options ; container ouvert ; staging (obligatoire seulement avant bêta publique).

---

## LIVRABLE 5 — Dataset pilote (méthode mise à jour, sans étiquetage de style)

### Méthode
1. Base : assises `discovery_ready` (image principale, dimensions non nulles, prix > 0, prix public ≥ prix pro, hors `catalog_only`) : 74 candidates.
2. Exclusions objectives : chaises hautes (TES-024, TES-043), fiches sans dimensions (SKU-321, 324, 336, 368, 369, 521, BIS-061), incohérence prix (BIS-030), galeries ≤ 2 photos (BIS-047, BIS-051, ROP-034, ROP-038, ROP-043, TES-037, TES-044, CHA-CAN-001).
3. Decision Images générées pour les candidates restantes ; ne garder que `quality_score ≥ 0,7` validées admin.
4. Diversité par `material` et `seat_kind` ; une seule référence par groupe de structure identique (dimensions, poids, prix, préfixe identiques → probable même design en plusieurs coloris) ; complément par écart maximal sur `silhouette_ratio`, `edge_density`, `global_contrast` (métriques calculées, pas de jugement subjectif).
5. Taille cible 30 à 50 ; enregistrement dans `studio_curation_sets` avec les critères utilisés.

### Candidats (44) proposés par les données actuelles, à filtrer par les métriques de l'étape 3
- Tressage PE / cannage (BIS) — 18 : BIS-001, 002, 003, 004, 005, 023, 024, 025, 027, 039, 045, 057, SK-456, SKU-659, SKU-698, SKU-785 (chaises) ; BIS-010, 020, 070 (fauteuils).
- Cordage (ROP) — 12 : ROP-008, 009, 010, 024, 035, 037, 039, 040, 041, 042 (chaises) ; ROP-002, 003, 007 (fauteuils).
- Textilène (TES) — 14 : TES-002, 012, 013, 019, 022, 026, 029, 033, 038, 042 (chaises) ; TES-001, 010, 011, 023, 028 (fauteuils).

### Couverture et limites
| Axe | Source | Statut |
|---|---|---|
| cordage / textilène / tressage PE | `material` (estimé par préfixe SKU) | disponible |
| aluminium | absent comme matière d'assise (toutes structures alu) | axe inexistant, ne pas l'inventer |
| chaise / fauteuil | `seat_kind` | disponible (BIS-049 à reclasser) |
| silhouette, complexité, contraste | `visual_traits` calculés | disponible après Lot 3 (images) |
| sobre / graphique / premium / bistrot… | — | **hors périmètre** : aucune étiquette subjective |

Limites : dimensions et poids des candidats majoritairement estimés ; groupes « même design » = hypothèse à valider visuellement ; galeries courtes sur les 12 fiches du 06/09 ; aucune donnée structurée d'empilabilité, d'accoudoirs ou de hauteur d'assise.

---

## Tests transverses (récapitulatif)

Unit : scoring V0/V1 (prix sans effet), likes/dislikes/pass, undo, readiness par voie de fulfillment, `resolveFulfillment` (stock avant `below_moq`), états projet, compatibilité (liste vide ≠ allowed), snapshot prix, versions, conversion panier.
Integration : création projet, sélection, plateau, pied, sauvegarde, reprise, variante, devis ; tests texte de chaque migration ; contrôle REST `anon` **et** `authenticated` sur `products`, `products_public`, `studio_products`.
E2E : mobile et desktop, clavier seul, undo, session anonyme, partage lecture seule, `reducedMotion`.
Accessibilité : `@axe-core/playwright` sur les routes Studio.
