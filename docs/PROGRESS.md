# 📊 Container Club — État du projet

> Fichier mis à jour automatiquement par Claude Code après chaque tâche.
> Lecture obligatoire en début de session.
> Dernière mise à jour : [auto via Git]

## 🎯 État global

**Phase actuelle** : Phase 1 (Foundations + Sécurité)
**Démarrage projet** : 2026-05-17
**Cible launch beta** : Semaine 10+
**Première session Claude Code** : 2026-05-17 — Session 0 initialisation

### Légende
- ✅ Terminé et testé
- 🔄 En cours
- ⏳ Démarrage prévu
- ❌ Pas commencé
- 🚨 Bloqué (voir KNOWN_ISSUES.md)

---

## Phase 1 — Foundations + Sécurité (semaines 1-2)

### 1.1 Setup projet
- ✅ Initialisation TanStack React Start + Vite
- ✅ Configuration TypeScript strict
- ✅ Configuration Tailwind + palette CSS (section 15.1)
- ✅ Infrastructure shadcn/ui minimale (`Button`, `cn`, `components.json`)
- ✅ Installation dépendances principales
- ✅ Configuration ESLint + Prettier
- ✅ Pre-commit hooks (husky + gitleaks si installé)
- ✅ Configuration Vitest
- ✅ Configuration Playwright

### 1.2 Supabase
- ❌ Création projet Supabase EU
- ❌ Migration `0001_init_schema.sql` (schéma complet section 5.1)
- ❌ Migration `0002_pricing_config.sql` (seed app_config)
- ❌ Migration `0003_realtime_setup.sql`
- ❌ Migration `0004_referrals.sql`
- ❌ Migration `0005_reviews.sql`
- ❌ Migration `0006_callbacks.sql`
- ❌ Migration `0007_documents.sql`
- ❌ Migration `0008_claims_sav.sql`
- ❌ Migration `0009_audit_log.sql`
- 🔄 Migration `0010_security_events.sql` (V1.3, fondation incluse)
- ✅ Migration `siret_cache.sql` (cache INSEE 7 jours)
- ✅ Migration `reservation_foundation.sql` (reservations + reservation_items)
- ❌ Seed data complet (10 produits, 5 carrier_partners, 1 container, etc.)
- ❌ RLS testée sur toutes tables sensibles
- ❌ Triggers actifs (MOQ, fidélité)
- ❌ Realtime activé sur 4 tables critiques

### 1.3 Tiers externes
- ❌ Compte Stripe (test) — Radar + 3DS2 activés
- ❌ Compte Resend — domaine vérifié
- ❌ Compte API INSEE Sirene — OAuth client_id/secret
- ❌ Compte Cloudflare — Worker + WAF rules

### 1.4 Logique métier (src/lib/)
- ✅ `pricing/tiers.ts` + tests
- ✅ `pricing/reservation-fee.ts` + tests
- ✅ `pricing/moq.ts` + tests
- ✅ `pricing/loyalty.ts` + tests
- ✅ `pricing/aggregation.ts` + tests
- ✅ `pricing/referral.ts` + tests
- ✅ `container/fill-calculator.ts` + tests
- ✅ `container/status.ts` + tests
- ✅ `container/auto-open.ts` + tests
- ✅ `claims/sav.ts` + tests
- ✅ `validation/siret.ts` + tests (algo Luhn + checksum)
- ✅ `validation/email.ts` + tests (détection domaines personnels)
- ✅ `validation/schemas.ts` (Zod schemas checkout/callback)

### 1.5 Sécurité
- 🔄 Edge Function `verify-siret` avec cache + rate limit (scaffold serveur)
- ✅ Composant `SiretInput` + validation temps réel
- ✅ Composant `SiretVerificationDisplay`
- ✅ Composant `EmailDomainWarning`
- ✅ Composant `ValidatedInput` générique
- ✅ Headers HTTP sécurisés (helpers Cloudflare/Vinxi prêts)
- ✅ CSP testée sans bloquer Stripe/Plausible/Supabase
- ✅ Helper `security_events` + traçage magic link/rate limit
- ❌ Rate limiting Cloudflare WAF configuré
- ❌ Bot Fight Mode activé
- ❌ OWASP Core Rule Set activé
- 🔄 Suite tests sécurité (`tests/security/`)
- ❌ Validation score A sur securityheaders.com

### 1.6 Authentification
- ✅ Setup Supabase Auth magic link (scaffold local, env à renseigner)
- ✅ Page `/auth/login` avec rate limiting applicatif local
- ✅ Page `/auth/callback`
- ✅ Hook `useAuth`
- ✅ Helpers `src/lib/supabase/{client,server,types}.ts`

### 🎯 DoD Phase 1
- ⏳ `npm test` 100% green (tous tests métier + sécurité)
- ⏳ `npm run typecheck` 0 erreur
- 🔄 Supabase migrations fondation Auth/RLS créées (CLI local à installer pour exécution)
- ⏳ Vérification SIRET fonctionne (testée avec 3+ SIRET réels)
- ⏳ Login magic link fonctionne en local
- ⏳ Headers sécurité validés (score A min)
- ⏳ Pre-commit hook bloque secrets

---

## Phase 2 — Catalogue & Réservation (semaines 3-4)

### 2.1 Page d'accueil
- 🔄 Layout (Header sticky, Footer, Mobile sticky bar Lovable intégré)
- 🔄 Section Hero Lovable intégrée
- ✅ ValueProps (3 piliers)
- 🔄 ProcessTimeline / HowItWorks Lovable intégré
- ✅ ComparisonTable (Container Club vs concurrents)
- 🔄 Catalogue Lovable (filtres + tri + rows) intégré avec données mock
- ✅ Page `/catalogue` dense type order sheet
- ✅ Page `/stock-24h` pour lots disponibles rapidement
- ✅ Demandes stock 24h persistables (Supabase + fallback local admin)
- ✅ Bloc livraison rendue port aligné V1.3 (transport post-port côté client)
- 🔄 PastContainersGrid Lovable intégré
- 🔄 FaqAccordion Lovable intégré
- ✅ CTA final

### 2.2 Catalogue produits
- 🔄 ProductRow (desktop Lovable intégré, données mock)
- ✅ ProductCard (mobile)
- ✅ VariantSelector
- 🔄 TableConfigurator (multi-axes plateau + pied, UI détail produit)
- ✅ QuantityStepper
- ✅ MoqProgressBar
- 🔄 ProductDetailDialog Lovable intégré
- 🔄 ProductGallery (sélection visuels + état fournisseur à compléter)
- 🔄 ProductDocumentsList (documents visibles + états verrouillés auth)
- 🔄 ProductReviews (résumé + avis vérifiés mock avant Supabase)

### 2.3 Visualisation container
- 🔄 ContainerScene3D (R3F Lovable intégré, packing piles/cartons)
- 🔄 ContainerScene3DFallback (fallback 2D logistique)
- 🔄 ContainerFillBar
- 🔄 ContainerStatusBadge
- 🔄 SeriesProgressIndicator
- 🔄 ParticipantsCount (anonymisé)

### 2.4 Panier
- 🔄 OrderSidebar (desktop Lovable intégré)
- 🔄 MobileStickyCart Lovable intégré
- 🔄 OrderSummary Lovable intégré
- 🔄 PricingBreakdown Lovable intégré
- 🔄 TieredPricingViz (remises quantité client 2/6/10%)
- ✅ DeliveryInfoBox (home + rappel compact panier)
- 🔄 Store Zustand `cart.store.ts` (panier partagé home/catalogue)

### 2.5 Réservation
- 🔄 ReservationDialog Lovable intégré (4 étapes V1.3 + écran confirmation, Stripe serveur à connecter)
- 🔄 Étape 1 : SIRET + validation format, vérification INSEE Edge Function raccordée
- ✅ Étape 2 : Contact + EmailDomainWarning
- ✅ Étape 3 : DeliveryModeSelector
- 🔄 Étape 4 : Paiement Stripe placeholder, Payment Element à connecter
- ✅ CgvAcceptance obligatoire
- ✅ Code parrainage si applicable (mock V1 + remise frais réservation)
- ✅ Draft réservation serveur (recalcul, snapshots prix/produits, payload Supabase)
- ✅ Historique local des réservations créé au checkout et visible dans `/account/reservations`
- ❌ Email confirmation envoyé
- ❌ Génération devis PDF
- ❌ Tests E2E Playwright parcours complet

### 🎯 DoD Phase 2
- ⏳ Parcours invité → réservation payée fonctionne end-to-end
- ⏳ Pricing dégressif visible et exact
- 🔄 Vérification SIRET intégrée au checkout
- ⏳ MOQ live affiché
- ⏳ Mobile testé 3 devices réels
- ⏳ Lighthouse mobile ≥ 80 sur home

---

## Phase 3 — Temps réel & Visibilité (semaine 5)

### 3.1 Realtime
- ❌ Hook `useContainerRealtime`
- ❌ Toasts anonymisés rate-limited
- ❌ Animations fluides progress bar
- ❌ Animations 3D apparition nouveaux blocs

### 3.2 Pages publiques
- ❌ `/containers/[ref]` détail container
- ❌ `/containers/historique`
- ❌ `/transport-partenaires`

### 3.3 SEO/GEO/LLM
- ❌ Schema.org JSON-LD toutes pages
- ❌ Sitemap dynamique `/sitemap.xml`
- ❌ Fichier `llms.txt` racine
- ❌ Métadonnées dynamiques par page
- ❌ OpenGraph + Twitter Cards

### 🎯 DoD Phase 3
- ⏳ Realtime fonctionne (test multi-onglets)
- ⏳ Toasts pas de spam
- ⏳ Pages SEO indexables
- ⏳ Lighthouse SEO 100

---

## Phase 4 — Espace client (semaine 6)

- ❌ `/account` dashboard
- ✅ `/account/reservations` (aperçu local, prêt Supabase)
- ✅ `/account/reservations/$id` (détail réservation + lignes)
- ❌ `/account/invoices` (PDF)
- ❌ `/account/documents` (rapports SGS, auth gated)
- ❌ `/account/referrals` (programme parrainage)
- ❌ `/account/reviews`
- ❌ `/account/claims` (SAV)
- ❌ `/account/settings` (profil + RGPD)
- ❌ Bottom nav mobile espace client

### 🎯 DoD Phase 4
- ⏳ Tous écrans client fonctionnels
- ⏳ Parrainage : flow complet testé
- ⏳ Documents qualité accessibles auth-only
- ⏳ Reviews : invitation 30j + soumission

---

## Phase 5 — Admin (semaine 7)

- 🔄 Layout admin + auth + role (aperçu local, RLS admin préparée)
- ✅ `/admin` dashboard KPI
- ❌ `/admin/containers`
- 🔄 `/admin/products` (vue stock/catalogue locale)
- 🔄 `/admin/reservations` (vue réservations locale)
- ✅ `/admin/stock-requests` (onglet demandes stock dans `/admin`)
- ❌ `/admin/companies`
- ❌ `/admin/pricing`
- ❌ `/admin/carriers`
- ❌ `/admin/delivery-history`
- ❌ `/admin/callbacks`
- ❌ `/admin/reviews`
- ❌ `/admin/claims`
- ❌ `/admin/countries`
- ❌ `/admin/reports`
- ❌ 2FA TOTP admin

### 🎯 DoD Phase 5
- ⏳ Tous écrans admin fonctionnels
- ⏳ Tests autorisation (buyer ne peut pas accéder)
- ⏳ 2FA TOTP testé
- ⏳ Exports CSV fonctionnels

---

## Phase 6 — Automatisations (semaine 8)

- ❌ Edge Function `check-container-fill` (cron quotidien)
- ❌ Edge Function `process-deposit-call`
- ❌ Edge Function `process-balance-call`
- ❌ Edge Function `process-overdue-reservations`
- ❌ Edge Function `auto-open-container` (3 modes)
- ❌ Edge Function `send-milestone-emails`
- ❌ Edge Function `refresh-product-ratings`
- ❌ Edge Function `generate-pdf`
- ❌ Edge Function `recheck-pending-sirets`
- ❌ 25 templates emails React Email
- ❌ Webhooks Stripe complets
- ❌ Webhooks Resend (bounce tracking)

### 🎯 DoD Phase 6
- ⏳ Tous crons configurés et testés
- ⏳ Workflow complet automatisable
- ⏳ Emails partent aux bons moments

---

## Phase 7 — Pages secondaires & polish (semaine 9)

- ❌ `/comment-ca-marche`
- ❌ `/faq` (recherchable)
- ❌ `/conditions/cgv` (validation avocat)
- ❌ `/conditions/remboursement`
- ❌ `/conditions/confidentialite`
- ❌ `/conditions/mentions-legales`
- ❌ `/contact`
- ❌ Optimisations performance finales
- ❌ Audit accessibilité axe-core
- ❌ Tests cross-browser
- ❌ Tests mobile réels (iPhone + Android)
- ❌ Sentry configuré et testé

### 🎯 DoD Phase 7
- ⏳ Toutes pages publiques live
- ⏳ Lighthouse ≥ 85 mobile / ≥ 90 desktop
- ⏳ 0 erreur axe-core critique
- ⏳ Documentation `README.md` + `docs/`

---

## Phase 8 — Beta privée & launch (semaine 10+)

- ❌ Beta 5-10 pros réseau Terrassea
- ❌ Premier container CC-2026-001 créé
- ❌ Photos produits réelles intégrées
- ❌ 5 transporteurs partenaires : tarifs récupérés
- ❌ Monitoring intensif
- ❌ Newsletter lancement
- ❌ Préparation campagne LinkedIn

### 🎯 DoD Phase 8
- ⏳ Beta validée
- ⏳ Premier container clôturé avec succès
- ⏳ Process opérationnel maîtrisé

---

## 📝 Journal des sessions Claude Code

> Mise à jour automatique à chaque session.
> Format : Date — Phase — Tâches accomplies — Tokens estimés

### Session du 2026-05-17
- Phase : Session 0 — Initialisation projet
- Tâches : starter importé, structure TanStack React Start créée, configs TypeScript/Tailwind/ESLint/Prettier/Vitest/Playwright ajoutées, dépendances installées, hooks Husky configurés, pricing tiers implémenté.
- Phase : Phase 2 — Catalogue & Réservation
- Tâches : design Lovable intégré, page catalogue branchée, flux de réservation V1.3 en 4 étapes ajouté (SIRET, contact, livraison, paiement placeholder), textes livraison alignés rendu port.
- Phase : Phase 2 — Page d'accueil
- Tâches : ValueProps, ComparisonTable, bloc livraison rendu port et CTA final ajoutés dans le design Lovable.
- Phase : Phase 2 — Catalogue mobile
- Tâches : ProductCard mobile ajoutée, filtres catalogue rendus scrollables mobile, QuantityStepper et MoqProgressBar factorisés et partagés avec ProductRow.
- Phase : Phase 2 — Optimisation catalogue
- Tâches : rendu responsive unique ProductCard/ProductRow, recherche différée, compteurs par catégorie précalculés, pagination "charger plus" pour catalogues 100+ références.
- Phase : Phase 2 — Build/catalogue
- Tâches : ProductDetailDialog, ReservationDialog et ContainerScene chargés en lazy chunks ; chunk panier initial réduit fortement, 3D isolée.
- Phase : Phase 2 — Visualisation container
- Tâches : packing 3D corrigé avec unités logistiques ; chaises groupées en piles de 10, 4 piles sur la largeur, placement global adaptatif tables/chaises, tables autorisées au-dessus des piles de chaises mais jamais en dessous.
- Phase : Phase 2 — Stock 24h
- Tâches : route `/stock-24h` ajoutée avec lots disponibles sous 24h, filtres, tri, KPIs, demande rapide et teaser home.
- Phase : Phase 2 — Demandes stock 24h
- Tâches : demandes stock 24h validées, sauvegardées localement en fallback, payload Supabase `stock_requests` et migration RLS ajoutés.
- Phase : Phase 5 — Admin minimal
- Tâches : route `/admin` ajoutée avec KPIs, onglets demandes stock, réservations et produits/stock ; lecture des demandes locales issues de `/stock-24h`.
- Phase : Phase 2 — Réservation
- Tâches : écran de confirmation post-checkout ajouté, historique local des drafts de réservation conservé et fusionné dans l'espace compte.
- Phase : Phase 2 — Performance catalogue
- Tâches : rendu des longues listes optimisé avec `content-visibility` et décodage image asynchrone sur cartes/lignes catalogue et stock.
- Phase : Phase 4 — Espace client
- Tâches : routes `/account/reservations` et `/account/reservations/$id` ajoutées avec KPIs, liste, détail, paiements/documents placeholders et données locales remplaçables par Supabase.
- Phase : Phase 2 — Catalogue dédié
- Tâches : route `/catalogue` ajoutée, vue lignes compactes, page size 30/60/90, navigation home vers catalogue complet.
- Phase : Phase 2 — Configurateur table
- Tâches : TableConfigurator ajouté dans ProductDetailDialog avec format plateau, couleur plateau, finition pied et prix indicatif par configuration.
- Phase : Phase 2 — Galerie produit
- Tâches : ProductGallery ajouté dans ProductDetailDialog avec sélection de visuels, navigation, compteur et état à compléter pour fournisseurs sans galerie.
- Phase : Phase 2 — Règles quantité
- Tâches : règle métier chaises centralisée : minimum 50 unités puis incrément par packs de 10 dans catalogue, accueil et fiche produit.
- Phase : Phase 2 — Documents produit
- Tâches : ProductDocumentsList ajouté dans ProductDetailDialog avec fiche technique, documents conformité/garantie/qualité et états verrouillés en attente auth.
- Phase : Phase 2 — Avis produit
- Tâches : ProductReviews ajouté dans ProductDetailDialog avec résumé ratings, sous-notes qualité/valeur/délais et avis vérifiés simulés par catégorie.
- Phase : Phase 2 — Visualisation container
- Tâches : métriques container factorisées : statut, remplissage avec seuil 80%, séries, participants anonymisés et fallback 2D derrière la scène 3D.
- Phase : Phase 2 — Panier
- Tâches : TieredPricingViz ajouté dans OrderSidebar avec remise quantité client, seuil actif et prochain seuil d'unités.
- Phase : Phase 2 — Panier partagé
- Tâches : store Zustand `cart.store.ts` ajouté avec quantités, variantes, snapshot panier/totaux/remplissage et branchement home + catalogue.
- Phase : Phase 2 — Livraison panier
- Tâches : DeliveryInfoBox décliné en variante compacte dans OrderSidebar pour rappeler prix rendu port, enlèvement libre et transporteurs recommandés.
- Fichiers créés : app `src/`, tests, configs racine, workflow CI, placeholders Supabase/public, lockfile npm.
- Tests : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` validés pendant la session.
- Notes : migration de compatibilité vers `@tanstack/react-start` + Vite et dépendances React 19 documentée dans `docs/DECISIONS.md`.

### Session du 2026-05-17 — suite Phase 1.4
- Phase : Phase 1 — Logique métier pure
- Tâches : frais de réservation, statut MOQ, validation email perso et validation SIRET offline ajoutés.
- Fichiers créés : `src/lib/pricing/reservation-fee.ts`, `src/lib/pricing/moq.ts`, `src/lib/validation/email.ts`, `src/lib/validation/siret.ts` et tests associés.
- Tests : validation en cours sur typecheck, lint, Vitest et build.
- Notes : les migrations Supabase restent non démarrées car elles modifient le schéma DB.

### Session du 2026-05-17 — intégration design Lovable
- Phase : Phase 2 — Home/catalogue visuel
- Tâches : design Lovable importé dans l'app locale, home catalogue remplacée, composants Header/Hero/HowItWorks/ProductRow/OrderSidebar/ContainerScene/FAQ/Footer/ReservationDialog intégrés.
- Fichiers créés/modifiés : `src/components/`, `src/routes/index.tsx`, `src/lib/products.ts`, `src/lib/order.ts`, `src/lib/quote.ts`, thème Tailwind/CSS et dépendances UI.
- Tests : typecheck, lint, Vitest, build et vérification navigateur local validés.
- Notes : les composants Lovable utilisent encore des données mock et un flow réservation 2 étapes ; il faudra aligner avec le checkout V1.3 SIRET obligatoire en 4 étapes.

---

## 🔗 Liens rapides

- Brief technique complet : `CONTAINER_CLUB_SPEC.md`
- Changelog versions spec : `CHANGELOG.md`
- Décisions techniques : `DECISIONS.md`
- Bugs connus : `KNOWN_ISSUES.md`
- Commandes utiles : `SCRIPTS.md`
- Templates de prompts : `PROMPTS.md`
- Contexte Claude Code : `.claude/context.md`
