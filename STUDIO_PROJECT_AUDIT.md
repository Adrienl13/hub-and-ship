# STUDIO PROJET — AUDIT TECHNIQUE AVANT DÉVELOPPEMENT

Date : 07/09/2026 · Périmètre : repository `hub-and-ship` (Terrassea, marque de Pros Import EURL) + base Supabase de production (lecture seule) · Aucune modification de code, de schéma ni de données n'a été faite pour cet audit.

Conventions du document : les chemins sont relatifs à la racine du repo ; les chiffres « base » viennent de requêtes SQL en lecture seule exécutées le 07/09/2026 ; les chiffres « repo » viennent du code au commit `9a2b326`.

---

## A. Executive summary

### Architecture actuelle en une page

| Couche | Réalité |
|---|---|
| Frontend | TanStack Start `^1.168` (SSR) + TanStack Router file-based `^1.170`, React `19 RC`, TypeScript `5.6` strict, Tailwind `3.4`, Vite `8`. Déployé sur Cloudflare Workers (`wrangler.jsonc`, `nodejs_compat`). |
| État client | Zustand `5` avec `persist` (`src/stores/cart.store.ts`, `catalog.store.ts`) ; hooks React ; TanStack Query installé mais marginal. |
| Données | Supabase Postgres (37 tables, 2 vues, ~60 fonctions SQL, 89 migrations horodatées). Clients : anon (navigateur + SSR), `service_role` uniquement dans `createServerFn` et handlers `src/routes/api/*`. Pas de `pgvector`. |
| Catalogue | Source de vérité = tables `products` + `product_variants` (+ `product_pricing_inputs` pour les coûts, admin only). Lecture publique via la vue `products_public`. Mock `PRODUCTS` (6 produits) utilisé uniquement sans configuration Supabase. |
| Commerce | Panier (localStorage `container-club-cart`), règles de quantité (`src/lib/quantity.ts`), moteur de prix serveur (`pricing_parameters`, RPC `get_price`, `get_catalogue_prices`), réservation par RPC `create_reservation_with_items` (recalcul serveur anti-falsification), frais de réservation Stripe Checkout + webhook, devis = HTML imprimable côté client (non persisté). |
| Qualité | 84 fichiers de tests Vitest dans `src/` + 23 tests « sécurité » (vérifient les migrations) + 2 specs Playwright (locales, hors CI). Hook pre-commit = typecheck + lint + tests. CI GitHub = typecheck, lint, test, build. |
| Analytics | Plausible + GTM/GA4 (Consent Mode v2, clé `cc_consent`), attribution first-touch (`cc_attribution`) persistée sur les leads et réservations. |

### Points forts (réutilisables tels quels)

1. **Intégrité commerciale serveur** : `create_reservation_with_items` v5 recalcule chaque prix depuis `products` et `pricing_parameters`, refuse toute valeur client divergente (tolérance 0,05 €). Le Studio n'a rien à réinventer pour « l'IA ne modifie jamais les faits commerciaux » : le serveur l'impose déjà.
2. **Snapshots existants** : `reservation_items.product_snapshot` + `pricing_parameters_snapshot`, `partner_selection_items.product_snapshot`, `invoices.snapshot` — le pattern « un document = une photo figée du catalogue » existe et a déjà été corrigé en prod (migration `20260711190000_selection_snapshot_price_repair`).
3. **Composition table** : `src/lib/table-composer.ts` (compatibilité par forme, minimum par coloris, deux lignes de quantité égale) + `TableComposerDialog` + `CustomTableTopDialog`. C'est l'embryon du Studio « Tables ».
4. **Règles de quantité centralisées** : `getQuantityRule(product, variant)` est l'unique source des minimums (MOQ, minimum coloris, pas de 10 pour les assises). Réutilisable en lecture pour afficher, pas pour bloquer.
5. **Favoris déjà en base** : table `product_favorites` (user_id, product_id) + `useFavorites` + page `/account/favoris`. Non branchés dans le catalogue (retirés des cartes lors du redesign v3), mais le socle existe.
6. **Sélections partenaires** : `partner_selections` / `partner_selection_items` (brouillon → publié → archivé, snapshot, lien public `/p/{slug}?selection=`) — un « projet partagé » fonctionnel dont la structure préfigure `studio_projects`.
7. **Normalisation packshot** : `src/lib/images/normalize-packshot.ts` + `scripts/normalize-packshots.mjs` (détection fond blanc, recadrage, canevas carré, WebP q92). C'est déjà 70 % d'une « Decision Image ».
8. **Design system cohérent** : tokens CSS (`--sand`, `--ink`, `--ember`, `--paper`…), primitives shadcn/Radix (`src/components/ui/*`), Archivo + JetBrains Mono, `lucide-react`, `sonner`, pattern de dialogues lazy. Le Studio peut vivre dedans sans système parallèle.
9. **Mécanique de dégradation** : chaque hook DB a un fallback local propre quand Supabase n'est pas configuré. Le Studio pourra fonctionner en local sans base.

### Risques (détaillés en N et P)

1. **Données produit hétérogènes** : poids et dimensions génériques par famille (4,3 kg pour toutes les chaises BIS, 48×56×86 pour la majorité), 52 variantes nommées « Design présenté », 23 variantes sans photo, FOB absent de `products` (déplacé dans `product_pricing_inputs`, 135 lignes). Le Studio ne peut pas afficher ces valeurs comme contractuelles.
2. **Le MOQ est aujourd'hui bloquant côté client** : `sanitizeOrderQuantity` arrondit **vers le haut** silencieusement, le panier ne peut pas contenir une ligne sous MOQ, `buildReservationDraft` rejette. Le Studio doit contourner ce chemin (pas le modifier).
3. **Aucune notion de « famille de design »** : les noms de villes sont réutilisés entre familles (PATMOS existe en BIS chaise, BIS fauteuil, ROP chaise, TES fauteuil). Le nom ne peut pas servir d'identifiant de design.
4. **Aucun feature flag, aucun staging** : `wrangler.jsonc` n'a qu'un environnement, les « flags » sont des variables `VITE_*` de build. Il faut créer le mécanisme avant tout code Studio.
5. **Sécurité résiduelle** : un compte `authenticated` non admin peut lire `fob_usd` via `select *` sur `products` (seul `anon` est restreint colonne par colonne) ; incident du 07/09 (catalogue vide pour les anonymes après la migration 31) montre que les grants sont fragiles. Toute nouvelle vue Studio doit être testée avec le rôle `anon`.

### Compatibilité globale avec le Studio Projet

**Bonne.** Le repo a déjà les trois piliers dont le Studio a besoin : une source de vérité produit en base avec vue publique, un serveur qui recalcule les prix, et des patterns de snapshot. Les manques sont (a) des données produit à qualifier (statuts `verified/estimated`), (b) une classification `studio_role` / familles, (c) un mécanisme de flag et un environnement de préproduction, (d) un chemin « quantité libre » parallèle au panier. Aucun de ces manques n'impose de refactorer l'existant : tout peut s'ajouter en tables et modules séparés (voir R).

---

## B. Stack

### Framework et conventions

- `@tanstack/react-start ^1.168.20`, `@tanstack/react-router ^1.170.11`, `react ^19.0.0-rc`, `vite ^8.0.16`, `@cloudflare/vite-plugin ^1.40.0`, `typescript ^5.6.3` (strict), `tailwindcss ^3.4.14`, `zustand ^5.0.0`, `@tanstack/react-query ^5.100` (peu utilisé), `framer-motion ^12.38`, Radix (`dialog`, `checkbox`, `radio-group`, `tooltip`, `toggle`, `label`, `separator`, `slot`), `sonner`, `lucide-react`, `zod ^3.23`, `@supabase/supabase-js ^2.107`, `@supabase/ssr ^0.5`, `stripe ^22`, `three` + `@react-three/fiber` (scène container 3D, chunk lazy budgétisé par `scripts/check-bundle-budget.mjs`).
- Routing file-based dans `src/routes/` (53 fichiers) : suffixe `_` = route non imbriquée (`catalogue_.p.$slug.tsx`), `$` = paramètre, préfixe `-` = fichier de test exclu du routing, `[.]` pour les extensions (`product-feed[.]xml.tsx`). Arbre généré `src/routeTree.gen.ts` (`bun run gen-routes`).
- SSR partout. Loaders serveur : `catalogue.tsx`, `catalogue_.p.$slug.tsx`, 3 landings SEO, `fournisseur-mobilier-chr.tsx`, `avis.tsx`. Le reste est rendu client après hydratation.
- Fonctions serveur : `createServerFn` (8 fichiers, dont `stripe/checkout.ts`, `reservations/payment-status.ts`, `reservations/quote-access.ts`) ; routes API `src/routes/api/{contact,partner-requests,report-access,stock-requests,cron/payment-reminders,stripe/webhook}.ts`.
- `src/start.ts` : middlewares hôte canonique (308), en-têtes de sécurité, CSP en **Report-Only**, CSRF sur les server functions.
- Conventions : commentaires métier en français datés (« 08/2026 »), tests co-localisés `*.test.ts`, ESLint flat config `--max-warnings=0` avec `no-explicit-any: error`, Prettier + plugin Tailwind, Conventional Commits imposés par `.husky/commit-msg`.

### Build, infra, environnements

- Package manager **bun** (`bun.lock`, CI `oven-sh/setup-bun`) mais hooks Husky en `npm run …` (mélange toléré).
- Scripts utiles : `dev`, `build` (+ budget bundle + scan de fuite de constantes internes), `deploy` (`wrangler deploy`), `check`, `test`, `test:security`, `test:e2e`, `gen-types` (écrit vers `src/types/supabase.ts` qui n'existe pas : chemin mort, les types Supabase sont écrits à la main dans `src/lib/supabase/types.ts`).
- `wrangler.jsonc` : un seul environnement, routes `prosimport.com` + `www`. **Pas de staging** malgré `docs/SCRIPTS.md` qui le mentionne.
- Variables lues réellement (`.env.example` documente davantage) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`, `BREVO_API_KEY`, `BREVO_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `VITE_PLAUSIBLE_DOMAIN`, `VITE_GTM_ID`, `CRON_SECRET`. Les variables « business » de `.env.example` (`DEFAULT_VAT_RATE`, `RESERVATION_FEE_*`, `CONTAINER_*`) **ne sont lues nulle part** ; la table `app_config` qu'elles évoquent n'existe pas.
- Autres services : Brevo (email), Stripe Checkout, INSEE Sirene (Edge Function `verify-siret`), Plausible, GTM/GA4, Google Fonts.

### Feature flags

Aucun système. Les seuls interrupteurs sont des variables de build (`VITE_GTM_ID`, `VITE_PLAUSIBLE_DOMAIN`) et l'absence de config Supabase (fallback local). Rôles : RPC `is_admin()`, `is_partner()` + composants `AdminGuard`, `PartnerGuard`.

---

## C. Product data map (source de vérité)

| Donnée | Où elle vit réellement | Remarques |
|---|---|---|
| id | `products.id` (text, ex. `bis-001`, `sku-698`) | Clé métier, référencée par variantes, stock, réservations, favoris. |
| SKU | `products.sku` (unique) | Suffixe d'URL (`/catalogue/p/<slug>-<sku>`), identité stable. |
| Nom | `products.name` | Modèle « Type de produit VILLE - finition ». |
| Slug | calculé : `src/lib/catalogue/product-slug.ts` | Non stocké. |
| Catégorie | `products.category` (enum `product_category` : chair, armchair, table, table_base, table_top, bench, lounge) | Pas de sous-catégorie. « Chaise haute » (tabouret) est classée `chair`. |
| Prix HT | `products.base_price_ht` (public, direct) ; prix canal via RPC `get_catalogue_prices` ; overrides `channel_price_overrides`, `product_partner_prices` | Le client ne voit que son propre canal. |
| TVA | codée en dur 20 % (`src/lib/order.ts:116`, `panier.tsx`, `OrderSidebar.tsx`, `p.$partnerSlug.devis.tsx:26`) ; défaut SQL 20.00 dans le RPC ; stockée par réservation et par facture | Voir S (règles commerciales). |
| MOQ | `products.moq_units` ; minimum coloris `product_variants.min_order_units` ; règle combinée `src/lib/quantity.ts` | Pas de MOQ global en base ; distribution active : 50 unités (82 produits), 20 (19), 10 (8), 25 (5), 15 (3), 5 (3), 30 (2), 70 (1). |
| Stock | `stock_lines` (7 lignes, `available_units`, `stock_price_ht`, `location`, `condition`) ; hook `useStockLines` | Indépendant du catalogue container. |
| Dimensions | `products.dim_length_cm/width/height` (+ `table_shape` pour rond) | Beaucoup de valeurs génériques (voir D). |
| Poids | `products.weight_kg` | Générique par famille. |
| Volume | `products.cbm_per_unit` | 13 produits à la valeur par défaut 0,05. |
| Matière | **non structurée** : dans `name`, `description`, `features[]` | Détectable par préfixe SKU (BIS/ROP/TES) et mots-clés. |
| Descriptions | `products.description` (texte long généré selon un gabarit) + `features[]` | Gabarit répétitif, utile pour le SEO, peu pour le Studio. |
| Images | `products.main_image_url`, `products.gallery_urls[]`, `product_variants.image_url`, `product_variants.gallery_urls[]` → bucket public `catalogue-images` | Anciennes photos aussi dans `public/catalogue/*` (1 124 WebP embarqués dans le déploiement). |
| Variantes / coloris | `product_variants` (309 lignes) | Un « design » = une photo ; pas de code couleur structuré. |
| Finitions | dans le nom de variante (« maille textilène noir ») | Non structuré. |
| Disponibilité | `products.is_active`, `products.visibility` (`public`/`on_request`), `stock_lines`, container ouvert (`containers.status='open'`) | Aucun container ouvert au 07/09. |
| Remises | `pricing_parameters` (paliers 100/−6 %, 150/−10 %, frais 3 %/150/500) + miroirs codés en dur (`order.ts`, `public-rules.ts`, `customer-discounts.ts`) | Quatre copies des mêmes chiffres (TS ×2, SQL ×2). |
| Statut actif | `products.is_active` (RLS publique = actifs seulement) | 123 actifs / 196. |
| Coûts | `product_pricing_inputs` (fob_usd, qty_per_container, is_loss_leader, table_price_modifier_rate), admin only | La colonne `products.fob_usd` est vide (héritage). |

**Duplications de source de vérité**
- Fixtures d'import `src/lib/{bistro,rope,teslin,table-base}-products.ts` (≈ 8 700 lignes) : copie statique de produits déjà en base, utilisées par les boutons « Importer » de l'admin. Aucune synchronisation retour.
- Mock `src/lib/products.ts` `PRODUCTS` (6 produits Unsplash) : fallback local + tests.
- Constantes commerciales dupliquées (voir S).
- Types `Database` écrits à la main (`src/lib/supabase/types.ts`), vues non typées (`Views: Record<string, never>`).

---

## D. Seats audit (assises)

### Volumes (base, 07/09/2026)

| Catégorie | Total | Actives | Avec image principale | Galerie moyenne | Sans galerie | Poids = 0 | Dim = 0 | Sans features | Variantes moy. |
|---|---|---|---|---|---|---|---|---|---|
| chair | 100 | 63 | 62/63 | 5,5 | 5 | 6 | 6 | 6 | 1,7 |
| armchair | 40 | 24 | 24/24 | 7,2 | 1 | 1 | 1 | 1 | 2,2 |

Soit **87 assises actives** (63 chaises + 24 fauteuils), 140 en tout. `fire_rating` renseigné (M2) sur 85 des 87 actives.

### Familles réelles (par préfixe SKU)

| Préfixe | Matière dominante | Structure | Assises actives | Observations |
|---|---|---|---|---|
| `BIS-` | tressage PE / cannage, esprit bistrot parisien | aluminium finition bambou ou rotin | 39 (25 chaises + 14 fauteuils) | Dimensions génériques 48×56×86 sur la majorité des chaises, poids 4,3 kg (chaises) / 4,8 kg (fauteuils) partout. Motifs graphiques (chevron, damier, rayé, losange). |
| `ROP-` | cordage outdoor | aluminium | 17 (14 chaises + 3 fauteuils) | Dimensions 52×60×82 sur la majorité, poids 5,2 kg / 6,2 kg partout. Designs plus sobres, enveloppants. |
| `TES-` | textilène (maille ou tressage) | aluminium | 21 (15 chaises + 6 fauteuils) | 54×58×84 / 62×60×82, poids 4,8 / 6,2 kg. Inclut 2 chaises hautes (TES-024, TES-043) classées `chair`. |
| `SKU-`, `SK-`, `CHA-` | mixte (rotin, tressage) | aluminium | 10 | Fiches importées récemment : 6 sans dimensions ni poids (SKU-321, 324, 336, 368, 369, 521), nom minimal (« Chaise ELOP », « Chaise Basse »). |

Aucune assise n'est en aluminium nu ; « aluminium » est toujours la structure, jamais l'assise. L'axe « aluminium » du brief n'existe pas dans le catalogue actuel.

### Images par assise

- 125 fichiers `products/` + 325 fichiers `designs/` dans le bucket (471 objets, 177 Mo, 358 WebP, 106 JPEG, 7 PNG). Taille moyenne d'une photo produit : 85 ko, max 375 ko.
- Galerie : moyenne 5,5 photos (chaises), 7,2 (fauteuils). Les galeries BIS/ROP/TES sont des séries fournisseur : face, trois-quarts, profil, dos, détail tressage, parfois ambiance. Les 12 fiches importées le 06/09 ont 2 à 3 photos.
- Résolution : non mesurable en base (Storage ne stocke que taille et MIME). Les photos passées par l'admin sont normalisées en carré blanc WebP q92 (`normalize-packshot.ts`) ; les photos importées par script ou en `public/` ne le sont pas toutes (`public/catalogue/teslin-series/TES-042-08.webp` fait 708 ko).
- Fond : packshots fond blanc majoritaires ; quelques ambiances (galeries TES/ROP). Le composant `SafeImage` affiche en `object-contain` sur blanc, sans `srcset`, sans transformation.

### Noms réutilisés et familles de design

- 62 noms de ville sont partagés par au moins 2 produits, 25 par 3 produits, PATMOS par 4 (BIS-060 chaise tressage, BIS-062 fauteuil tressage, ROP-040 chaise cordage, TES-020 fauteuil textilène). **Le nom ne désigne pas un design** : c'est un nom marketing attribué par famille d'import.
- Même famille, même nom, catégories différentes : NICE (BIS-022 fauteuil, ROP-002 fauteuil), MONTMARTRE (BIS-009 et BIS-061, deux fauteuils différents).
- Modèles visuellement proches probables (à vérifier photo par photo, pas par le nom) : les chaises ROP à 52×60×82 / 5,2 kg / 99 € (ROP-021 à ROP-033, ROP-036, ROP-045, ROP-046) partagent structure et prix : très probablement **un même design en plusieurs coloris**, saisi comme produits distincts. Idem pour BIS-043 à BIS-058 (48×56×86, 89 €, 149 € public) et TES-016/017/021/030/039 (54×58×84, 89 €, 156 €).
- Conséquence : un futur `model_family_id` doit être **saisi à la main** (ou proposé par similarité visuelle puis validé), jamais dérivé du nom.

### Anomalies de classification (à corriger avant le Studio)

| SKU | Problème |
|---|---|
| ROP-031 | « Chaise de terrasse ATHENES » classée `lounge`, prix 1 225 € (probablement un lot ou une erreur) |
| ROP-016 | « Table de terrasse SIENA » classée `lounge` |
| TES-031 | « Ensemble repas CEVENNES » classé `armchair` (140×80×74, 18 kg) |
| BIS-049 | « Chaise de bistrot MARBELLA » classée `armchair` |
| TBA-010 | « Piètement ROUSSILLON » classé `table` (inactif) |
| TES-024, TES-043 | « Chaise haute » (tabouret de bar) classées `chair` |
| BIS-009 | hauteur 29 cm (fauteuil) |
| BIS-066 | dimensions 0×0×84 |
| ROP-004 | table avec dimensions de chaise (56×62×83) |
| TES-034 | 70×0×67 |
| BIS-030 | prix pro 181 € > prix public 149 € |
| TES-027 | prix pro 79 € vs public 89 € (écart faible, à confirmer) |

---

## E. Tabletop audit (plateaux)

5 plateaux, tous actifs, tous créés le 06/09/2026 (fiches complétées le 07/09) :

| SKU | Forme | Dimensions | Décors (variantes) | MOQ | Min. coloris | Prix HT | Poids |
|---|---|---|---|---|---|---|---|
| SKU-009 ARLES | carré | 60×60×1 | Marbre blanc, Noir effet marbre, Bois, Bois clair | 50 | — | 62 € | 5,5 kg (estimé) |
| SKU-803 AVIGNON | carré | 70×70×1 | Marbre blanc (15), Marbre noir (15), Bois, Bois clair | 15 | 15 sur 2 décors | 79 € | 7,5 kg (estimé) |
| SKU-804 UZES | rond | Ø70×1 | Marbre blanc, Noir marbre, Bois, Bois clair | 15 | — | 69 € | 6 kg (estimé) |
| SKU-802 NIMES | rectangulaire | 120×80×1 | Marbre blanc, Noir Marbre, Bois, Bois clair | 15 | — | 99 € | 14,5 kg (estimé) |
| SKU-801 LOUVRE | rond | Ø60×2 | Sable, Gris, Bleu, Vert (métal laqué liseré doré) | 70 | 70 sur les 4 | 89 € | 4 kg (estimé) |

- Donnée fiable : forme (`table_shape`), dimensions L×l ou Ø (saisies par Adrien), prix, MOQ, minimums coloris, décors (photos par variante, aucune variante sans image).
- Donnée estimée (marquée dans la description) : poids, volume, épaisseur.
- Sur mesure : géré par `CustomTableTopDialog` → email `/api/contact` topic `produit` (aucune table). Le produit `visibility='on_request'` existe en schéma mais **aucune ligne** ne l'utilise encore.
- Standardisation des décors : les 4 plateaux HPL partagent 4 décors nommés de 3 façons (« Noir effet marbre », « Marbre noir », « Noir marbre »). À normaliser en `option_groups.HPL_DECORS` (voir H).
- Incohérence de nommage des dimensions : `dim_length_cm` = 120 et `dim_width_cm` = 80 sur NIMES (corrigé), mais le composer traite toute forme non ronde comme rectangulaire : un carré 70×70 et un rectangle 120×80 sont la même « forme » pour la compatibilité. Insuffisant pour un piètement double colonne (ESTEREL 110×62) qui n'accepte pas un 60×60.

---

## F. Base audit (piètements)

8 piètements actifs (+3 inactifs) :

| SKU | Type | Dimensions | Poids | MOQ | Prix | `compatible_top_shapes` | Rabattable |
|---|---|---|---|---|---|---|---|
| TBA-001 AZUR | central alu, flip-top | 70×70×72 | 8,5 | 20 | 99 € | [] (tous) | oui |
| TBA-002 ESTEREL | double colonne | 110×62×72 | 14 | 20 | 149 € | [] | non |
| TBA-003 LUBERON | central classique | 70×70×72 | 8,5 | 20 | 99 € | [] | non |
| TBA-004 CAMARGUE | double colonne classique | 110×62×72 | 14 | 20 | 149 € | [] | non |
| TBA-005 PROVENCE | central classique | 70×70×72 | 8,5 | 20 | 61 € | [] | non |
| TBA-006 CEVENNES | central flip-top | 70×70×72 | 8,5 | 20 | 65 € | [] | oui |
| TBA-007 ALPILLES | central flip-top | 70×70×72 | 8,5 | 20 | 99 € | [] | oui |
| SKU-489 MARAIS | colonne style fonte | 45×45×72 (estimé) | 12 (estimé) | 50 | 69 € | [] | non |
| TBA-008/009/011 (inactifs) | flip-top / pliant / empilable | 52×52, 46×46, 49×49 | 0 | 20 | 63–65 € | [] | oui |

- **Aucune règle de compatibilité saisie** : tous les `compatible_top_shapes` sont vides, ce que le code interprète comme « accepte tout ». Aujourd'hui le composer proposerait un plateau 120×80 sur un piètement central 70×70 et un Ø60 sur une double colonne.
- Les « dimensions » saisies pour les piètements centraux (70×70×72) sont visiblement celles du plateau de démonstration, pas de l'embase. Dimension d'embase, diamètre de colonne, plateau max supporté : **absents**.
- Matériau : aluminium thermolaqué pour TBA-*, « style fonte » (probablement fonte d'aluminium) pour MARAIS ; couleur : seule variante « noir » ou « Standard ».
- Usage (hauteur table 72 vs mange-debout) : non structuré ; tout est à 72 cm.
- Mentions de compatibilité dans `features` : « Compatible projets terrasse CHR », « Plateau à sélectionner séparément » — marketing, pas technique.

---

## G. Images audit

- **Stockage** : Supabase Storage bucket public `catalogue-images` (préfixes `products/`, `designs/`, `stock/`, `containers/`, `site/`), URL directe `…/storage/v1/object/public/catalogue-images/<prefix>/<timestamp>-<rand>.webp`. Pas de CDN dédié, pas de Cloudflare Images, pas de transformation `?width=`.
- **Héritage** : `public/catalogue/**` contient 1 124 WebP + 156 JPEG (photos des séries BIS/ROP/TES importées par script), servis par le Worker. Certaines fiches pointent encore vers `/catalogue/...` (relatif) et d'autres vers Storage : deux origines d'images à unifier.
- **Formats** : Storage 76 % WebP, 22 % JPEG, 1,5 % PNG. Upload admin : max 5 Mo, MIME jpeg/png/webp/avif/gif, conversion WebP q92 si packshot détecté.
- **Chargement** : `SafeImage` = `<img loading="lazy" decoding="async">` + fallback « Photo à venir » ; pas de `srcset`/`sizes`, pas de `fetchpriority`, pas de preload d'image LCP. Une carte catalogue charge donc l'image pleine taille (souvent 1 000 à 1 500 px) pour un rendu de 180 px.
- **Decision Image** : les packshots BIS/ROP/TES sont majoritairement fond blanc, produit centré, angle trois-quarts. Le script `normalize-packshots.mjs` sait détecter le fond blanc, recadrer le contenu et le poser sur un carré avec 7 % de marge. Manques pour une Decision Image standard : angle uniforme (certaines vignettes principales sont de face, d'autres de trois-quarts), suppression des ombres/décor, taille unique (ex. 1 200×1 200), variante par coloris cohérente. Faisable à partir de l'existant pour ~80 % des assises actives ; les fiches SKU-3xx et BIS-061 (sans galerie) et les 23 variantes sans photo resteront hors standard.
- **Biais photographique** : les galeries fournisseur ne sont pas homogènes entre familles (fond gris pour SKU-698, blanc pour BIS). Sans normalisation, un moteur visuel apprendra « fond » avant « chaise ».

---

## H. Customization audit

Représentation actuelle :

| Zone | Où | Structure |
|---|---|---|
| Coloris / tressage / cordage / textilène | `product_variants.name` + photo | Texte libre (« tressage vert émeraude / écru », « maille textilène noir »). 52 variantes « Design présenté » = placeholder. |
| Couleur structure | dans le nom du produit ou de la variante (« finition bambou ») | Non structuré. |
| Décors HPL | `product_variants` des plateaux | 4 décors, 3 orthographes. |
| Couleur piètement | variante « noir » / « Standard » | Non structuré. |
| RAL / Pantone | placeholder texte de `CustomColorwayDialog` | Aucun champ. |
| Sur demande | `CustomColorwayDialog`, `CustomTableTopDialog`, `ColorRequestCta` → email | Aucune persistance, événements analytics `custom_colorway_request`, `custom_table_top_request`. |
| Minimum par coloris | `product_variants.min_order_units` | Structuré (6 variantes). |

Il n'existe **aucune primitive** `customization_zones` / `option_groups`. La seule structure réutilisable est `product_variants` (une variante = une combinaison photographiée). Recommandation (voir R) : ne pas remplacer les variantes ; ajouter une couche descriptive `studio_option_groups` + `studio_variant_options` qui rattache chaque variante existante à des options normalisées (`PE_WEAVE_COLORS.vert_emeraude`, `FRAME_COLORS.bambou`, `HPL_DECORS.marbre_noir`), sans casser le catalogue ni l'admin.

---

## I. Pricing / MOQ / stock audit

### Prix
- Prix public direct : `products.base_price_ht`. Prix canal (revendeur 0,7368, distributeur 0,6737, grand compte tier 3 d'office) calculés serveur (`get_catalogue_prices`, `get_price`), jamais exposés hors du canal du demandeur.
- Paramètres versionnés : `pricing_parameters` (une seule ligne active ; la ligne v1 est `is_active=false`, il existe donc une version active plus récente non listée ici). RPC public `get_public_pricing_rules()` : paliers 100/6 %, 150/10 %, frais 3 %/150/500, minimum distributeur 28 m³.
- Prix « éco-participation » : `products.eco_contribution` (0 partout aujourd'hui).
- Prix table : `table_price_modifier_rate` (admin, inutilisé côté client).
- Prix stock : `stock_lines.stock_price_ht` distinct du prix container.

### MOQ (comportement actuel, à ne pas réutiliser tel quel)
1. `getQuantityRule` : assises → min = max(MOQ, minimum coloris), pas 10 ; coloris spécial → min = minimum coloris, pas 1 ; sinon 1/1.
2. `sanitizeOrderQuantity` **arrondit vers le haut** : 6 chaises demandées deviennent 50 dans le panier, sans message d'erreur mais sans possibilité de rester à 6.
3. `cart.store.ts` applique cette règle à chaque écriture ; `QuantityStepper` aussi.
4. `buildReservationDraft` refuse toute quantité qui ne respecte pas la règle (« Quantité invalide pour … »).
5. Côté serveur, `create_reservation_with_items` n'impose **aucun MOQ produit** (seulement 1 ≤ qty ≤ 10 000 et le minimum m³ distributeur). Il n'y a donc pas de dead-end serveur : un projet sous MOQ peut être persisté si le client le permet.

Conclusion : le Studio doit disposer de sa propre notion de quantité (libre) et d'un statut commercial calculé (`standard`, `feasibility_review`, `manual_quote_required` avec raisons `below_moq`, `colour_minimum`, `on_request_product`, `unconfirmed_data`), et ne convertir un projet en panier/réservation que lorsque les quantités satisfont les règles existantes ; sinon il passe par une demande de devis manuel.

### Stock / production
- `stock_lines` : 7 lignes (dont 2 à 0 unité), toutes sur les SKU-3xx/5xx importés ; `stock_requests` capte les demandes. Pas de lien entre stock et MOQ container : la logique « servi par le stock malgré un MOQ » n'existe pas.
- Production : `containers` (4, tous livrés ou en transit, **aucun ouvert**), `container_seed_commitments` pour les unités engagées, `container_variant_commitments` (vue) pour « série confirmée ». La progression MOQ affichée est `units_committed + qty` vs `moq_units`.
- Regroupement / échantillon / offre adaptée : aucune structure.

---

## J. Quote / Stripe / reservation audit

### Devis
- `src/lib/quote.ts` : HTML imprimable généré côté client depuis le panier, référence `DV-<container>-<base36>`, « valable 14 jours », mentions TVA 20 % en sus, garantie 1 an. **Non persisté**, pas de snapshot.
- Devis partenaire co-brandé : `p.$partnerSlug.devis.tsx` depuis une `partner_selection` publiée, validité 30 jours (incohérent avec 14), `VAT_RATE = 0.2` local.
- Devis admin joint à une réservation : `reservations.quote_pdf_path` + bucket privé `reservation-quotes` (bucket **non créé par migration**, existe seulement en prod) + `quote-access.ts` (URL signée).
- Réutilisable : le gabarit HTML `buildQuoteHTML` (accepte un objet `QuoteData`) et le principe d'URL signée.

### Réservation
- `ReservationDialog` 4 étapes (SIRET vérifié INSEE, contact, mode de livraison, récap + CGV + paiement) + confirmation. Toujours en invité (`user_id=null`), rattachement au compte après paiement par `claim_my_reservations`.
- Persistance : RPC `create_reservation_with_items` (recalcul serveur, snapshot produit et paramètres par ligne, attribution UTM/partenaire, `volume_discount`, `requested_container_type`). Statuts : draft, pending_reservation_fee, reserved, deposit_called, deposit_paid, in_production, in_transit, delivered, cancelled.
- Base au 07/09 : **0 réservation** (les démos ont été supprimées).

### Stripe
- Checkout Session unique = frais de réservation (3 %, 150–500 €), montant lu en base (jamais du client), `metadata.reservation_id`. Webhook : `completed` → `reserved` + emails + lien magique compte ; `expired` → session détachée, réservation reste payable ; `async_payment_failed` → annulée. Idempotence par garde `status='pending_reservation_fee'`.
- Acompte 30 % et solde : hors plateforme (facturation manuelle, table `invoices` + RPC `issue_reservation_invoice`).
- Relances J+1/J+3 : cron `api/cron/payment-reminders` (`CRON_SECRET`).

Une future `reservation` Studio doit **réutiliser ce chemin** : convertir le projet en lignes `{productId, variantId, quantity}` puis appeler le même RPC ; le seul point neuf est le statut commercial en amont (sous MOQ = devis manuel, pas de RPC).

---

## K. Auth / session audit

- Auth Supabase, **magic link uniquement** (`signInWithOtp`), PKCE et implicite gérés dans `useAuth.ts`, callback `/auth/callback`. 1 utilisateur en base (admin).
- Rôles : `users_profile.role` (buyer/admin/super_admin) réconcilié avec `professionals.is_admin` par `is_admin()` ; partenaires via `partner_users` + `is_partner()`.
- Invité : tout le parcours commercial fonctionne sans compte ; identité = email + SIRET saisis ; historique local `container-club-local-reservations` (max 20) ; token d'accès au statut de paiement = `stripe_checkout_session_id`.
- Options pour la session Studio anonyme :
  1. **Identifiant de session local** (uuid dans localStorage, comme `cc_attribution`) + persistance serveur facultative via un RPC `security definer` à écriture étroite (pattern `subscribe_container_notification` / `stock_requests` avec `WITH CHECK` restrictif).
  2. **Sauvegarde sans compte** : prénom, nom, email → ligne `studio_projects` + token d'accès aléatoire (hash en base, brut dans l'URL), pattern déjà utilisé pour `quote-access.ts` et `payment-status.ts`.
  3. **Rattachement ultérieur** : magic link → RPC `claim_my_studio_projects` sur l'email vérifié, calqué sur `claim_my_reservations`.
  Aucune de ces options ne touche à l'auth existante.

---

## L. Design system audit

Réutilisable directement :
- Tokens : `--sand #f4efe7`, `--sand-soft #faf7f1`, `--sand-deep #e4dccd`, `--ink #1a1815`, `--ink-soft #5f584d`, `--ember #d97a34`, `--forest #3f8f2a`, `--paper #ffffff`, `--stamp #8a3a2a`, `--info #3a4f6a` + alias shadcn (`--background`, `--card`, `--muted`…). Rayon 4/8/12 px, ombres `subtle/soft/medium`, `.shadow-paper`.
- Typo : Archivo 400–900 (display + body), JetBrains Mono ; échelle `clamp()` (`display`, `h1`…`label`) ; `.label-eyebrow`.
- Primitives `src/components/ui/` : `button` (6 variantes, 4 tailles), `input`, `textarea`, `label`, `checkbox`, `radio-group`, `toggle`, `separator`, `tooltip`, `dialog`, `sheet` (drawer), `sonner`, `skeleton`. Manquent : tabs, popover, select, dropdown, accordion (faits main au cas par cas).
- Motifs de layout : header sticky, `CatalogueCommandBar` (barre basse fixe, apparaît quand le panier n'est pas vide), `MobileStickyBar`, `OrderSidebar` (rail droit desktop `lg:col-span-3`), dialogues lazy (`React.lazy` + `Suspense`), grilles `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, largeur `max-w-7xl`.
- Motion : framer-motion (`MoqProgressBar`, `motion-helpers.tsx` Reveal), keyframes Tailwind `fade-in`, `slide-up`, `fill-bar`, `pulse-success`.
- Pas de dark mode, pas de `prefers-reduced-motion`.

Pour la direction Studio (fond très clair, produit dominant, peu d'information) : `--sand-soft` / `--paper` en fond, `--ink` pour le texte, `--ember` réservé à l'action principale, pas de nouvelle palette. Le rail projet desktop = variante d'`OrderSidebar` ; la barre basse mobile = variante de `CatalogueCommandBar`.

---

## M. Analytics audit

- `src/lib/analytics.ts` : `track()` → Plausible + `dataLayer` ; `trackEcommerce()` GA4 (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`). 18 événements nommés (`reserve_open`, `add_to_cart`, `custom_table_top_request`, `share_selection`, `quote_pdf`…).
- Consentement : Consent Mode v2, clé `cc_consent` (6 mois), 4 signaux Google, bandeau affiché seulement si `VITE_GTM_ID`. GTM injecté après lecture du consentement.
- Attribution : `cc_attribution` (90 jours, first-touch UTM + `ref` partenaire), copiée dans `reservations`, `stock_requests`, `partner_applications`.
- Aucun événement fonctionnel propriétaire persisté en base ; aucune table d'événements produit. `security_events` existe mais est réservée à l'audit sécurité.
- Pour le Studio : les événements listés dans le brief (`studio_started` … `reservation_completed`) devront aller dans une table propriétaire (voir R) écrite par server function ; le miroir `dataLayer` restera optionnel et soumis au consentement.

---

## N. Security audit

Constats vérifiés :
1. `service_role` n'apparaît que dans `src/lib/supabase/admin.ts`, lu depuis `process.env`, appelé dans 12 fichiers tous côté serveur (`createServerFn`, handlers API). Isolation assurée par la compilation TanStack Start, pas par une convention de nommage.
2. RLS activé sur les 37 tables (aucune table sans RLS). 78 policies. Écritures publiques limitées à des RPC `security definer` ou à des policies `WITH CHECK` étroites.
3. `products_public` est `security_invoker` : `anon` a reçu le 07/09 un grant **colonne par colonne** (migration 37) après l'incident « catalogue vide » créé par la migration 31. `authenticated` garde `select` complet sur `products` : un compte connecté non admin peut lire `fob_usd` (colonne héritée, vide aujourd'hui, mais le risque revient si elle est réalimentée). Les vrais coûts sont dans `product_pricing_inputs`, admin only.
4. Bucket `reservation-quotes` référencé par le code mais absent des migrations.
5. `site_media` lisible sans condition ; `product_favorites` lisible/écrivable par son propriétaire uniquement.
6. Deux enums homonymes `reservation_status` (tables `reservations` et `container_reservations`, modèle historique parallèle) : piège pour toute nouvelle migration.
7. CSP en Report-Only ; en-têtes de sécurité présents ; rate limiting mémoire par isolate (`src/lib/security/*`), pas d'Upstash.
8. `Math.random()` pour les ids de variantes (admin only, acceptable).
9. Pas de pgvector, pas de secret dans le bundle (scan `check-bundle-budget.mjs`), `gitleaks` en pre-commit si installé.

Points d'attention avant le Studio :
- Toute nouvelle vue ou table lue par le Studio en anonyme doit être testée avec le rôle `anon` réel (curl REST), pas seulement `has_table_privilege`.
- Une table d'événements Studio écrite depuis le navigateur serait une surface d'insertion anonyme : préférer une server function (rate-limitée, origin-check, comme `/api/contact`) qui écrit avec `service_role`.
- Les tokens de projet partagé doivent être stockés hachés (pattern à introduire ; `payment-status.ts` compare aujourd'hui l'id de session Stripe en clair).

---

## O. Testing audit

- Vitest 4, jsdom, 84 fichiers dans `src/` (lib 13, pricing 10, partners 7, reservations 6, account 6, hooks 5, validation 4, admin 4, api 3, composants 3), 541 tests, ~25 s. Couverture v8 limitée à `src/lib`.
- `tests/security` (23 fichiers) : assertions sur le **texte** des migrations (présence de policies, revokes), pas sur la base réelle.
- `tests/e2e` : 2 specs Playwright (home, site-audit), projets chromium + Pixel 5, **hors CI**.
- CI : typecheck, lint, test, build. Pre-commit : idem + gitleaks.
- Manques pour le Studio : aucun test d'accessibilité automatisé (axe), aucun test visuel, aucun test de contrat REST avec le rôle `anon`, pas de test des hooks Zustand persist (`cart.store.test.ts` existe, seul), pas de test de charge sur le catalogue complet (fetch unique de 123 produits + 309 variantes à chaque session).

---

## P. Data inconsistencies (liste précise)

1. Catégories erronées : ROP-031, ROP-016 (`lounge`), TES-031, BIS-049 (`armchair`), TBA-010 (`table`), TES-024/TES-043 (chaises hautes en `chair`).
2. Dimensions invalides : BIS-009 (h 29), BIS-066 (0×0×84), TES-034 (70×0×67), ROP-004 (dims de chaise sur une table), SKU-321/324/336/368/369/521 et BIS-061 (0×0×0).
3. Dimensions génériques par famille (48×56×86 sur 30+ chaises BIS ; 52×60×82 sur 20+ chaises ROP ; 54×58×84 sur 15+ chaises TES ; 62×60×82 sur tous les fauteuils ROP/TES) : plausibles mais non vérifiées produit par produit.
4. Poids identiques par famille (4,3 / 4,8 / 5,2 / 6,2 / 18 / 24 kg) : valeurs de gabarit.
5. `cbm_per_unit` = 0,05 par défaut sur 13 produits ; 0,08 sur la plupart des chaises ; aucune valeur mesurée pour les plateaux (estimées le 07/09).
6. Prix public < prix pro : BIS-030, ROP-001 ; TES-027 écart 10 €.
7. `retail_price_ref` = 0 : SKU-336 (actif) + 2 inactifs ; `base_price_ht` = 0 : BIS-069, BIS-063 (inactifs).
8. Variantes « Design présenté » : 52 ; « Standard » : 8 ; 23 variantes sans photo ; décors HPL nommés de 3 façons.
9. Descriptions contenant « estimé » / « à confirmer » : SKU-489, 009, 801, 802, 803, 804, 659, 698, 785 (fiches complétées le 07/09).
10. `products.fob_usd` vide sur 100 % des produits alors que `product_pricing_inputs` a 135 lignes : colonne héritée à ignorer.
11. Constantes commerciales dupliquées : frais de réservation (4 copies), paliers (4), TVA 20 % (7 emplacements), acompte 30 % (2) et « 27 % » affiché en dur, validité devis 14 j vs 30 j, garantie 1 an (~35 textes), raison sociale/SIRET (4), `SITE_URL` (2), adresse mail admin (3+).
12. `.env.example` documente des variables métier jamais lues et une table `app_config` inexistante.
13. `compatible_top_shapes` vide sur 100 % des piètements = « tout accepté » : faux techniquement.
14. Aucun container ouvert : `CURRENT_CONTAINER.reference = 'À affecter'`, `Hero` affiche « prochain container en préparation ». Le Studio ne pourra pas afficher de progression de série tant qu'un container n'est pas ouvert.
15. Bucket `reservation-quotes` hors migrations ; `gen-types` pointe vers un fichier inexistant ; vues non typées.
16. Deux origines d'images (Storage et `public/catalogue`), tailles hétérogènes (85 ko à 708 ko).

---

## Q. Missing data (liste précise)

| Donnée | État | Nécessaire pour |
|---|---|---|
| `studio_role` (seat / tabletop / base / catalog_only) | absent ; dérivable de `category` à 95 % (exceptions listées en P.1) | Lot 1 |
| Sous-type d'assise (chaise, fauteuil, tabouret/chaise haute, bain de soleil) | absent ; `category` + mot « haute » / « bain de soleil » dans le nom | Lot 2 |
| Matière d'assise structurée (tressage PE, cordage, textilène, cannage, rotin) | absent ; dérivable du préfixe SKU et des mots-clés à ~95 % | Lot 2 (filtre diversité) |
| Style (sobre, graphique, contrasté, neutre, forme fine, enveloppante) | absent, non dérivable | Lot 2 (dataset pilote) : étiquetage manuel |
| `model_family_id` | absent ; suspicions par (structure, dims, prix) à valider visuellement | Lot 3 |
| Statut de fiabilité par champ (dimensions, poids, prix, compatibilité) | absent ; 9 fiches marquées « estimé » en texte libre | Lot 1 (readiness) |
| Empilabilité, accoudoirs, hauteur d'assise, largeur d'assise | dans `features` texte pour quelques produits (« Empilable x8 ») | Lot 2 (détails), Lot 4 |
| Compatibilité plateau/piètement (dimensions max, type d'embase) | absent | Lot 4 |
| Dimensions d'embase / colonne des piètements | absent | Lot 4 |
| Options de personnalisation normalisées (groupes, codes couleur) | absent | Lot 5 |
| Decision Images (carré, fond blanc, angle unique, taille unique) | ~80 % faisable depuis les packshots existants | Lot 3 |
| Embeddings visuels, voisins, paires diagnostiques | absent | Lot 3 |
| Container ouvert (référence, capacité, seuil) | aucun ouvert | Lot 8 |
| Politique commerciale unique (`commercial_policy`) | dispersée (voir P.11) | Lot 7 (devis) |

---

## R. Recommended architecture

### Principes
1. **Additive uniquement** : aucune colonne modifiée ou supprimée sur `products` / `product_variants`. Toute donnée Studio vit dans des tables préfixées `studio_` reliées par `product_id` / `variant_id`, plus une vue `studio_products` (security_invoker, colonnes publiques uniquement, testée en `anon`).
2. **Le serveur reste la vérité commerciale** : le Studio lit `products_public`, `get_public_pricing_rules`, `get_catalogue_prices` ; il n'écrit jamais un prix. La conversion projet → réservation passe par `create_reservation_with_items` sans modification.
3. **Moteur déterministe en TypeScript pur** dans `src/lib/studio/engine/*` (fonctions pures, versionnées, testées comme `src/lib/pricing`). Données d'entrée précalculées (voisins, features) chargées depuis la base ; aucun appel LLM, aucun calcul vectoriel au runtime.
4. **Calcul hors ligne des features visuelles** dans `scripts/studio/*` (Node) ou un dossier `pipeline/` Python séparé, écrivant dans `studio_product_visual_features` et `studio_product_neighbors` via `service_role` **hors du Worker**. `pgvector` devient optionnel : utile pour recalculer les voisins en SQL, inutile au runtime. Divergence avec le brief : nous recommandons de **ne pas activer `vector` avant le Lot 3**, et de stocker les voisins en table classique (`neighbor_id`, `score`, `rank`) pour que le moteur live n'ait qu'un `select … where product_id = $1 order by rank`.
5. **État Studio côté client** : un store Zustand `src/stores/studio.store.ts` (persist, clé `terrassea-studio-v1`, `version` + `migrate` comme le panier) contenant la session anonyme, la pile d'interactions (pour Undo), les favoris, finalistes, le projet en cours. Synchronisation serveur asynchrone et facultative (server function, batch).
6. **Feature flag** : `VITE_STUDIO_ENABLED` (build) + garde de route (`beforeLoad` → `notFound()` si désactivé) + cookie de prévisualisation `studio_preview` posé par une route `/studio/preview?key=` comparée à `STUDIO_PREVIEW_KEY` (serveur). Local ON, prod OFF, preview possible sans redéployer. Les environnements distincts nécessitent d'ajouter `env.staging` dans `wrangler.jsonc` (voir plan, Lot 1).
7. **Analytics fonctionnels** : table `studio_events` alimentée par une server function (`createServerFn`, rate-limitée, origin-check) ; le `dataLayer` n'en reçoit qu'un sous-ensemble marketing, soumis au consentement.

### Emplacement dans le repo

```
src/routes/studio.tsx                 layout + flag guard + rail/bottom bar
src/routes/studio.index.tsx           entrée (Projet complet / Assises / Tables)
src/routes/studio.assises.tsx         découverte
src/routes/studio.tables.tsx          plateau + piètement
src/routes/studio.projet.tsx          résumé, sauvegarde, devis
src/routes/studio.p.$token.tsx        reprise / partage lecture seule
src/routes/api/studio/events.ts       ingestion événements (server)
src/lib/studio/                       types, readiness, commercial-status, engine/, snapshot, repository
src/stores/studio.store.ts
src/components/studio/                composants dédiés (réutilisent ui/*)
scripts/studio/                       decision images, features, neighbors (hors runtime)
supabase/migrations/2026xxxx_studio_*.sql
```

### Schéma cible (résumé, détaillé dans le plan)
- `studio_product_profiles` (1:1 `products`) : `studio_role`, `seat_kind`, `material`, `style_tags[]`, `model_family_id`, `data_quality jsonb`, flags de readiness calculés.
- `studio_model_families`.
- `studio_option_groups`, `studio_options`, `studio_variant_options` (rattache `product_variants` existantes).
- `studio_tabletop_base_rules` (règles générales par type/forme/dimension max + exceptions par couple, verdict `allowed/forbidden/requires_confirmation`).
- `studio_product_visual_features`, `studio_product_neighbors`, `studio_diagnostic_pairs`, `studio_algorithm_versions`.
- `studio_sessions`, `studio_events`.
- `studio_projects`, `studio_project_versions` (payload jsonb = items + snapshot prix + statut commercial + raisons), `studio_project_contacts` ou colonnes contact sur le projet, `studio_quotes` (snapshot figé + `valid_until` + `pricing_parameters_snapshot`).

Aucune de ces tables ne modifie l'existant ; toutes sont supprimables sans impact sur le catalogue (rollback trivial).
