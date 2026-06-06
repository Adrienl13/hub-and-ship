# 📜 Container Club — Changelog des versions de spec

> Toutes les évolutions du brief technique `CONTAINER_CLUB_SPEC.md`.
> Format inspiré de Keep a Changelog.
> Date sous format YYYY-MM-DD.

## [Non publié]

### Ajouté

- **Brief stratégique IA** : ajout de `docs/PLATFORM_STRATEGY.md` pour cadrer la vision Pros Import / Container Club, le modèle revendeur protégé + direct pro encadré, les chantiers prioritaires, les règles UX, les risques, les KPI et les sources marché.
- **Page `/partenaires`** : nouvelle entrée publique pour revendeurs CHR, agenceurs et apporteurs avec promesse "Votre client reste votre client", prix nets réservés, protection d'opportunité, modèle apporteur/revendeur/direct pro, FAQ canal et CTA beta partenaire.
- **Canal partenaires opérationnel** : ajout de `/api/partner-requests`, de la migration Supabase `partner_applications` / `partner_deals`, d'un formulaire public de demande/protection d'opportunité, d'un fallback local anti-perte de lead et d'un onglet admin `Partenaires` pour qualifier candidatures et deals.

### Modifié

- **Home** : ajout d'un bloc dual "J'équipe mon établissement" / "Je revends à mon réseau" pour rendre le modèle direct pro + partenaire protégé compréhensible dès le premier parcours.
- **Qualité** : refonte de `/qualite` en carnet de preuves public. La page affiche désormais le protocole qualité, la traçabilité et le coffre documentaire à venir avant les rapports DB, et ne montre plus un état Supabase vide comme signal principal.
- **Navigation/SEO** : ajout de `/partenaires` au header, au footer, au sitemap et aux parcours E2E publics.
- **Vue 3D container** : suppression de `@react-three/drei` au profit d'une scène R3F native plus légère, avec drag manuel, overlays HTML hors canvas et conservation du packing logistique existant.
- **Performance build** : ajout d'une garde `scripts/check-bundle-budget.mjs` appelée par `npm run build` et `npm run deploy` pour plafonner le chunk lazy `ContainerScene` en brut et gzip.
- **Devis imprimable** : le document reprend désormais le format container actif (`20'` ou `40'`) au lieu d'afficher un `20' High Cube` fixe, et l'UI signale les popups bloqués.
- **Réservation** : l'écran de confirmation affiche un libellé propre `Confirmation` au lieu d'un compteur incohérent `Étape 5 / 4`.
- **Réservations Supabase** : création atomique via RPC `create_reservation_with_items(payload)` avec fallback legacy si la migration n'est pas encore appliquée ; les policies d'insert anonyme direct sont fermées par la migration.
- **Retour paiement Stripe** : l'historique local garde l'UUID réel et reste en `pending_reservation_fee` tant que le webhook n'a pas confirmé le paiement ; la page compte distingue désormais paiement confirmé et synchronisation webhook en cours.
- **Webhook Stripe** : les événements `expired` / `async_payment_failed` n'annulent plus une réservation si l'événement provient d'une ancienne session Checkout remplacée par une session plus récente.
- **Stock 24h** : ajout d'un endpoint serveur same-origin `/api/stock-requests` qui reconstruit la demande depuis l'ID de lot et persiste via Supabase service role quand l'insert public navigateur n'est pas disponible ; le fallback local est désormais annoncé comme local à l'appareil.
- **Catalogue visuel** : remplacement de la vue lignes compactes par des cartes portrait plein cadre sur `/catalogue` et dans la section catalogue de la home, avec image bord à bord, variantes, MOQ et quantité directe.
- **Audit admin/Supabase** : l'accès admin indique maintenant précisément les variables publiques manquantes, le login bloque l'envoi de magic link tant que Supabase Auth est incomplet et le retour vers `/admin?...` est préservé après connexion.
- **Admin** : l'overview intègre le signal partenaire beta et l'onglet `Partenaires` lit/filtre les candidatures et opportunités protégées avec transitions de statut.

### DB / Migrations à appliquer

```
20260605183000  create_reservation_with_items_rpc
20260606190000  partner_applications_and_deals
```

---

## [1.6.0] — 2026-05-25

### Déploiement production

- **Hébergement Cloudflare Workers** — `@cloudflare/vite-plugin` ajouté à `vite.config.ts` (env `ssr`), `wrangler.jsonc` créé (`nodejs_compat`, `main: @tanstack/react-start/server-entry`), scripts `deploy` + `cf-typegen`. Worker `container-club` sur le compte `adrienlaniez1@gmail.com` (account `3eeab20f3ee5b419056b70f997568f62`). Déploiement via `bun run deploy`.
- **Domaine `prosimport.com`** — domaine OVH, NS délégués à Cloudflare (`augustus.ns` + `chelsea.ns.cloudflare.com`). Custom domains `prosimport.com` + `www.prosimport.com` bindés au worker via `routes` (`custom_domain: true`). HTTPS auto (Google Trust). Les A-records parking OVH importés ont dû être supprimés (erreur 100117).
- **Secrets worker** posés via `wrangler secret put` : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. `.env.production` ajouté (`VITE_APP_URL=https://prosimport.com` pour le callback auth).
- **SEO** — domaine canonique basculé `container-club.fr` → `prosimport.com` (JSON-LD `__root.tsx`, `robots.txt`, `sitemap.xml`, mentions légales).

### Corrigé

- **Auth totalement non fonctionnelle en prod**, 3 bugs en cascade :
  1. Compte admin seedé avec colonnes de token `NULL` dans `auth.users` → GoTrue 500 "Database error finding user" à chaque login. Fix : `NULL → ''`.
  2. `/auth/callback` en spinner infini — les liens magiques (admin API) délivrent la session en hash `#access_token`, mais le client `@supabase/ssr` (PKCE) ne lit que `?code=`. Fix : `useAuth.ts` détecte les tokens du hash et appelle `setSession`.
  3. RLS cassée site-wide (14 tables) — migration `harden_security_definer_functions` avait révoqué `EXECUTE` sur `current_user_role`/`current_company_id`/`is_admin` à `authenticated`, alors qu'elles sont appelées dans les policies RLS. Fix : migration `restore_rls_helper_execute` (re-grant). Cassait le lookup du rôle admin → utilisateur vu comme client.
- **Modèle admin unifié** — `is_admin()` ne regardait que `professionals.is_admin` alors que l'`AdminGuard` utilise `users_profile.role`. Migration `align_is_admin_with_profile_role` : `is_admin()` vrai si admin via l'une **ou** l'autre source. Débloque l'édition catalogue pour les admins `users_profile.role`.

### À faire (avant ouverture aux clients)

- Stripe en mode **TEST** (`sk_test_`) → passer en live + créer le webhook endpoint prod `https://prosimport.com/api/stripe/webhook` et mettre à jour les secrets.
- `RESEND_API_KEY` absent → emails transactionnels désactivés.
- Configurer un **SMTP custom** dans Supabase (Resend) pour fiabiliser l'envoi des liens magiques (l'envoi par défaut Supabase est trop limité).

---

## [1.5.0] — 2026-05-22

### Ajouté

- **SEO public** :
  - `public/robots.txt` (allow `/`, disallow `/admin`, `/account`, `/api`, `/auth`)
  - `public/sitemap.xml` (14 URLs : home, catalogue, livres, qualite, stock-24h, faq, legal hub + 6 docs, transport-partenaires)
  - **JSON-LD** `schema.org/Organization` inline dans `__root.tsx` avec l'identité réelle Pros Import EURL (legalName, founder Adrien Laniez, address 60 Rue François Ier 75008 Paris, SIRET, SIREN, VAT)
- **`AdminGuard`** (`src/components/AdminGuard.tsx`) — wrappe `/admin` :
  - Spinner pendant la vérif role (`useIsAdmin` hook)
  - Écran "Espace administrateur" + lien `/auth/login` si anonyme
  - Écran "Authentification indisponible" si Supabase pas configuré
  - Écran "Accès refusé" si authentifié mais role ≠ admin/super_admin
  - RLS reste la source de vérité côté serveur — le guard est la couche UX
- **Page `/transport-partenaires`** (`src/routes/transport-partenaires.tsx`) — la promesse de `DeliveryInfoBox` et du `ReservationDialog` est enfin tenue. Liste éditoriale de 5 partenaires (Geodis, Heppner, Mauffrey, Dachser, Upela) avec specialty, coverage, indicative pricing 2025-2026, contact direct, sans commission Container Club. Hero + process 3 étapes + grille de cards + FAQ transporteurs + CTA email pour zones hors-liste.
- **Onglet admin "Catalogue" éditable** :
  - `AdminCatalogueTab` + `AdminProductEditor` (CRUD complet : scalaires produit + grille variantes inline avec color picker + grille variantes × containers pour seed commitments)
- **Onglet admin "Demandes stock" éditable** (DB live, plus mock) :
  - Boutons inline pour transitions de statut `new ⇄ contacted ⇄ reserved ⇄ converted ⇄ closed` + `Rouvrir` + `internal_note` save-on-blur
- **Onglet admin "Réservations" éditable** (DB live, plus mock) :
  - Boutons inline pour les 8 transitions de statut codex (pending_reservation_fee → reserved → deposit_called → deposit_paid → in_production → in_transit → delivered + Annuler)
  - Dialog d'annulation avec select `cancellation_reason` (client_request / minimum_not_reached / supplier_issue / other)
  - `admin_notes` save-on-blur
  - Lien externe vers `dashboard.stripe.com/test/payments/<pi_id>` quand `stripe_payment_intent_id` est rempli (le refund effectif se fait depuis Stripe)
- **Onglet admin "Transporteurs"** (nouveau) :
  - DB-backed via la table `carrier_partners` (5 seeds migrés depuis `src/lib/carriers.ts`)
  - CRUD complet : Ajouter / Éditer / Désactiver / Activer / Supprimer + repeatable `strengths`
  - La page publique `/transport-partenaires` fetch désormais depuis DB (fallback silencieux sur la const TS si Supabase pas configuré ou vide)

### Modifié

- `src/routes/__root.tsx` : refonte meta SEO + JSON-LD inline via `scripts` array.
- `src/routes/admin.tsx` : route maintenant wrappée `<AdminGuard><AdminPage /></AdminGuard>`. Tab `Catalogue` rend `AdminCatalogueTab` au lieu du read-only `ProductsAndStockTable`. Tab `Demandes stock` rend `StockRequestsAdminPanel` DB-backed. Tab `Réservations` rend `ReservationsAdminPanel` DB-backed. Nouveau tab `Transporteurs`.
- `src/components/Footer.tsx` : nouvelle colonne "Logistique" (Transporteurs, Stock 24h, Qualité, Containers livrés) + correction SIRET (`988 269 981 00012` → `98826998100011`).
- `src/lib/supabase/types.ts` : `Database` étendu avec `products`, `product_variants`, `container_seed_commitments`, `carrier_partners` + enums `ProductCategoryDb`, `FireRatingDb`, `CarrierSpecialtyDb`.

### DB / Migrations appliquées

```
20260522095933  carrier_partners       (table + enum carrier_specialty + RLS + 5 seeds)
```

### Tests

- 193/193 Vitest verts (43 fichiers de test)
- tsc + ESLint `--max-warnings=0` + Vite build : tous verts

### Maintenance dépôt

- Branches obsolètes supprimées : `feat/integrate-all`, `codex/session-0-initialization`, `claude/analyze-project-status-zIlOM`, `feat/trust-pages-and-legal` (pruned).
- Archives sauvegardées en tags : `archive/main-stripe-stack-2026-05-22`, `archive/claude-analyze-2026-05-22`.
- `adrienlaniez1@gmail.com` créé dans `auth.users` + promu `role='admin'` dans `users_profile`.

### À faire avant ouverture publique (rappel)

- Brancher SMTP custom sur Supabase Auth (Resend / Postmark) — sinon magic link login impraticable.
- Poser secrets prod via `wrangler secret put` : `STRIPE_SECRET_KEY` (sk*live*), `STRIPE_WEBHOOK_SECRET` (whsec\_), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.
- Webhook Stripe prod côté dashboard avec URL Worker prod.
- Uploader vrais PDFs SGS dans le bucket `quality-reports`.
- Validation juridique des 6 docs `/legal/*`.
- Téléphone placeholder `+33 (0)4 91 00 00 00` à remplacer par un vrai numéro.
- Domaine prod : actuellement `container-club.fr` dans sitemap + robots + JSON-LD — confirmer ou ajuster.

---

## [1.4.0] — 2026-05-22

### Ajouté

- **Stripe Checkout** (redirect, frais de réservation uniquement) — server function `createCheckoutSession` (`src/lib/stripe/checkout.ts`), webhook signé `POST /api/stripe/webhook`, badges trust Stripe + Qonto dans le `ReservationDialog` step 4. E2E validé via `stripe trigger` (status → `reserved`, idempotence sur retries).
- **Containers livrés** — pages publiques `/livres` (liste + stats cumulées) et `/livres/$slug` (timeline color-coded, breakdown produits, galerie, témoignage long, certifications). Composant home `PastContainers` câblé à Supabase, fallback mock si non configuré.
- **Qualité & Tests** (SGS / Eurofins / CE…) — page `/qualite` publique avec preview metadata, accès au PDF complet gated par auth via server fn `getReportFileUrl` (signed URL Supabase Storage TTL 60 s). 3 rapports SGS AQL seedés.
- **Bucket Storage `quality-reports`** (private, 10 MB, application/pdf) + RLS admin sur `storage.objects`.
- **Upload PDF dans l'admin** — input file caché + validation client (mime, taille) + naming auto + cleanup de l'ancien fichier au remplacement, dans `AdminQualityReportEditor`.
- **Pages légales** — `/legal` hub + `/legal/$slug` dynamique pour 6 docs : mentions-legales, cgv, cgu, confidentialite, cookies, remboursement.
- **Page FAQ dédiée** `/faq` (vs ancre `#faq` sur la home).
- **Tab admin "Containers"** — édition complète des containers livrés (timeline, gallery, breakdown, témoignage long) + boutons Publier / Dépublier.
- **Tab admin "Qualité"** — CRUD rapports qualité + upload PDF + bannière warn pour les non-admins.

### Modifié

- **Identité légale réelle** : `Terrassea SAS` → `Pros Import EURL`, SIRET `98826998100011`, TVA `FR08988269981`, RCS Paris `988 269 981`, siège `60 Rue François Ier, 75008 Paris`, gérant Adrien Laniez, contact `adrienlaniez1@gmail.com`. Tribunal de commerce passé à Paris dans les clauses contentieux. Capital social 500 €.
- **Header** : nav `Containers livrés` pointe vers `/livres` (vraie page), nav `FAQ` vers `/faq`.
- **Footer** : 4 placeholder `href="#"` remplacés par les vrais slugs légaux + ajout liens CGU, Cookies, "Tous les documents légaux →".
- **`reservations` schema DB** : passage du schéma anon (cents, name/company) au schéma codex (reference, contact_snapshot jsonb, reservation_fee numeric EUR, status enum 9 valeurs). Ancien schéma droppé sans perte de données (0 lignes).
- **Bug RLS RETURNING corrigé** : `createReservation` génère désormais l'UUID côté client + `.insert()` sans `.select()` pour éviter le rejet RLS 42501 sur les tables write-only. Throttle anti-double-clic 30 s ajouté.
- **Bundle perf** : lazy-loading 3D `ContainerScene` + manualChunks Vite (three, recharts, motion). Chunk client `1 105 kB → 295 kB` (gzip 307 → 92 kB).
- **Meta SEO** : `<html lang="fr">`, og:locale `fr_FR`, titres/descr FR.

### DB / Migrations appliquées sur `mkfztwibolswqcggukeq`

```
20260522072602  auth_security_foundation
20260522072619  siret_cache
20260522072640  reservation_foundation
20260522072652  stock_requests
20260522072655  stripe_payment_columns
20260522080351  delivered_containers_publication
20260522082730  quality_reports
20260522084627  quality_reports_storage_bucket
```

### À faire avant ouverture publique

- Brancher SMTP custom sur Supabase Auth (Resend / Postmark) — limite par défaut 3-4 mails/h.
- Poser secrets prod via `wrangler secret put` : `STRIPE_SECRET_KEY` (sk*live*\_), `STRIPE_WEBHOOK_SECRET` (whsec\_\_), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.
- Configurer webhook Stripe prod côté dashboard avec l'URL Worker prod + events `checkout.session.completed/expired/async_payment_failed`.
- Uploader les vrais PDFs SGS dans le bucket `quality-reports` via l'admin web ou Dashboard Supabase.
- Faire valider les 6 textes légaux par un conseil juridique (modèles indicatifs).
- Remplacer le téléphone placeholder `+33 (0)4 91 00 00 00` (Marseille) par un vrai numéro Paris.

---

## [1.3.0] — 2026-05-17

### Ajouté

- **Vérification SIRET obligatoire** via API INSEE Sirene au checkout/devis/callback (section 6.8)
- **Section 18.bis** : Sécurité B2B blindée (OWASP Top 10 2025, 11 sous-sections, ~500 lignes)
- **Table `security_events`** : tracking événements sécurité avec enum
- **Table `siret_cache`** : cache 7 jours des réponses INSEE
- **Edge Function `verify-siret`** : proxy INSEE avec OAuth + cache + rate limit
- **Edge Function `recheck-pending-sirets`** : cron quotidien re-vérification SIRET
- **Champs `companies` enrichis** : `siret_verified`, `naf_code`, `legal_form`, `creation_date`, `is_active_company`, `risk_flag`
- **Contrainte unique SIRET** : 1 SIRET = 1 compte (anti-spam)
- **Article 8 CGV** : Livraison et transport (rendu port + clause SIRET obligatoire)
- **Composants validation** : `SiretInput`, `SiretVerificationDisplay`, `EmailDomainWarning`, `ValidatedInput`
- **Suite tests sécurité** : `tests/security/` avec access-control, input-validation, pricing-manipulation, etc.
- **Scans automatisés** : Semgrep SAST + Snyk SCA + OWASP ZAP DAST + gitleaks
- **Plan réponse incident** documenté

### Modifié

- Section 16.7 checkout : flow 4 étapes avec SIRET obligatoire en étape 1
- Variables env : ajout INSEE_API_KEY, INSEE_OAUTH_URL, blocklist emails personnels
- Phase 1 plan livraison enrichie (sécurité dès le départ)
- Checklist pré-launch : nouvelle section "Sécurité" complète

### Décisions clés

- SIRET cessé/inactif → **blocage strict** création compte
- Emails personnels (gmail, etc.) → **warning souple**, pas blocage
- Rate limiting V1 → **Cloudflare WAF** (gratuit), Upstash prévu V2
- Audit sécurité V1 → **scans automatisés**, pentest pro après 3-5 containers
- Stripe Radar + 3DS2 → **activés systématiquement**

---

## [1.2.0] — 2026-05-17

### Ajouté

- **Table `carrier_partners`** : transporteurs recommandés sans contrat
- **Table `delivery_history`** : préparée pour V2 (estimateur dynamique futur)
- **Page publique `/transport-partenaires`** : liste transporteurs avec tarifs indicatifs
- **Page admin `/admin/carriers`** : gestion transporteurs
- **Page admin `/admin/delivery-history`** : suivi livraisons
- **Composants livraison** : `CarrierPartnersList`, `CarrierCard`, `DeliveryModeSelector`, `DeliveryInfoBox`
- **Article 8 CGV initial** : Livraison rendue port (modifié en V1.3)
- 5 transporteurs initiaux dans seed data (Geodis, Heppner, Mauffrey, Dachser, Upela)

### Modifié

- `delivery_mode` enum simplifié : 3 valeurs (pickup_at_port, partner_carrier_needed, self_arranged)
- Checkout : étape choix livraison obligatoire (3 radio buttons)
- Section 7.1 home : nouveau bloc "Comment la livraison fonctionne"
- Section 14.2 multi-pays : précision sur évolution livraison

### Supprimé

- Table `delivery_zones` (réintroduisable en V2)
- Table `postal_code_zones` (réintroduisable en V2)
- Composant `DeliveryZoneCalculator`
- Champ `delivery_total` dans `reservations`
- Champ `delivery_zone_id` dans `reservations`

### Décisions clés

- Container Club ne facture PAS la livraison post-port en V1
- Raison : pas de partenariats transporteurs + délai 60j incompatible avec devis transport
- Approche : "Le prix d'un grossiste pro, le prix juste sur le transport"

---

## [1.1.0] — 2026-05-17

### Ajouté

- **Architecture multi-pays prête** dès V1 : table `countries` avec `is_active` flag
- **Table `referral_codes`** + `referrals` : programme parrainage complet
- **Table `reviews`** + `review_helpfulness` : système notation
- **Vue matérialisée `product_ratings`** : ratings agrégés pour SEO
- **Table `product_documents`** : rapports SGS, certificats (auth gated)
- **Table `callback_requests`** : demandes rappel commercial avec créneaux
- **Table `claims`** : SAV avec 4 types (48h vices apparents / 14j non-conformité / 2 ans vices cachés)
- **Auto-ouverture containers** : 3 modes (manual/semi_auto/full_auto) configurables
- **Section 18 protection juridique** : 10 articles CGV blindés B2B
- **Tableau comparatif générique** Container Club vs concurrents (sans noms)
- **Tables unifiées** : variantes multi-axes (config plateau + finition pied)
- **Variante spéciale "pied seul"** : -30% via `product_variant_combinations`
- 25 templates emails (vs 20 initialement)
- 8 Edge Functions (vs 6)
- 9 migrations SQL versionnées

### Modifié

- `cost_fob_eur` → `cost_landed_port_eur` (prix usine inclut transport jusqu'au port FR)
- Catégories produits réduites : chair, armchair, table, bench, accessory
- Tiers de marge INCRÉMENTAUX (méthode anti-profit-leakage)

### Décisions clés

- Marges dégressives : 35% (0-0.8m³) / 32% (0.8-2) / 30% (2-4) / 27% (4-8) / 25% (8+)
- MOQ : 50 unités chaises, 20 unités tables
- Frais réservation : 3% HT min 150€ max 500€
- Acompte 27% à 80% remplissage + 3 séries
- Solde 70% avant expédition usine

---

## [1.0.0] — 2026-05-15

### Initial

- Brief initial Container Club (28kb)
- Vision B2B pré-commande groupée mobilier outdoor
- Modèle économique de base
- Schéma SQL initial Supabase
- Spec UI/UX home + checkout
- Stack TanStack Start v1 + Supabase + Stripe + Resend + R3F

---

## 🔗 Format des entrées

Chaque version doit contenir :

- **Date** : YYYY-MM-DD
- **Ajouté** : nouvelles features
- **Modifié** : changements de comportement
- **Supprimé** : features retirées
- **Corrigé** : bugfixes
- **Sécurité** : patches sécurité
- **Décisions clés** : choix stratégiques

## 📌 Versionning

Format SemVer :

- **MAJEUR** : breaking changes schéma DB ou API publique
- **MINEUR** : nouvelles features rétro-compatibles
- **PATCH** : corrections, ajustements

## ⚠️ Migration notes

Si un changement nécessite une migration manuelle ou affecte des données existantes, le noter explicitement avec ⚠️ MIGRATION REQUISE.

Aucune migration manuelle requise à ce jour.
