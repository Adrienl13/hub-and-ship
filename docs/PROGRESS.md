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
- ❌ Migration `0010_security_events.sql` (V1.3)
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
- ❌ `pricing/reservation-fee.ts` + tests
- ❌ `pricing/moq.ts` + tests
- ❌ `pricing/loyalty.ts` + tests
- ❌ `pricing/aggregation.ts` + tests
- ❌ `pricing/referral.ts` + tests
- ❌ `container/fill-calculator.ts` + tests
- ❌ `container/status.ts` + tests
- ❌ `container/auto-open.ts` + tests
- ❌ `claims/sav.ts` + tests
- ❌ `validation/siret.ts` + tests (algo Luhn + checksum)
- ❌ `validation/email.ts` + tests (détection domaines personnels)
- ❌ `validation/schemas.ts` (Zod schemas tous inputs API)

### 1.5 Sécurité
- ❌ Edge Function `verify-siret` avec cache + rate limit
- ❌ Composant `SiretInput` + validation temps réel
- ❌ Composant `SiretVerificationDisplay`
- ❌ Composant `EmailDomainWarning`
- ❌ Composant `ValidatedInput` générique
- ❌ Headers HTTP sécurisés (Cloudflare Worker middleware)
- ❌ CSP testée sans bloquer Stripe/Plausible/Supabase
- ❌ Rate limiting Cloudflare WAF configuré
- ❌ Bot Fight Mode activé
- ❌ OWASP Core Rule Set activé
- ❌ Suite tests sécurité (`tests/security/`)
- ❌ Validation score A sur securityheaders.com

### 1.6 Authentification
- ❌ Setup Supabase Auth magic link
- ❌ Page `/auth/login` avec rate limiting
- ❌ Page `/auth/callback`
- ❌ Hook `useAuth`
- ❌ Helpers `src/lib/supabase/{client,server,types}.ts`

### 🎯 DoD Phase 1
- ⏳ `npm test` 100% green (tous tests métier + sécurité)
- ⏳ `npm run typecheck` 0 erreur
- ⏳ Supabase migrations s'exécutent sans erreur
- ⏳ Vérification SIRET fonctionne (testée avec 3+ SIRET réels)
- ⏳ Login magic link fonctionne en local
- ⏳ Headers sécurité validés (score A min)
- ⏳ Pre-commit hook bloque secrets

---

## Phase 2 — Catalogue & Réservation (semaines 3-4)

### 2.1 Page d'accueil
- ❌ Layout (Header sticky, Footer, MobileNav)
- ❌ Section Hero
- ❌ ValueProps (3 piliers)
- ❌ ProcessTimeline (5 étapes)
- ❌ ComparisonTable (Container Club vs concurrents)
- ❌ Catalogue (filtres + tri + grid)
- ❌ Bloc livraison rendue port
- ❌ PastContainersGrid
- ❌ FaqAccordion (5 questions)
- ❌ CTA final

### 2.2 Catalogue produits
- ❌ ProductRow (desktop)
- ❌ ProductCard (mobile)
- ❌ VariantSelector
- ❌ TableConfigurator (multi-axes plateau + pied)
- ❌ QuantityStepper
- ❌ MoqProgressBar
- ❌ ProductDetailDialog
- ❌ ProductGallery
- ❌ ProductDocumentsList (auth gated)
- ❌ ProductReviews

### 2.3 Visualisation container
- ❌ ContainerScene3D (R3F)
- ❌ ContainerScene3DFallback (image statique)
- ❌ ContainerFillBar
- ❌ ContainerStatusBadge
- ❌ SeriesProgressIndicator
- ❌ ParticipantsCount (anonymisé)

### 2.4 Panier
- ❌ OrderSidebar (desktop)
- ❌ MobileStickyCart
- ❌ OrderSummary
- ❌ PricingBreakdown
- ❌ TieredPricingViz
- ❌ DeliveryInfoBox
- ❌ Store Zustand `cart.store.ts`

### 2.5 Réservation
- ❌ ReservationDialog (4 étapes)
- ❌ Étape 1 : SIRET + vérification INSEE
- ❌ Étape 2 : Contact + EmailDomainWarning
- ❌ Étape 3 : DeliveryModeSelector
- ❌ Étape 4 : Paiement Stripe Payment Element
- ❌ CgvAcceptance obligatoire
- ❌ Code parrainage si applicable
- ❌ Email confirmation envoyé
- ❌ Génération devis PDF
- ❌ Tests E2E Playwright parcours complet

### 🎯 DoD Phase 2
- ⏳ Parcours invité → réservation payée fonctionne end-to-end
- ⏳ Pricing dégressif visible et exact
- ⏳ Vérification SIRET intégrée au checkout
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
- ❌ `/account/reservations`
- ❌ `/account/reservations/$id`
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

- ❌ Layout admin + auth + role
- ❌ `/admin` dashboard KPI
- ❌ `/admin/containers`
- ❌ `/admin/products`
- ❌ `/admin/reservations`
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
- Fichiers créés : app `src/`, tests, configs racine, workflow CI, placeholders Supabase/public, lockfile npm.
- Tests : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` validés pendant la session.
- Notes : migration de compatibilité vers `@tanstack/react-start` + Vite et dépendances React 19 documentée dans `docs/DECISIONS.md`.

---

## 🔗 Liens rapides

- Brief technique complet : `CONTAINER_CLUB_SPEC.md`
- Changelog versions spec : `CHANGELOG.md`
- Décisions techniques : `DECISIONS.md`
- Bugs connus : `KNOWN_ISSUES.md`
- Commandes utiles : `SCRIPTS.md`
- Templates de prompts : `PROMPTS.md`
- Contexte Claude Code : `.claude/context.md`
