# Runbook — Studio Projet (lot 1 : fondation · lot 2 : tranche Assises)

État validé en production le 08/09/2026 : **Lot 1 : PRODUCTION VERIFIED · Lot 2 : PRODUCTION VERIFIED**. Les migrations **39 et 40 sont APPLIQUÉES EN PRODUCTION**. Le Lot 2 couvre l'expérience Assises complète (`/studio` → `/studio/assises`). Ce runbook couvre l'activation, la preview sécurisée, les migrations, les contrôles, le moteur V0 et le rollback.

- `main` inclut le hotfix preview `4017238` : cookie `Path=/`, déployé et validé en production.
- Preview privée production et navigation `/studio` → `/studio/assises` : **fonctionnelles**.
- `VITE_STUDIO_ENABLED` reste **OFF en production** : le Studio reste accessible uniquement par la preview privée.
- Contrôles de sécurité production : **`security:studio` OK · `security:grants` OK**.
- Version Cloudflare validée : `9418ec86-8ba1-4102-8f82-109541dcafe5`.

## Lot 4 — état local au 09/09/2026

Le parcours Tables est implémenté sur `codex/studio-lot-4-bring` : entrée `/studio`, transition volontaire Assises → `/studio/tables`, configuration plateau/piètement et résumé partagé. [Revue et procédures Lot 4](STUDIO_LOT_4_REVIEW.md). Le contrôle de preview existant couvre aussi cette route ; cookie `Path=/` inchangé.

La migration **42 `20260909100000_studio_table_compatibility.sql` est NON APPLIQUÉE EN PRODUCTION**. Elle ajoute types de piètement, rattachements et règles vérifiés, RLS admin et deux projections publiques minimales. Aucun couple réel n’est prérempli. Sans les projections disponibles, le Studio conserve le besoin mais ne confirme aucune compatibilité. La validation humaine avec provenance se fait dans l’onglet Studio admin existant.

**CODE READY et UX REVIEW READY** après contrôles locaux ; **DATA / COMPATIBILITY READY : NON ; PRODUCTION READY : NON**. Aucun déploiement ni changement du flag public. Les états production des Lots 1/2 et des migrations 39/40 ci-dessus restent inchangés.

## 1. Activer le Studio en local

```
# .env.local (jamais commité)
VITE_STUDIO_ENABLED=true
```

`bun run dev` puis `http://localhost:5173/studio` → entrée du Studio (Projet complet / Assises / Tables), puis `/studio/assises` ou `/studio/tables`. Sans cette variable ni cookie preview valide, `/studio`, `/studio/assises` et `/studio/tables` renvoient la 404 du site. Le lien « Studio » du Header n'apparaît que sous ce flag ; une session preview accède par l'URL.

Sans Supabase configuré, le Studio affiche « Aucune assise n'est disponible » (jamais un mock). Pour développer avec des données réelles : `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de `.env.local` (lecture seule des surfaces publiques ; les événements nécessitent `SUPABASE_SERVICE_ROLE_KEY` dans `.dev.vars` et la migration 40, sinon l'API répond 503 et le parcours continue).

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
3. Ouvrir `https://prosimport.com/studio/preview?key=<secret>` : le serveur compare la clé en temps constant, pose le cookie `studio_preview` (HMAC-SHA256 signé avec le secret, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 7 jours) et redirige vers `/studio`.
4. Toute autre réponse est un 404 : secret non configuré, clé fausse, méthode POST, plus de 10 tentatives par 10 minutes et par IP.

Ce que la preview ne fait pas : elle n'accorde aucun accès admin, aucune session Supabase, aucune donnée supplémentaire. Elle ne fait qu'exister les routes `/studio`.

### Révoquer

- Tous les cookies de preview : changer `STUDIO_PREVIEW_KEY` (ou le supprimer). Les jetons signés avec l'ancien secret deviennent invalides immédiatement.
- Son propre navigateur : `https://prosimport.com/studio/preview?clear=1`. Supprime le cookie `Path=/` et l’ancien cookie `Path=/studio`.

Le scope `/` est nécessaire aux vérifications TanStack `/_serverFn/` lors de la navigation `/studio` → `/studio/assises`. Il n’accorde aucun accès supplémentaire : signature HMAC, HttpOnly, Secure en production, SameSite=Lax et TTL de 7 jours restent inchangés. Le hotfix `4017238` est déployé et validé en production. Pour un navigateur conservant un ancien cookie, rouvrir le lien d’accès preview pour renouveler le cookie ; cette ouverture efface aussi l’ancien scope `/studio`.

Régression locale avec flag OFF et clé factice en mémoire, sans modifier de secret : `bunx playwright test --config tests/e2e/studio-preview.config.ts`.

## 3. Migrations du lot 1

| #   | Fichier                                                    | Statut                                                  |
| --- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 39  | `supabase/migrations/20260907120000_studio_foundation.sql` | **APPLIQUÉE en production — Lot 1 production verified** |

Contenu : tables internes `studio_model_families`, `studio_product_profiles`, `studio_fulfillment_options` ; surfaces publiques `studio_product_profiles_public`, `studio_fulfillment_options_public`, `studio_model_families_public` et `studio_products` ; fonction `studio_public_data_quality()` ; peuplement idempotent des profils (rôle par catégorie, sous-type et matière estimés, prix public reconnu, `model_family_id` jamais renseigné) et d'une option `standard_production` **non confirmée** (`seed_moq`) par produit public actif au MOQ de la fiche. Auto-vérification en fin de migration (colonnes internes absentes des surfaces publiques, aucun droit anon sur les tables, projection de qualité étanche, aucune option semée confirmée).

Ordre : code puis migration (le code lit les vues avec des colonnes explicites ; l'ancien bundle ne les référence pas). Application : `supabase db push` ou éditeur SQL, comme les migrations 30 à 38 (`RUNBOOK_FUSION_DEPLOY.md`).

### Surface publique minimale (principe du lot 0.5)

| Surface                                   | Lisible par                                                                   | Colonnes                                                                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio_products` (vue, security_invoker) | anon, authenticated                                                           | les 25 colonnes publiques de `products_public` + `studio_role`, `seat_kind`, `material`, `model_family_id`, `visual_traits`, `data_quality` (projetée)                           |
| `studio_product_profiles_public` (vue)    | anon, authenticated                                                           | `product_id`, `studio_role`, `seat_kind`, `material`, `model_family_id`, `visual_traits`, `data_quality` (projetée) — produits actifs                                            |
| `studio_fulfillment_options_public` (vue) | anon, authenticated                                                           | `id`, `product_id`, `variant_id`, `mode`, `min_quantity`, `max_quantity`, `price_basis`, `source`, `is_active`, `is_confirmed`, `available_from`, `expires_at` — options actives |
| `studio_model_families_public` (vue)      | anon, authenticated                                                           | `id`, `label`, `status` — familles vérifiées                                                                                                                                     |
| tables `studio_*`                         | admin uniquement (RLS `is_admin()` ; anon : aucun grant ; buyer : zéro ligne) | tout, dont `notes`, `note`, `created_by`, `updated_by`, `confirmed_by`, `data_quality` complète                                                                                  |

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

## 3 bis. Migration du lot 2 — APPLIQUÉE EN PRODUCTION

| #   | Fichier                                                         | Statut                                                  |
| --- | --------------------------------------------------------------- | ------------------------------------------------------- |
| 40  | `supabase/migrations/20260907130000_studio_sessions_events.sql` | **APPLIQUÉE EN PRODUCTION — Lot 2 PRODUCTION VERIFIED** |

Contenu, additif uniquement :

| Table / vue               | Rôle                                                                                                                                        | Accès                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio_sessions`         | session anonyme de découverte (`id`, `algorithm_version`, `entry`, dates) — aucune PII                                                      | écriture serveur seule (client admin) ; lecture admin (RLS `is_admin()`) ; anon : aucun droit                                                       |
| `studio_events`           | une ligne par interaction (`event_type` contraint, `product_id`, `variant_id`, `algorithm_version`, `payload` ≤ 2 Ko, `client_ts`)          | idem                                                                                                                                                |
| `studio_curation_sets`    | infrastructure du jeu pilote : `product_ids` explicites, `criteria` traçables, `status` draft/active/archived. **Vide** : aucun jeu inventé | admin (RLS) ; surface publique `studio_curation_sets_public` (`id`, `label`, `product_ids`, jeux actifs)                                            |
| `studio_diagnostic_pairs` | paires diagnostiques explicites (`axis` mesuré, `source` manual/pipeline, `status`). **Vide** : jamais générée                              | admin (RLS) ; surface publique `studio_diagnostic_pairs_public` (`id`, `product_a_id`, `product_b_id`, `axis`, paires vérifiées de produits actifs) |

Comportement de repli pour un environnement local incomplet : `/api/studio/events` répond 503 (le parcours continue, la mesure est simplement absente), les deux surfaces publiques répondent 404 et le repository dégrade en listes vides (`?set=pilot` → découverte complète, aucun duel).

### Rollback du lot 2

```sql
drop view if exists public.studio_diagnostic_pairs_public;
drop view if exists public.studio_curation_sets_public;
drop table if exists public.studio_events;
drop table if exists public.studio_sessions;
drop table if exists public.studio_diagnostic_pairs;
drop table if exists public.studio_curation_sets;
```

Côté code : flag OFF (les routes restent en 404 / noindex), ou retour au commit du lot 1. Aucune donnée existante n'est touchée.

### Ajouter une paire diagnostique (sans l'inventer)

Une paire n'existe que si elle est **mesurée** : deux assises éloignées sur un axe calculé (`visual_traits` du lot 3 : `silhouette_ratio`, `edge_density`, `global_contrast`, `openness`, ou distance d'embedding). Procédure : insérer en admin (SQL ou futur onglet) `product_a_id`, `product_b_id`, `axis`, `source = 'manual'` (ou `pipeline` avec version dans `notes`), `status = 'candidate'` ; passer en `verified` après contrôle visuel. Seules les paires `verified` entre produits actifs sont publiques. Aucun duel n'est affiché tant que `findDiagnosticDuel` n'est pas activé dans l'interface (désactivé au lot 2) **et** qu'une paire vérifiée ne relie pas deux finalistes en présence. Jamais de paire « pour remplir ».

### `?set=pilot`

**Preview uniquement** : avec une source d’accès `preview`, `/studio/assises?set=<id>` (`id` = `[a-z0-9][a-z0-9_-]{0,39}`) restreint la découverte aux `product_ids` du jeu **actif** de ce nom, s'il existe et s'il contient au moins une assise discovery_ready. Sinon : message « Le jeu « … » n'est pas disponible : découverte sur toutes les assises » et découverte complète. En accès public par flag (`source = flag`), le paramètre `set` est ignoré : découverte complète, sans filtre ni message de jeu curé. Un identifiant invalide est également ignoré. Le pipeline Lot 3 prépare un pilote en dry-run/draft ; aucune activation automatique. Voir le runbook Lot 3.

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
- Depuis le lot 2, `security:studio` contrôle aussi les surfaces `studio_curation_sets_public` / `studio_diagnostic_pairs_public` et le refus (lecture **et** insertion) des tables `studio_sessions`, `studio_events`, `studio_curation_sets`, `studio_diagnostic_pairs` ; une surface absente dans un environnement incomplet est ignorée avec un `SKIP` explicite. En production, la migration 40 est appliquée et le contrôle `security:studio` est validé OK.

### Commandes de test du lot 2

```
bun run check                                   # typecheck + lint + tous les tests
bun run test:security                           # gardes texte des migrations 39 et 40, parité script, aucun service_role client
bunx vitest run src/lib/studio src/stores/studio.store.test.ts src/components/studio src/routes/api/studio
bun run build                                   # budget de bundle + scan de fuite
VITE_STUDIO_ENABLED=true VITE_SUPABASE_URL=https://fake-supabase.test VITE_SUPABASE_ANON_KEY=fake \
  bunx playwright test tests/e2e/studio.spec.ts # parcours Assises desktop + mobile, surfaces Supabase interceptées (fixtures)
```

## 5. Ajouter une colonne publique à `products`

Depuis le lot 1, **deux vues** listent explicitement les colonnes : `products_public` et `studio_products`. Une colonne ajoutée à `products` doit être ajoutée aux grants `anon` + `authenticated`, aux deux vues, à `PUBLIC_PRODUCT_COLUMNS` (`src/lib/catalogue/product-columns.ts`) et au type `Database`. Procédure complète : `RUNBOOK_SECURITY_GRANTS.md` § 2.

## 6. Modèle métier posé par le lot 1 (rappel pour les lots suivants)

- Readiness (`src/lib/studio/readiness.ts`) : `discovery` → `project` → `quote` → `reservation`, chaque niveau expliqué par des raisons. Le prix public actif de la base est une vérité commerciale ; il n'est `pending` que s'il est absent et `estimated` (indicatif) que si un admin le marque ainsi. `reservation` exige une voie de fulfillment **confirmée pour ce produit**.
- Voie confirmée (`src/lib/studio/fulfillment.ts`, `confirmedFulfillmentPaths`) : exactement trois cas — (1) stock réel (`stock_lines`) couvrant la quantité demandée pour ce coloris ; (2) `standard_production` explicitement confirmée par un admin pour ce produit/variant (`is_confirmed`) ; (3) `grouped_production` explicitement confirmée. Un MOQ, une option `seed_moq`, une option déclarée sans confirmation ou n'importe quel container ouvert ne confirment rien. Il n'existe plus aucun signal global de production.
- `seed_moq` : l'option `standard_production` semée par la migration au MOQ de la fiche signifie « la série standard de ce produit est connue ». Elle rend une quantité ≥ MOQ quotable (`standard_production` non confirmée, raison `production_unconfirmed` → projet `auto_quote_ready`), jamais réservable. Pour ouvrir la réservation d'un produit, un admin renseigne `confirmed_by` sur une option (ou en crée une, `source = 'admin'`).
- Fulfillment, ordre de priorité déterministe (`resolveFulfillment`) : (0) coloris RAL / dimensions spéciales ou produit sur demande → `manual_review` ; (1) stock réel couvrant la quantité → `stock`, confirmé ; (2) `standard_production` **confirmée** couvrant la quantité, quantité au niveau de la série → confirmé ; (3) `grouped_production` **confirmée** couvrant la quantité (même sous la série) → confirmé ; (4) aucune voie confirmée : `standard_production` non confirmée couvrant une quantité au niveau de la série → `production_unconfirmed`, devis seulement ; (5) `manual_review` avec raisons (`below_moq`, `colour_minimum`, `stock_insufficient`, `no_fulfillment_path`). Une voie confirmée n'est jamais masquée par une voie non confirmée ; entre standard confirmée et regroupement confirmé, la standard gagne. Aucune quantité n'est refusée, aucune disponibilité n'est inventée.
- État projet (`src/lib/studio/project-state.ts`) : `manual_quote_required` > `feasibility_review` > `reservation_ready` > `auto_quote_ready`, raisons par ligne. `reservation_ready` = toutes les lignes quote-ready **et** servies par une voie confirmée (`fulfillment.confirmed`).
- Qualité de données (`src/lib/studio/data-quality.ts`) : `verified | estimated | pending` + provenance ; une provenance heuristique n'est jamais `verified`.
- Store local (`src/stores/studio.store.ts`, clé `terrassea-studio-v1`, version 2 depuis le lot 2) : projet en cours (sélection explicite, quantité libre), découverte (interactions, favoris locaux, finalistes ≤ 3), Undo profondeur 50 par snapshot complet. Un état v1 migre sans perdre la session ni le projet. Pour un utilisateur connecté, les favoris Studio sont en plus reflétés dans `product_favorites` par les fonctions existantes (`useStudioFavoritesSync`) ; un anonyme reste pleinement servi.

## 7. Moteur V0 (lot 2) — ce qu'il est, ce qu'il n'est pas

`src/lib/studio/engine/` : `nextCard(state, catalogue, version)`, fonctions pures, `ALGORITHM_VERSION = 'v0.1'` porté par chaque carte et chaque événement.

- Entrée : uniquement les assises `discovery_ready` (rôle `seat`, active, image principale), projetées en `{id, material, seatKind, familyId}`. **Le prix n'entre jamais dans le moteur** (test : deux catalogues identiques à prix différents → même séquence). `familyId` n'est transmis que pour une famille vérifiée (preuve fournie par la projection SQL publique de la migration 39).
- Ordre initial : round-robin par matière puis par sous-type, mélange seedé par `sessionId` (FNV-1a + mulberry32, aucun `Math.random`).
- Signaux : j'aime +1 / pas pour moi −1 sur matière, sous-type, famille vérifiée ; passer = vu, poids 0 ; bonus de nouveauté (+0,5 par matière ou sous-type jamais montré) ; malus de répétition (−1 si les 3 dernières cartes partagent la matière ou la famille) ; exploration ε = 0,2 seedée par `sessionId` + position.
- Déterministe : même session + même historique = même carte.
- Finalistes : parmi les favoris, classés par affinité ; 3 maximum ; le 3ᵉ seulement si son affinité est > 0 ; « Voir plus » propose 2 candidats à comparer, jamais plus de 3 sélectionnés.
- Duels : désactivés (`findDiagnosticDuel(..., {enabled: false})`) ; jamais sans paire explicite vérifiée.
- Limites assumées : V0 ne comprend aucun goût et l'interface ne le prétend jamais (vocabulaire : « Voici des assises variées », « Vos favoris », « Vos finalistes », « Affinons votre sélection » ; aucun pourcentage d'affinité). Il sert à développer l'UX, garantir la diversité, tester Undo et enregistrer les interactions. Le moteur V1 (lot 3) est disponible uniquement en preview explicite ; il ajoute l’UX de convergence et épingle la version dans le store v3 en conservant les données v2.

## 8. Mesure (lot 2)

- Événements métier : `studio_started`, `card_liked`, `card_disliked`, `card_passed`, `undo`, `favorite_added`, `favorite_removed`, `finalists_viewed`, `seat_selected`, `quantity_changed`, `project_completed` (réservé, jamais émis au lot 2 : aucun état correspondant n'existe). Envoi groupé par `POST /api/studio/events` (zod strict, origin-check, 60 lots / 10 min par IP, ≤ 20 événements par lot, aucune PII), écrit avec le client admin côté serveur uniquement. Un échec est silencieux pour l'utilisateur.
- Miroir marketing minimal (`src/lib/analytics.ts`) : `studio_started` seulement ; `project_completed` réservé. Soumis au consentement existant (Consent Mode / Plausible inchangés).

Dans le Lot 2, `SUPABASE_SERVICE_ROLE_KEY` sert à ingérer côté serveur les événements Studio. Le Lot 2 ne fait aucune réservation. Les favoris connectés sont sérialisés par compte et produit ; les lots d’événements sont envoyés dans leur ordre, sans chevauchement. Une référence persistée absente du catalogue reste visible et retirable, avec état « Devis manuel » et montant à vérifier.

## Lot 3 — code local, données et production en attente

Le [runbook Lot 3](STUDIO_LOT_3_RUNBOOK.md) décrit les Decision Images, le pipeline DINOv2 hors ligne, les surfaces publiques minimales, l’onglet admin Studio, la version V1 et sa convergence adaptative. La migration 41 `20260908090000_studio_visual_intelligence.sql` est **NON APPLIQUÉE EN PRODUCTION** ; les migrations 39 et 40 restent appliquées et le Lot 2 reste PRODUCTION VERIFIED. Aucun déploiement Lot 3 ni traitement du catalogue réel n’a été effectué.

V1 s’utilise dans une nouvelle session preview via `/studio/assises?engine=v1`. La version est ensuite épinglée dans le store v3 ; les sessions v2 et leurs snapshots Undo restent conservés en V0. La curation est préparée en dry-run/draft, jamais activée automatiquement. Le flag public reste OFF, Supabase Auth et le cookie preview Path=/ ne changent pas.

### Lot 4 — bornes dimensionnelles (migration additive 43)

Le patch de plages vérifiées est décrit dans
[STUDIO_TABLE_DIMENSION_RANGES.md](./STUDIO_TABLE_DIMENSION_RANGES.md).
La migration 42 reste inchangée et NON APPLIQUÉE EN PRODUCTION ; la nouvelle
migration 43 est également NON APPLIQUÉE EN PRODUCTION. Les minima/maxima sont
facultatifs et les formes catalogue restent inchangées. DATA READY = NON : les
règles métier réelles doivent être validées séparément avant toute saisie.

### Lot 4 — formes techniques (migration additive 44)

Le moteur distingue carré, rectangle et rond à partir de la forme et des
mesures catalogue, sans modifier les produits. Sans règle vérifiée couvrant
la forme effective, le verdict reste non confirmé ; les exceptions exactes
restent prioritaires. La migration 44 ajoute seulement le contrat de règles
`square` et sa contrainte dimensionnelle. Migrations 42/43 inchangées ; aucune
règle commerciale ni rattachement créé. MIGRATION 44 PROD = NON APPLIQUÉE.
DATA READY = NON. Voir [les règles de classification](./STUDIO_TABLE_DIMENSION_RANGES.md).
