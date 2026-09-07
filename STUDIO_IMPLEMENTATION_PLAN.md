# STUDIO PROJET — PLAN D'IMPLÉMENTATION

Compagnon de `STUDIO_PROJECT_AUDIT.md` (07/09/2026). Ce plan ne contient aucune implémentation ; il décrit lot par lot ce qui sera créé, modifié, migré et testé, avec critères d'acceptation et rollback. Tout est **additif** : aucune colonne existante n'est modifiée ni supprimée, aucun chemin commercial existant (panier, réservation, Stripe, devis) n'est réécrit.

Règle transverse (rappel) : `AI may rank, compare, interpret and explain. AI must never create, alter or infer commercial facts used for pricing, compatibility, availability or reservation.` Concrètement : tout ce qui est prix, MOQ, dimensions, matières, disponibilité, compatibilité, coloris, conditions, garanties, délais et réservation est lu depuis Postgres, jamais calculé par le moteur de recommandation.

---

## Vue d'ensemble des lots

| Lot | Contenu | Dépend de | Bloquant pour |
|---|---|---|---|
| 0 | Audit (ce document + l'audit) | — | tous |
| 1 | Fondations : flag, staging, tables `studio_*` de base, readiness, vue `studio_products`, store | 0 | 2 à 8 |
| 2 | Tranche verticale Assises (découverte, j'aime / pas pour moi / passer, undo, favoris, finalistes, choix, quantité, rail + barre) | 1 | 4 |
| 3 | Pipeline visuel : Decision Images, features, voisins, paires diagnostiques, versions d'algorithme | 1 (2 pour brancher) | moteur V1 complet |
| 4 | Plateaux + piètements (règles de compatibilité, quantité suggérée) | 1, 2 | 5 |
| 5 | Personnalisation (groupes d'options, zones) | 1, 4 | 7 (option snapshot) |
| 6 | Sauvegarde projet, reprise, versions, partage lecture seule | 1, 2 | 7, 8 |
| 7 | Devis (snapshot figé, statut commercial, PDF) | 6 | 8 |
| 8 | Réservation (conversion projet → RPC existant) | 7 | — |

Les lots 3 et 5 peuvent avancer en parallèle de 2 et 4.

---

## LOT 0 — Audit

Terminé. Livrables : `STUDIO_PROJECT_AUDIT.md`, ce plan. Décisions actées par l'audit :
- pas de modification de `products` / `product_variants` ;
- moteur déterministe TypeScript, features visuelles calculées hors ligne ;
- `pgvector` reporté au Lot 3 et optionnel ;
- MOQ non bloquant via un statut commercial de projet ;
- réutilisation de `create_reservation_with_items`, `buildQuoteHTML`, `getQuantityRule`, `table-composer.ts`, `product_favorites`, tokens et primitives UI existants.

---

## LOT 1 — Fondations, couche de données, feature flag

### Objectifs
1. Pouvoir déployer du code Studio en production sans l'exposer.
2. Disposer d'un environnement de préproduction distinct.
3. Créer les tables descriptives qui qualifient le catalogue pour le Studio, sans toucher aux tables existantes.
4. Rendre le catalogue lisible par le Studio via une vue unique et testée en `anon`.
5. Poser le store client et les types.

### Fichiers à créer
- `src/lib/studio/flags.ts` : `isStudioEnabled()` (lecture `import.meta.env.VITE_STUDIO_ENABLED === 'true'`) et `hasStudioPreview(request)` côté serveur (cookie `studio_preview` signé HMAC avec `STUDIO_PREVIEW_KEY`, TTL 7 jours).
- `src/routes/studio.tsx` : layout vide + `beforeLoad` qui appelle `notFound()` si flag OFF et pas de cookie de prévisualisation ; `head()` avec `noindex` tant que le flag prod est OFF.
- `src/routes/studio.preview.tsx` : route serveur qui compare `?key=` à `STUDIO_PREVIEW_KEY` (comparaison constante, pattern de `api/cron/payment-reminders.ts`) et pose le cookie.
- `src/lib/studio/types.ts` : `StudioRole`, `SeatKind`, `SeatMaterial`, `DataQualityStatus` (`verified | estimated | pending`), `StudioProduct` (= `Product` + profil), `CommercialStatus` (`standard | feasibility_review | manual_quote_required`), `CommercialReason` (`below_moq | colour_minimum | on_request_product | unconfirmed_price | unconfirmed_dimensions | compatibility_unconfirmed`).
- `src/lib/studio/readiness.ts` : fonctions pures `computeReadiness(product, profile)` → `{ discovery_ready, project_ready, quote_ready, reservation_ready, reasons[] }`. Règles proposées :
  - `discovery_ready` : image principale présente, `studio_role ≠ catalog_only`, `is_active`.
  - `project_ready` : discovery + dimensions non nulles (verified ou estimated) + prix > 0.
  - `quote_ready` : project + `data_quality.price = verified` + `retail_price_ref ≥ base_price_ht` + toutes les variantes choisies ont une photo.
  - `reservation_ready` : quote + `visibility = public` + container ouvert.
- `src/lib/studio/commercial-status.ts` : `computeCommercialStatus(items, rules)` → statut + raisons. Ne bloque jamais ; réutilise `getQuantityRule` (lecture) pour détecter `below_moq` et `colour_minimum`.
- `src/lib/studio/repository.ts` : lecture de `studio_products` (vue) et `studio_product_profiles`, même pattern que `src/lib/catalogue/db.ts` (client injecté, mapping row → type, fallback vide sans Supabase).
- `src/stores/studio.store.ts` : Zustand `persist`, clé `terrassea-studio-v1`, `version: 1`, `migrate`, état `{ sessionId, entry, interactions[], favorites[], finalists[], selectedSeat, seatQty, tabletop, tabletopQty, base, options, projectId?, versionNo? }`, actions avec journal pour l'Undo (pile d'inverses, profondeur 50).
- `supabase/migrations/2026MMDDHHMMSS_studio_foundation.sql` (une seule migration additive, voir schéma) + son test dans `tests/security/studio-foundation-migration.test.ts`.
- `wrangler.jsonc` : ajout d'un bloc `env.staging` (nom `container-club-staging`, route `staging.prosimport.com` ou workers.dev, `vars.VITE_STUDIO_ENABLED = "true"`). Nécessite de créer le projet Supabase de staging ou d'utiliser une branche Supabase ; à décider avec Adrien (coût).
- `.env.example` : `VITE_STUDIO_ENABLED`, `STUDIO_PREVIEW_KEY`.
- `docs/RUNBOOK_STUDIO.md` : activation, prévisualisation, rollback.

### Fichiers à modifier (minimes)
- `src/vite-env.d.ts` : typer `VITE_STUDIO_ENABLED`.
- `src/routes/__root.tsx` : rien (le lien Studio dans le header n'apparaît qu'au Lot 2, conditionné au flag).
- `src/start.ts` : ajouter le hostname staging à la liste des hôtes canoniques acceptés si un domaine staging est créé.

### Migration (additive)
```sql
create type studio_role as enum ('seat','tabletop','base','catalog_only');
create type studio_seat_kind as enum ('chair','armchair','stool','lounger','other');
create type studio_material as enum ('pe_weave','cane','rope','textilene','aluminium','hpl','metal','other');
create type studio_quality as enum ('verified','estimated','pending');

create table studio_model_families (id text primary key, label text not null, notes text, created_at timestamptz default now());

create table studio_product_profiles (
  product_id text primary key references products(id) on delete cascade,
  studio_role studio_role not null default 'catalog_only',
  seat_kind studio_seat_kind,
  material studio_material,
  style_tags text[] not null default '{}',
  model_family_id text references studio_model_families(id),
  data_quality jsonb not null default '{}'::jsonb,   -- {dimensions:'estimated', weight:'estimated', price:'verified', compatibility:'pending', customization:'pending'}
  notes text,
  updated_by uuid, updated_at timestamptz default now()
);
-- RLS : select public (anon, authenticated) ; write admin via is_admin().

create view studio_products with (security_invoker = true) as
  select p.*, sp.studio_role, sp.seat_kind, sp.material, sp.style_tags, sp.model_family_id, sp.data_quality
  from products_public p left join studio_product_profiles sp on sp.product_id = p.id;
grant select on studio_products to anon, authenticated;
```
Peuplement initial (même migration, `insert … select`, idempotent) : `studio_role` dérivé de `category` (`chair`/`armchair` → seat ; `table_top` → tabletop ; `table_base` → base ; autres → catalog_only), `seat_kind` = chair/armchair sauf nom contenant « haute » → stool et « bain de soleil » → lounger, `material` par préfixe SKU (BIS → pe_weave, ROP → rope, TES → textilene, plateaux HPL → hpl, LOUVRE → metal), `data_quality` = `estimated` pour les 9 fiches marquées, `pending` pour les poids/dimensions génériques (heuristique : valeur = mode de la famille), `verified` pour les prix saisis > 0. Les anomalies de P.1 de l'audit (ROP-031, TES-031, BIS-049, ROP-016, TBA-010, TES-024, TES-043) sont forcées en `catalog_only` jusqu'à correction manuelle.

### Dépendances
Décision Adrien sur le staging (projet Supabase séparé ou branche). Clé `STUDIO_PREVIEW_KEY` à générer.

### Tests
- Unitaires : `readiness.test.ts` (matrice de cas : sans image, prix 0, retail < base, estimé), `commercial-status.test.ts` (6 chaises MOQ 50 → `feasibility_review` + `below_moq`, jamais d'erreur), `studio.store.test.ts` (persist, migrate, undo).
- Migration : test texte dans `tests/security` (types, vue, grants `anon`).
- Contrat REST : script `scripts/studio/check-anon-access.mjs` qui interroge `studio_products` avec la clé anon et échoue si 401 (leçon de l'incident du 07/09).
- Route : test que `/studio` renvoie 404 flag OFF, 200 avec cookie preview.

### Risques
- Vue `security_invoker` + grants colonne : reproduire exactement la liste de colonnes de `products_public` ; toute colonne ajoutée plus tard doit être ajoutée au grant `anon`.
- Heuristiques de peuplement imparfaites : la table de profils est **éditable** (admin) ; le peuplement n'écrit que si la ligne n'existe pas.

### Critères d'acceptation
- `bun run check` vert ; `/studio` invisible en prod ; visible en local et avec cookie preview.
- `select count(*) from studio_products` en `anon` = 123 ; aucune colonne de coût.
- 100 % des produits actifs ont un profil ; les 87 assises ont un `seat_kind` et un `material`.

### Rollback
`drop view studio_products; drop table studio_product_profiles, studio_model_families; drop type …` ; retirer le flag. Aucun impact catalogue.

---

## LOT 2 — Tranche verticale Assises

### Objectifs
Livrer le parcours Assises de bout en bout avec le moteur **V0 déterministe sans embeddings** : entrée, choix Projet complet / Assises / Tables, découverte carte par carte, J'aime / Pas pour moi / Passer, Undo, favoris, finalistes, choix d'une assise, quantité libre, rail projet desktop, barre projet mobile. Les branches Tables du choix d'entrée renvoient vers le catalogue tant que le Lot 4 n'est pas livré.

### Moteur V0 (sans pipeline visuel)
- Entrée : `studio_products` filtrés `studio_role = seat` et `discovery_ready`.
- Ordre initial : diversité par `material` puis `seat_kind` (tirage round-robin déterministe seedé par `sessionId`).
- Signaux : like = +1 sur `material`, `seat_kind`, `model_family_id`, famille de prix (déciles) ; dislike = −1 ; pass = 0 mais marque « vu ». Score = somme pondérée + bonus nouveauté (jamais vu) + malus répétition (même famille 3 fois de suite). C'est volontairement simple : le Lot 3 remplace la fonction de score sans changer l'interface.
- Finalistes : les 3 à 5 favoris les mieux scorés, présentés en duel par paires (`diagnostic pairs` V0 = paires de finalistes de matière différente).
- Le moteur est une fonction pure `nextCard(state, catalogue, rules, version)` dans `src/lib/studio/engine/v0.ts`, enregistrée dans `engine/index.ts` avec un `ALGORITHM_VERSION = 'v0.1'` inscrit dans chaque événement et chaque projet.

### Fichiers à créer
- `src/routes/studio.index.tsx` (choix d'entrée), `src/routes/studio.assises.tsx` (découverte + finalistes + choix + quantité).
- `src/components/studio/` : `StudioShell` (fond `--sand-soft`, largeur `max-w-6xl`), `DecisionCard` (image dominante `object-contain` sur `--paper`, nom, matière, 1 ligne de spécification, boutons visibles J'aime / Passer / Pas pour moi, taille 44 px, `aria-label`), `DecisionActions`, `UndoButton`, `FavoritesTray`, `FinalistDuel`, `SeatQuantityField` (quantité libre ≥ 1, affiche l'information MOQ via `getQuantityRule` sans forcer, badge de statut commercial), `ProjectRail` (desktop, dérivé de la structure `OrderSidebar`), `ProjectBottomBar` (mobile, dérivé de `CatalogueCommandBar`), `StudioProductDetails` (réutilise le contenu de `ProductDetailDialog` : galerie, specs, `DesignSelector` sans le stepper).
- `src/lib/studio/engine/{index,v0,scoring,diversity}.ts` + tests.
- `src/lib/studio/events.ts` (types d'événements, file d'attente locale, envoi par lot) et `src/routes/api/studio/events.ts` (handler POST, origin-check, `enforceApiRateLimit`, validation zod, écriture `studio_events` avec `service_role`).
- Migration `studio_sessions` + `studio_events` (voir schéma) + test migration.
- `src/components/Header.tsx` : lien « Studio » conditionné à `isStudioEnabled()`.

### Fichiers à modifier
- `src/lib/analytics.ts` : ajouter les noms d'événements Studio à `AnalyticsEvent` (miroir marketing optionnel : `studio_started`, `project_completed` uniquement).
- `src/hooks/useFavorites.ts` : aucune modification ; le Studio garde ses favoris dans le store et, si l'utilisateur est connecté, les synchronise dans `product_favorites` via les fonctions existantes (`addFavorite`/`removeFavorite`).

### Dépendances
Lot 1. Étiquetage manuel de style pour le dataset pilote (voir Livrable 5) : non bloquant pour coder, bloquant pour juger la qualité.

### Tests
- Unitaires : `engine/v0.test.ts` (déterminisme pour un même seed, diversité initiale, effet like/dislike/pass, jamais deux fois la même carte sans Undo, malus répétition), `events.test.ts` (batching, retry, taille max).
- Composants : `DecisionCard.test.tsx` (boutons présents, `aria-label`, clavier : flèches gauche/droite/bas mappées à Pas pour moi / J'aime / Passer, `z` = Undo), `SeatQuantityField.test.tsx` (6 unités acceptées, statut `feasibility_review` affiché, aucun message bloquant).
- API : `-events.test.ts` (origin, rate limit, payload invalide).
- E2E (Playwright, local) : parcours complet mobile Pixel 5 et desktop, Undo, session anonyme persistée après rechargement.

### Risques
- Qualité perçue du V0 sans signal visuel : mitigée par la diversité forcée et le dataset pilote restreint (30 à 50 assises).
- Poids des images : les vignettes actuelles ne sont pas redimensionnées ; utiliser `loading="eager"` sur la carte courante et précharger les 2 suivantes ; les Decision Images du Lot 3 corrigeront le poids.
- Double source de favoris (store + `product_favorites`) : règle simple, le store est maître, la table est un miroir pour les connectés.

### Critères d'acceptation
- Un visiteur anonyme, sur mobile, choisit une assise et une quantité de 6 sur un MOQ de 50, voit « Quantité sous le minimum de série : nous étudions la faisabilité » et peut continuer.
- Undo restaure exactement la carte précédente et ses compteurs.
- Toutes les actions sont des boutons ; parcours réalisable au clavier ; `prefers-reduced-motion` désactive les transitions de carte.
- Aucun prix affiché qui ne vienne de `studio_products` ; aucun appel réseau vers un LLM.

### Rollback
Flag OFF ; suppression des routes `studio.*` ; `drop table studio_events, studio_sessions`.

---

## LOT 3 — Pipeline visuel, Decision Images, embeddings

### Objectifs
1. Produire pour chaque assise une **Decision Image** standardisée (carré 1 200×1 200, fond blanc pur, produit centré, marge 8 %, angle trois-quarts avant privilégié, WebP q85 + variante 600 px).
2. Calculer hors ligne des **features visuelles** et des **voisins** par assise.
3. Fournir des **paires diagnostiques** (deux assises éloignées sur un axe) pour les duels.
4. Versionner l'algorithme et permettre l'A/B par session.

### Fichiers à créer
- `scripts/studio/build-decision-images.mjs` : étend `scripts/normalize-packshots.mjs` (déjà : détection fond blanc, trim, canevas carré). Ajouts : choix de la meilleure photo de galerie par heuristique (ratio, fond, position), taille de sortie fixe, upload dans `catalogue-images/studio/<product_id>/<variant_id>.webp`, écriture dans `studio_product_media`. Lecture seule sur `products` ; n'écrase jamais `main_image_url`.
- `pipeline/` (Python, séparé, non déployé) ou `scripts/studio/compute-features.mjs` : embeddings image (modèle open source local, ex. CLIP ViT-B/32 ou DINOv2), histogrammes de couleur dominante, ratio largeur/hauteur de la silhouette, densité du motif (variance locale). Sortie : `studio_product_visual_features` (jsonb `features`, `embedding` en `float[]` ou `vector` si l'extension est activée, `model_version`).
- `scripts/studio/compute-neighbors.mjs` : k plus proches voisins (k = 12) par cosinus, écriture `studio_product_neighbors` (product_id, neighbor_id, rank, score, model_version). Si `pgvector` est activé, peut être fait en SQL ; sinon en Node.
- `scripts/studio/compute-diagnostic-pairs.mjs` : paires maximisant la distance sur un axe (matière, densité de motif, silhouette) → `studio_diagnostic_pairs`.
- `src/lib/studio/engine/v1.ts` : score = affinité visuelle (moyenne des similarités aux likes − aux dislikes) + nouveauté + diversité (pénalité de proximité aux 5 dernières cartes) + exploration (ε = 0,15 seedé) ; plusieurs directions de goût = clustering des likes (k = 2 ou 3) et alternance.
- Migration `studio_visual` (tables ci-dessous, `create extension if not exists vector` **uniquement si** décision prise, sinon `float8[]`).

### Fichiers à modifier
- `src/lib/studio/engine/index.ts` : enregistrement de `v1`, sélection par `studio_algorithm_versions.is_default` ou par assignation de session.
- `src/components/studio/DecisionCard.tsx` : utilise `studio_product_media.decision_url` avec fallback `main_image_url`.

### Dépendances
Lot 1 (tables), accès Storage en écriture via `service_role` hors Worker (machine d'Adrien ou GitHub Actions avec secret), choix du modèle d'embedding, décision `pgvector`.

### Tests
- Pipeline : tests Node sur des images de fixture (fond blanc détecté, taille de sortie, idempotence : relancer ne crée pas de doublon).
- Moteur : `engine/v1.test.ts` avec un jeu de features synthétiques (2 clusters) : après 3 likes dans le cluster A, ≥ 70 % des 10 cartes suivantes viennent de A sauf cartes d'exploration ; un dislike éloigne ; diversité respectée.
- Données : script de contrôle (`check-visual-coverage.mjs`) qui liste les assises sans Decision Image ou sans voisins.

### Risques
- Qualité des packshots hétérogène (fonds gris, ombres) : prévoir une passe manuelle sur les rejets du script.
- Coût de calcul : négligeable (≈ 150 images).
- Dépendance Python : à isoler dans `pipeline/` avec son propre `requirements.txt`, jamais dans le build Cloudflare.

### Critères d'acceptation
- ≥ 90 % des assises `discovery_ready` ont une Decision Image et 12 voisins.
- Le moteur V1 remplace V0 sans changement d'interface ni de store.
- Le runtime ne fait aucun calcul vectoriel : `select … from studio_product_neighbors`.

### Rollback
`is_default` remis sur V0 ; les tables visuelles peuvent rester.

---

## LOT 4 — Plateaux et piètements

### Objectifs
Après le choix d'assise et la quantité : choix rapide d'un plateau (forme → dimension → décor), quantité de tables suggérée = `ceil(assises / 2)` (toujours modifiable), puis piètement compatible (déterministe), avec statut commercial par ligne.

### Fichiers à créer
- `src/lib/studio/compatibility.ts` : `evaluateBaseForTop(base, top, rules)` → `allowed | forbidden | requires_confirmation` + raison. Ordre : exception par couple (`studio_tabletop_base_rules` avec `base_id` et `tabletop_id`) > règle par type de piètement et forme/dimension max > repli sur `compatible_top_shapes` existant (`isCompatibleTop`) > `requires_confirmation` si aucune règle. Jamais de décision par le moteur de recommandation.
- `src/lib/studio/table-suggestion.ts` : `suggestTableCount(seatQty)`, `suggestTabletopShape(seatKind, seatQty)` (informatif).
- `src/routes/studio.tables.tsx`, `src/components/studio/TabletopPicker.tsx` (chips forme, dimensions triées, décors avec photo de variante, minimum coloris affiché), `BasePicker.tsx` (liste filtrée par verdict, `requires_confirmation` affiché avec mention « à confirmer par notre équipe »), `TableQuantityField.tsx`.
- Migration `studio_tabletop_base_rules` + peuplement des règles générales connues (à valider par Adrien) : central 70×70 → carré ≤ 80, rond ≤ Ø80 ; double colonne 110×62 → rectangle 120×80 à 160×90 ; MARAIS → carré ≤ 70, rond ≤ Ø70 ; tout le reste `requires_confirmation`.
- Admin : `src/components/AdminStudioRulesTab.tsx` (CRUD des règles, admin only), onglet dans `admin.tsx` (lazy, comme les autres).

### Fichiers à modifier
- `src/lib/table-composer.ts` : aucun changement de comportement ; export de `isCompatibleTop` déjà présent, réutilisé comme repli.
- `src/lib/studio/commercial-status.ts` : ajout des raisons `compatibility_unconfirmed`, `custom_tabletop_requested`.

### Dépendances
Lot 2 (quantité d'assises), saisie par Adrien des dimensions d'embase et plateau max par piètement (voir Data gap). Sur mesure : réutilisation de `CustomTableTopDialog` telle quelle, la demande étant journalisée comme ligne `custom_tabletop` du projet avec statut `manual_quote_required`.

### Tests
- `compatibility.test.ts` : exception > règle > repli ; verdicts ; absence de règle → `requires_confirmation` (jamais `allowed` par défaut).
- `table-suggestion.test.ts` : 6 → 3, 7 → 4, 50 → 25.
- E2E : parcours complet assise → plateau → piètement, y compris cas `requires_confirmation`.

### Risques
- Règles incomplètes au lancement : par construction, l'absence de règle donne `requires_confirmation`, pas un blocage ni une compatibilité inventée.

### Critères d'acceptation
- Aucun couple plateau/piètement `allowed` sans règle en base.
- Quantité de tables modifiable, jamais imposée.

### Rollback
`drop table studio_tabletop_base_rules` ; le Studio Tables se replie sur `compatible_top_shapes`.

---

## LOT 5 — Personnalisation

### Objectifs
Représenter les choix de coloris/finitions de façon normalisée sans casser `product_variants`, permettre « autre couleur sur demande » comme ligne de projet à statut `manual_quote_required`.

### Fichiers à créer
- Migration `studio_customization` : `studio_option_groups` (code : `FRAME_COLORS`, `TEXTILENE_COLORS`, `CORD_COLORS`, `PE_WEAVE_COLORS`, `HPL_DECORS`, `BASE_COLORS`, `EDGE_FINISHES` ; label), `studio_options` (group_code, code, label, swatch_hex ou swatch_url, `reference_ral`, `reference_pantone`, `is_on_request`), `studio_variant_options` (variant_id → option_id, plusieurs par variante), `studio_product_zones` (product_id, zone_code, group_code, `is_required`).
- `src/lib/studio/customization.ts` : `resolveVariantForOptions(product, chosenOptions)` → variante existante (prix et minimum réels) ou `null` (sur demande).
- `src/components/studio/CustomizationPanel.tsx` : zones affichées comme swatches ; sélection d'options existantes = sélection de variante ; option `is_on_request` = ouvre `CustomColorwayDialog` et ajoute une ligne « personnalisation à confirmer ».
- Admin : `AdminStudioOptionsTab.tsx` (rattachement variante ↔ options).
- Script `scripts/studio/seed-options-from-variants.mjs` : propose des rattachements à partir des noms de variantes (« tressage vert émeraude / écru » → PE_WEAVE_COLORS.vert_emeraude + ecru), écrit un CSV de proposition, **n'insère rien** sans validation.

### Fichiers à modifier
- `src/lib/studio/commercial-status.ts` : raison `custom_colour_requested`.

### Dépendances
Lot 4 (zones plateau/piètement), validation manuelle des rattachements.

### Tests
- `customization.test.ts` : options → variante exacte ; combinaison inconnue → `null` ; minimum coloris propagé.

### Risques
- Explosion combinatoire si l'on modélise des zones pour des produits qui n'ont qu'une photo : ne modéliser que les variantes existantes + « sur demande ».

### Critères d'acceptation
- Choisir « Marbre noir » sur AVIGNON sélectionne la variante `sku-803-v-8vacee` avec son minimum de 15.
- Un choix « autre couleur » ne modifie ni prix ni minimum : il crée une ligne à statut `manual_quote_required`.

### Rollback
Suppression des tables `studio_option*`, `studio_product_zones`.

---

## LOT 6 — Sauvegarde, reprise, versions, partage

### Objectifs
Avant sauvegarde : session anonyme locale (store) + miroir serveur léger optionnel. Après : prénom, nom, email → projet persisté, lien sécurisé, reprise, versions, partage lecture seule. Pas de mot de passe.

### Fichiers à créer
- Migration `studio_projects` : `studio_projects` (id uuid, session_id, first_name, last_name, email, company_name?, phone?, `access_token_hash`, `status` enum `draft | saved | quoted | reserved | archived`, `current_version_no`, `user_id` nullable, `algorithm_version`, attribution utm/partner_ref comme `reservations`, timestamps), `studio_project_versions` (project_id, version_no, `reason` enum `initial | seat_replaced | tabletop_replaced | base_replaced | variant_saved | quantity_changed | quote_generated | manual`, `payload jsonb` = items normalisés `{product_id, variant_id, quantity, role, options[], commercial_status, reasons[]}` + `catalog_snapshot jsonb` (prix, MOQ, dimensions, noms, images au moment de la version, comme `reservation_items.product_snapshot`), `created_at`), `studio_project_shares` (project_id, `token_hash`, `mode` `read_only`, `expires_at`).
- RPC `security definer` : `studio_save_project(payload)` (crée projet + version 1, retourne le token brut une seule fois), `studio_add_project_version(project_id, token, payload, reason)`, `studio_get_project(token)` (retourne le projet si hash(token) correspond), `claim_my_studio_projects()` (email vérifié du JWT, pattern `claim_my_reservations`). Exécution accordée à `anon, authenticated` ; validations zod côté server function avant appel.
- `src/lib/studio/project-repository.ts` (server functions `createServerFn` qui appellent les RPC ; jamais de `service_role` pour ces écritures), `src/lib/studio/snapshot.ts` (`buildCatalogSnapshot(items, catalogue)` : copie des faits commerciaux depuis `studio_products`), `src/lib/studio/versions.ts` (`shouldCreateVersion(prev, next)` : assise/plateau/piètement remplacés, variante enregistrée, devis généré).
- Routes : `studio.projet.tsx` (résumé, formulaire de sauvegarde), `studio.p.$token.tsx` (reprise : recharge le store depuis la dernière version ; lecture seule si token de partage), email de confirmation via `src/lib/email/templates.ts` (nouveau gabarit « Votre projet Terrassea »).
- Compte : `src/routes/account.projets.tsx` (liste des projets rattachés).

### Fichiers à modifier
- `src/lib/email/notify-leads.ts` : `notifyStudioProjectSaved` (admin + client), non fatal.
- `src/hooks/useAuth.ts` : aucun changement ; le rattachement se fait après connexion par appel de `claim_my_studio_projects` dans `account.projets.tsx`.

### Dépendances
Lots 1, 2 (4 et 5 pour des projets complets). Brevo configuré.

### Tests
- `snapshot.test.ts` : le snapshot ne dépend que du catalogue au moment T ; un changement de prix ultérieur ne modifie pas la version.
- `versions.test.ts` : matrice remplacement → nouvelle version ; explorer une alternative sans écraser = version brouillon non promue.
- Migration : tests texte (RLS : un projet n'est lisible que par token, par `user_id` ou admin ; jamais de `select` public).
- E2E : sauvegarde anonyme, réouverture du lien sur un autre navigateur, partage lecture seule.

### Risques
- Token en clair dans l'URL : stocker le hash (sha-256) et prévoir expiration/rotation ; ne jamais logger l'URL complète.
- Doublons d'emails : un email peut avoir plusieurs projets ; c'est voulu.

### Critères d'acceptation
- Reprise fidèle (mêmes items, quantités, options, version) ; versions listées ; partage lecture seule sans accès aux actions.
- Aucun projet lisible sans token, session propriétaire ou compte rattaché.

### Rollback
Suppression des tables et RPC `studio_project*` ; les projets locaux (store) restent utilisables.

---

## LOT 7 — Devis

### Objectifs
Générer un devis = snapshot d'une version précise du projet, avec statut commercial explicite, validité stockée, PDF réutilisant `buildQuoteHTML`.

### Fichiers à créer
- Migration `studio_quotes` : (id, project_id, version_no, `reference` `SP-<yyyymm>-<seq>`, `snapshot jsonb` (lignes, prix unitaires, remises, éco-participation, TVA, totaux, frais de réservation), `pricing_parameters_snapshot jsonb` (issu de `get_public_pricing_rules` au moment T), `commercial_status`, `reasons[]`, `valid_until`, `issued_at`, `pdf_path` nullable dans le bucket privé `reservation-quotes` (à créer par migration, il manque aujourd'hui), `created_by` nullable).
- `src/lib/studio/quote.ts` : `buildStudioQuote(version, rules)` → objet `QuoteData` compatible avec `buildQuoteHTML` (réutilisé, pas dupliqué) + statut. Si `manual_quote_required` : le document porte la mention « devis indicatif, sous réserve d'étude » et la demande est notifiée à l'admin (email existant `notifyContactMessage` ou nouveau gabarit).
- Server function `issueStudioQuote(projectToken, versionNo)` : recalcule les totaux **côté serveur** à partir de `studio_products` (jamais des valeurs client), persiste, renvoie la référence.
- `src/routes/studio.devis.$quoteId.tsx` : rendu imprimable.
- Admin : liste des devis Studio dans `AdminLeadsTab` (colonne statut commercial, raisons).

### Fichiers à modifier
- `src/lib/quote.ts` : aucune modification fonctionnelle ; si nécessaire, extraire les textes fixes (validité 14 jours, garantie, TVA) dans `src/lib/commercial-policy.ts` **en lecture** pour que Studio et catalogue lisent la même source (première brique de `commercial_policy`, sans toucher aux textes marketing).

### Dépendances
Lot 6. Décision sur la validité (14 j ou 30 j : unifier).

### Tests
- `quote.test.ts` : totaux = recalcul serveur ; un changement de `base_price_ht` après émission ne change pas le devis ; sous MOQ → mention indicative.
- Snapshot HTML (Vitest) du document pour éviter les régressions de mise en page.

### Risques
- Recalcul serveur des remises : réutiliser `getCustomerDiscountStatus` et `calculateReservationFee` avec les règles fraîches ; tolérance 0,05 € comme le RPC.

### Critères d'acceptation
- Deux devis émis sur deux versions différentes conservent chacun leurs chiffres.
- Un devis `manual_quote_required` déclenche une notification admin et n'ouvre pas la réservation.

### Rollback
`drop table studio_quotes` ; le bouton devis retombe sur `openQuotePDF` du panier.

---

## LOT 8 — Réservation

### Objectifs
Convertir un projet `standard` (toutes quantités conformes aux règles existantes, produits `public`, container ouvert) en réservation via le RPC existant, sans dupliquer `ReservationDialog`.

### Fichiers à créer
- `src/lib/studio/to-cart.ts` : `projectToCartLines(version)` → `setLineQty(productId, variantId, qty, {silent:true})` pour chaque ligne ; vérifie avec `sanitizeOrderQuantity` que rien n'est modifié (sinon statut ≠ standard, on n'entre pas ici).
- `src/routes/studio.reserver.tsx` : ouvre `LazyReservationDialog` existant sur le panier ainsi rempli ; à la confirmation, `studio_projects.status = reserved` + `reservation_id` (colonne ajoutée par migration additive sur `studio_projects`, pas sur `reservations`).

### Fichiers à modifier
- `src/components/ReservationDialog.tsx` : aucune modification de logique ; prop optionnelle `onCreated(reservation)` si elle n'existe pas déjà (vérifier `createdReservation`).
- Webhook Stripe : aucune modification ; le lien projet ↔ réservation est posé côté Studio après création.

### Dépendances
Lot 7, container ouvert en admin, Stripe configuré.

### Tests
- `to-cart.test.ts` : projet 50 chaises + 25 plateaux + 25 piètements → lignes identiques ; projet sous MOQ → refus explicite avec redirection devis.
- E2E : parcours Studio → réservation → Stripe test → statut `reserved` et projet marqué.

### Risques
- Divergence entre snapshot devis et prix live à la réservation : le RPC recalcule ; afficher l'écart si > 0,05 € avant confirmation (pas de blocage).

### Critères d'acceptation
- Aucune réservation Studio ne contourne `create_reservation_with_items`.
- Un projet sous MOQ ne peut pas atteindre Stripe ; il a un devis indicatif et une demande en admin.

### Rollback
Retirer la route ; le projet reste au statut `quoted`.

---

## LIVRABLE 3 — Schéma de données proposé

| Concept | Réutilisation existante | Extension proposée | Nouveau stockage |
|---|---|---|---|
| Produits | `products`, `products_public` | vue `studio_products` (jointure profil) | `studio_product_profiles` (role, kind, material, tags, family, data_quality) |
| Familles de design | — | — | `studio_model_families` (id, label) ; FK depuis les profils |
| Variantes | `product_variants` (id, name, image, min_order_units) | — | `studio_variant_options` (variante → options normalisées) |
| Médias | `catalogue-images` (Storage), `main_image_url`, `gallery_urls` | préfixe `studio/` dans le même bucket | `studio_product_media` (product_id, variant_id?, kind `decision|thumb`, url, width, height, source_url, pipeline_version) |
| Zones de personnalisation | — | — | `studio_product_zones` (product_id, zone_code, group_code, is_required) |
| Options | — | — | `studio_option_groups`, `studio_options` (code, label, swatch, RAL/Pantone, is_on_request) |
| Visual features | — | `vector` optionnel (Lot 3) | `studio_product_visual_features` (product_id, model_version, features jsonb, embedding float8[]/vector) |
| Neighbors | — | — | `studio_product_neighbors` (product_id, neighbor_id, rank, score, model_version) |
| Diagnostic pairs | — | — | `studio_diagnostic_pairs` (a_id, b_id, axis, distance, model_version) |
| Compatibilité plateau/pied | `products.compatible_top_shapes` (repli) | — | `studio_tabletop_base_rules` (rule_type general/exception, base_id?, base_type?, tabletop_id?, shape?, max_length, max_width, max_diameter, verdict, note, verified_by) |
| Sessions Studio | localStorage (pattern `cc_attribution`) | — | `studio_sessions` (id uuid, first_seen, last_seen, algorithm_version, ua_hash, attribution) |
| Interactions | `AnalyticsEvent` (miroir) | — | `studio_events` (id, session_id, project_id?, type, product_id?, variant_id?, payload jsonb, algorithm_version, created_at) ; index (session_id, created_at) |
| Projets | pattern `partner_selections` + `reservations.contact_snapshot` | — | `studio_projects` (contact, token hash, status, user_id?, attribution, reservation_id?) |
| Project items | `reservation_items` (structure de ligne) | — | inclus dans `studio_project_versions.payload` (jsonb) ; pas de table de lignes tant qu'aucune requête transversale n'est nécessaire |
| Project versions | `invoices.snapshot` (principe) | — | `studio_project_versions` (version_no, reason, payload, catalog_snapshot) |
| Contacts | `users_profile`, `companies` (rattachement ultérieur) | — | colonnes sur `studio_projects` ; rattachement `user_id` par `claim_my_studio_projects` |
| Devis | `buildQuoteHTML`, bucket `reservation-quotes` | migration créant le bucket manquant | `studio_quotes` (snapshot, pricing_parameters_snapshot, valid_until, status, pdf_path) |
| Expériences / versions d'algorithme | — | — | `studio_algorithm_versions` (id, label, is_default, weights jsonb, created_at) ; assignation par session dans `studio_sessions.algorithm_version` |

RLS de principe : lecture publique pour les tables descriptives (profils, options, règles, médias, voisins, paires) ; écriture admin via `is_admin()` ; `studio_events` écriture serveur uniquement ; `studio_projects*` et `studio_quotes` lisibles uniquement par token (RPC), `user_id` ou admin. Chaque migration `studio_*` est accompagnée d'un test texte dans `tests/security` et d'une vérification REST en `anon`.

---

## LIVRABLE 4 — Data gap report

### Déjà disponible (utilisable tel quel)
- SKU : 100 % (unique), id stable, slug calculé.
- Catégorie : 100 % ; rôle Studio dérivable à 95 %.
- Image principale : 98 % des assises actives (62/63 chaises, 24/24 fauteuils) ; 1 actif sans image (SKU-321).
- Galerie : 92 % des assises actives ont ≥ 2 photos ; moyenne 5,5 à 7,2.
- Prix pro HT : 100 % des actifs > 0 ; prix public : 99 % (SKU-336 à 0).
- MOQ produit : 100 % ; minimum coloris : 6 variantes (plateaux).
- Forme des plateaux : 100 % (5/5) ; dimensions plateaux : 100 %.
- Règles de prix (paliers, frais) : 100 % via RPC public.
- Variantes avec photo : 93 % (286/309).

### À vérifier
- Dimensions assises : présentes sur 93 % mais **génériques par famille** (voir audit D) : à confirmer produit par produit ou à marquer `estimated`.
- Poids : présents sur 92 %, valeurs de gabarit ; idem.
- Volume : `cbm_per_unit` 0,05 par défaut sur 13 produits.
- Catégorie de 7 produits (ROP-031, ROP-016, TES-031, BIS-049, TBA-010, TES-024, TES-043).
- Prix public < prix pro (BIS-030, ROP-001, TES-027).
- Décors HPL : 3 orthographes pour le même décor.
- 52 variantes « Design présenté » : nom réel à saisir (ou accepter comme « coloris photographié »).
- Dimensions des piètements centraux (70×70×72 = plateau de démo, pas l'embase).

### À ajouter manuellement
- `studio_role` pour les exceptions ; `seat_kind` tabouret / bain de soleil ; `material` sur les 10 fiches SKU-*/CHA-*.
- Étiquettes de style (sobre, graphique, contrasté, neutre, fine, enveloppante) pour le dataset pilote : ~45 assises à étiqueter, 10 minutes par lot de 10 avec les planches photo.
- `model_family_id` : validation visuelle des groupes suspectés (ROP 52×60×82 à 99 €, BIS 48×56×86 à 89 €, TES 54×58×84 à 89 €).
- Compatibilité plateau/piètement : dimension max, type d'embase, verdict par couple pour les 8 piètements × 5 plateaux (40 couples) : 1 heure de saisie.
- Dimensions d'embase / hauteur de colonne des piètements ; poids réels des plateaux.
- Rattachement variantes → options normalisées (Lot 5).
- Un container ouvert (admin) pour que `reservation_ready` puisse être vrai.

### Automatisable plus tard
- Decision Images (script existant à étendre).
- Embeddings visuels, voisins, paires diagnostiques.
- Proposition de familles de design par similarité (validation humaine).
- Proposition de rattachement options ↔ variantes par analyse des noms.
- Normalisation des noms de décors.

### Bloquant pour le Lot 2
- Vue `studio_products` + profils (Lot 1).
- Correction des 7 catégories erronées (ou exclusion `catalog_only`).
- Dataset pilote étiqueté (au minimum matière + sous-type, style facultatif au départ).
- Décision flag/preview.

### Non bloquant pour le Lot 2
- Poids et dimensions vérifiés (affichés avec badge « estimé » via `data_quality`).
- Familles de design, embeddings, Decision Images (Lot 3).
- Règles de compatibilité (Lot 4), options (Lot 5).
- Container ouvert, staging.

---

## LIVRABLE 5 — Premier dataset pilote (30 à 50 assises)

### Méthode
1. Partir des 87 assises actives `discovery_ready` (image principale + dimensions non nulles + prix > 0 + prix public ≥ prix pro) : 74 candidates après exclusions.
2. Exclure : chaises hautes (TES-024, TES-043), fiches sans dimensions (SKU-321, 324, 336, 368, 369, 521, BIS-061), incohérence prix (BIS-030), fiches à 2 photos ou moins hors nouvelles (BIS-047, BIS-051, ROP-034, ROP-038, ROP-043, TES-037, TES-044, CHA-CAN-001 sans galerie).
3. Équilibrer par matière (préfixe SKU) et par sous-type, puis choisir, dans chaque groupe, les designs visuellement distincts (une seule référence par groupe de « même design en plusieurs coloris » suspecté).
4. Étiqueter manuellement les axes de style à partir des planches photo (non dérivable des données).

### Candidats (44), matière connue par les données, style à étiqueter

Tressage PE / cannage (BIS, esprit bistrot ; motifs graphiques fréquents) — 18 :
- Chaises : BIS-001 RIVOLI (chevron, 11 variantes), BIS-002 MONCEAU, BIS-003 OPERA (rayé), BIS-004 BASTILLE (chevron pastel), BIS-005 TUILERIES (damier, 4 variantes), BIS-023 ANTIBES, BIS-024 MENTON, BIS-025 CASSIS, BIS-027 DEAUVILLE (damier), BIS-039 RAVENNA, BIS-045 IBIZA (rayé), BIS-057 SANTORIN (11 photos), SK-456 TROUVILLE (dossier ovale), SKU-659 CABOURG (3 coloris), SKU-698 SAINT-MALO (4 coloris), SKU-785 QUIBERON (dossier arceau).
- Fauteuils : BIS-010 SAINT-GERMAIN (losange, 5 variantes), BIS-020 VILLETTE (10 variantes), BIS-070 ARCACHON (rotin naturel).

Cordage (ROP ; formes enveloppantes, plus sobres) — 12 :
- Chaises : ROP-008 HONFLEUR (3 variantes), ROP-009 ETRETAT, ROP-010 DINARD, ROP-024 PALMA (3 variantes), ROP-035 CORFOU, ROP-037 SANTORIN, ROP-039 RHODES, ROP-040 PATMOS, ROP-041 ATLAS (65×95, forme atypique), ROP-042 MEDINA.
- Fauteuils : ROP-002 NICE, ROP-003 ANTIBES (cordage ajouré, haut de gamme), ROP-007 DEAUVILLE.

Textilène (TES ; maille ou tressage, sobre à graphique) — 14 :
- Chaises : TES-002 VALENCIA (10 variantes, motif géométrique), TES-012 PAROS (12 variantes), TES-013 NAXOS, TES-019 RHODES, TES-022 MEDINA (chevron), TES-026 AZUR (maille bleu/blanc), TES-029 CAMARGUE, TES-033 GARONNE, TES-038 OPALE (4 variantes), TES-042 MONCEAU.
- Fauteuils : TES-001 SEVILLE, TES-010 RONDA, TES-011 ATHENES, TES-023 OASIS (motif géométrique), TES-028 LUBERON (maille gris).

### Couverture des axes demandés
| Axe | Couverture par les données | Reste à faire |
|---|---|---|
| cordage / textilène / tressage PE | oui (préfixe SKU + mots-clés) | vérifier les 4 fiches SKU-*/SK-* |
| aluminium | **absent** comme matière d'assise (toutes structures alu) | aucun candidat ; ne pas inventer l'axe |
| chaise / fauteuil | oui (`category`) | BIS-049 à reclasser |
| sobre / graphique / contrasté / neutre | non dérivable | étiquetage manuel (44 fiches) |
| formes fines / enveloppantes | non dérivable (dimensions génériques) | étiquetage manuel |

### Limites
- Les dimensions et poids des candidats sont majoritairement des valeurs de gabarit ; le dataset pilote ne doit pas servir à valider des filtres dimensionnels.
- Les groupes « même design, coloris différents » sont une hypothèse fondée sur structure, dimensions et prix identiques ; ils doivent être confirmés visuellement avant d'attribuer un `model_family_id`.
- Les 12 fiches importées le 06/09 ont des galeries courtes (2 à 3 photos) : suffisantes pour une Decision Image, insuffisantes pour un multi-angle.
- Aucune assise n'a d'information structurée sur l'empilabilité, les accoudoirs ou la hauteur d'assise ; ces filtres ne peuvent pas être proposés en V1.

---

## Tests transverses à prévoir (récapitulatif)

Unit (`src/lib/studio/**`) : scoring V0/V1, likes/dislikes/pass, undo, readiness, statut commercial (MOQ non bloquant), compatibilité, snapshot prix, versions, conversion panier.

Integration (Vitest + client Supabase mocké, comme `src/lib/catalogue/db.test.ts`) : création de projet, sélection assise, plateau, pied, sauvegarde, reprise, variante, devis ; tests texte de chaque migration `studio_*` ; contrôle REST `anon` sur `studio_products`.

E2E (Playwright, à ajouter en CI en mode `chromium` + `mobile-chrome`) : parcours mobile et desktop, clavier seul, undo, session anonyme persistée, partage lecture seule, `prefers-reduced-motion` (émulation `reducedMotion: 'reduce'`).

Accessibilité : intégrer `@axe-core/playwright` sur les routes Studio (dépendance légère de test uniquement).
