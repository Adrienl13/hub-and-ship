# 🚢 CONTAINER CLUB — Spécification Technique Complète v1.3

> Document de référence unique pour Claude Code.
> Version 1.3 — Mai 2026

---

## 📝 CHANGELOG v1.2 → v1.3

**Décisions stratégiques** :

1. **SIRET obligatoire** lors de toute demande de devis, paiement, ou callback (validation API INSEE Sirene)
2. **Sécurité B2B blindée** : nouvelle section dédiée 18.bis avec implémentation détaillée
3. **Anti-fraude** sur parrainage, MOQ, reviews, card testing
4. **Emails personnels tolérés** avec warning (gmail/yahoo OK avec message)
5. **SIRET cessé/inactif = blocage strict** de création de compte
6. **Stripe Radar + 3DS2** activés systématiquement
7. **Rate limiting** : Cloudflare WAF en V1 (gratuit), architecture prête Upstash

### Modifications de cette version

1. **Nouvelle Edge Function** : `verify-siret` (proxy API INSEE Sirene avec cache)
2. **Modifications table `companies`** : ajout `siret_verified`, `naf_code`, `legal_form`, `creation_date`, `is_active_company`, `risk_flag`, etc.
3. **Contrainte unicité SIRET** : 1 SIRET = 1 compte (anti-spam)
4. **Nouvelle table** : `security_events` (tracking tentatives, audit sécurité)
5. **Nouvelle section 18.bis** : Sécurité B2B (~600 lignes, OWASP 2025, anti-fraude, rate limiting, headers)
6. **Modification flow checkout** : étape SIRET obligatoire avant paiement
7. **Composants nouveaux** : `SiretInput`, `SiretVerificationDisplay`, `EmailDomainWarning`, `SecurityHeaders`
8. **Variables env** : ajout `INSEE_API_KEY`, blocklist emails
9. **Phase 1 enrichie** : intégration vérif SIRET dans les fondations
10. **Checklist pré-launch** : nouvelle section sécurité avec scans SAST/SCA/DAST automatisés

### Sections impactées

- Section 4.3 (variables env) → ajout clés INSEE
- Section 5.1 (schéma SQL) → modifs companies + nouvelle table security_events
- Section 6 (logique métier) → nouvelle sous-section validation SIRET
- Section 7.1 (home) → bandeau email professionnel
- Section 16.7 (checkout) → étape SIRET obligatoire
- Section 18 (juridique) → CGV mises à jour avec exigence SIRET
- **Section 18.bis (NOUVELLE)** : Sécurité B2B complète
- Section 21 (seed) → exemples sociétés vérifiées via SIRET
- Section 24 (phases) → Phase 1 enrichie, nouvelle Phase sécurité

**Tout le reste du document v1.2 reste inchangé.**

---

> Intègre : multi-pays prêt, protection juridique B2B blindée, temps réel, parrainage, reviews, callback, documents qualité, auto-ouverture configurable, enlèvement port + transporteurs recommandés V1, **SIRET obligatoire + sécurité OWASP 2025 blindée**.

---

## ⚡ INSTRUCTIONS CLAUDE CODE

**Tu vas implémenter Container Club intégralement.** Ce document contient tout ce dont tu as besoin. Lis-le en entier avant d'écrire la première ligne.

**Approche** : tu travailleras par phases (1 à 8, détaillées section 18). Ne saute pas de phase. Valide chaque livrable avant de passer à la suivante.

**Règles absolues** :

- TypeScript strict (jamais `any`)
- Mobile-first absolu (touch targets ≥44px, breakpoints sm/md/lg/xl)
- Tests unitaires Vitest sur toute la logique métier (`src/lib/`)
- Composants découpés (≤300 lignes par fichier, sinon split)
- Accessibilité WCAG AA minimum
- 0 erreur TypeScript, 0 warning React, 0 console.error en dev
- Commits atomiques avec messages clairs

**Ne PAS** :

- Réécrire des composants shadcn existants
- Mettre de la logique métier dans les composants (toujours dans `src/lib/`)
- Exposer côté client les champs admin (`cost_landed_port_eur`, marges)
- Utiliser `dangerouslySetInnerHTML`
- Mocker le pricing — il doit être exact dès la V1

---

## 📋 TABLE DES MATIÈRES

1. Vision & Différenciation
2. Modèle économique
3. Personae & parcours
4. Architecture technique
5. Modèle de données complet
6. Logique métier critique
7. Spécifications par page
8. Système temps réel
9. Documents qualité (rapports SGS)
10. Programme parrainage
11. Système notation
12. Demandes de rappel commercial
13. Auto-ouverture containers
14. Architecture multi-pays
15. Direction artistique
16. Mobile optimisation
17. SEO / GEO / LLM
18. Protection juridique B2B (intégrée)
    18.bis **Sécurité B2B blindée (V1.3)** — OWASP 2025, anti-fraude, rate limiting
19. Intégrations tierces
20. Sécurité & RGPD
21. Données de seed
22. Backend admin
23. Notifications
24. Plan de livraison par phases
25. Checklist pré-launch

---

## 1. VISION & DIFFÉRENCIATION

### 1.1 Pitch

Container Club est une plateforme B2B de pré-commande groupée mensuelle de mobilier outdoor par container maritime 20' HC, réservée aux professionnels. L'importateur officiel (Terrassea SAS) mutualise un container entre 6-12 pros, déclenche la production à 80% de remplissage et 3 séries minimum, livre en 90 jours environ.

### 1.2 Positionnement

**Le prix d'un grossiste pro avec la qualité d'un revendeur premium.**

Pas de communication agressive sur "le moins cher" car les volumes pros ont déjà des grossistes agressifs. Le positionnement est qualité/prix : rapports SGS, certifications M1/M2, garantie 2 ans, SAV France, importateur déclaré, conformité produit assumée.

### 1.3 Concurrents identifiés

- FTS Direct (BrandSource USA) — modèle proche mais membres-only
- Grossistes pro standard (équivalent Métro Pro, Sodema, Vega) — bon prix mais qualité variable
- Revendeurs spécialisés français — bonne qualité mais marges importantes
- Marketplaces sourcing (Alibaba) — pas d'importateur, douane à charge

**Container Club = direct usine + importateur officiel + qualité garantie + livraison France.**

### 1.4 Modèle de revenus

Marge brute moyenne ~30% sur le HT, calibrée via tiers dégressifs (25-35% selon volume client). Frais de réservation 3% (min 150€, max 500€) sécurisent le BFR et financent les frais fixes container.

---

## 2. MODÈLE ÉCONOMIQUE

### 2.1 Structure des prix

**Coût rendu port FR** (champ admin `cost_landed_port_eur`) :
Le prix usine inclut le transport jusqu'au port français (Le Havre ou Fos-sur-Mer). Donc tu n'ajoutes pas de fret par produit, juste la mutualisation des frais douane + commissionnaire au niveau container.

**Prix de vente HT affiché client** :

```
prix_vente_ht = cost_landed_port × (1 + marge_appliquée) + eco_contribution_unitaire
```

La marge dépend du volume CBM cumulé du client sur le container (tier dégressif).

### 2.2 Tiers de marge dégressive

Méthode **incrémentale** (pas all-units) pour éviter le profit leakage et le fractionnement de commandes :

| Tranche CBM cumulée | Marge appliquée | Justification                     |
| ------------------- | --------------- | --------------------------------- |
| 0,00 — 0,80 m³      | **35%**         | Petite commande, protège ta marge |
| 0,80 — 2,00 m³      | **32%**         | Engagement moyen                  |
| 2,00 — 4,00 m³      | **30%**         | MOQ solo atteint                  |
| 4,00 — 8,00 m³      | **27%**         | Gros engagement                   |
| 8,00 m³ et +        | **25%**         | Très gros (revendeur, chaîne)     |

**Stockés dans `app_config.pricing_tiers`** (modifiables sans redéploiement).

**Communication client** : on n'affiche jamais "marge". On affiche le **prix unitaire moyen qui décroît** + une **barre "économies débloquées"** qui se remplit.

**Anti-fractionnement** : agrégation automatique des réservations du même `company_id` sur le **même container**. Si un client a déjà une réservation `reserved`, sa nouvelle commande cumule le CBM pour recalculer le tier.

### 2.3 Frais de réservation

- **3% du HT, min 150€, max 500€**, non remboursables sauf cas listés section 18
- Prélevés à la réservation via Stripe Payment Intent
- Constituent la première fraction de l'acompte 30%

### 2.4 Acompte et solde

- **À 80% remplissage + 3 séries MOQ atteintes** : appel acompte 27% (= 30% total - 3% frais déjà payés)
- **Avant expédition usine** (après contrôle qualité SGS) : solde 70%
- Stripe Payment Link envoyé par email pour chacun, paiement carte ou SEPA

### 2.5 Éco-contribution

- Conforme loi AGEC (Eco-mobilier)
- Incluse dans le prix HT affiché (champ `eco_contribution` par produit)
- Détaillée séparément sur facture et devis (mention obligatoire)
- Barème typique :
  - Chaise/fauteuil <5kg : 0,30€
  - Chaise/fauteuil 5-10kg : 0,50€
  - Fauteuil >10kg : 1,00€
  - Petite table <10kg : 0,80€
  - Table moyenne 10-30kg : 2,00€
  - Grande table >30kg : 5,00€
  - Banc : 1,50€

### 2.6 Livraison post-port — V1 : enlèvement libre + transporteurs recommandés

**Décision stratégique V1** : Container Club ne facture pas la livraison du port jusqu'au client final. Le prix produit s'arrête au port d'arrivée (Le Havre ou Marseille-Fos pour la France).

**Pourquoi ce choix** :

- Pas de partenariats transporteurs signés au lancement
- Délai de 60 jours entre réservation et arrivée port rend impossible un devis fiable à T0 (les tarifs transporteurs sont valables 7-30 jours max)
- Beaucoup de pros B2B préfèrent gérer leur transport (déjà des partenaires habituels, contrôle des créneaux et conditions)
- Modèle plus transparent : pas de marges cachées sur le transport

**3 modes de livraison proposés au checkout** (choix obligatoire) :

1. **`pickup_at_port`** — Enlèvement libre au port (gratuit)
   Le client vient avec son transporteur récupérer la marchandise au port.

2. **`partner_carrier_needed`** — Le client souhaite être mis en relation
   Container Club lui fournit (par email post-livraison) la liste des transporteurs recommandés avec tarifs indicatifs et contacts.

3. **`self_arranged`** — Le client a déjà son transporteur
   Aucune action de Container Club, juste communication de la date d'arrivée au port et coordonnées.

**Aucune facturation transport** en V1. Le client paie le transporteur directement.

### 2.7 Liste des transporteurs recommandés (V1)

Table `carrier_partners` peuplée avec 4-6 transporteurs présélectionnés sans contrat ni engagement :

- Geodis Distribution Palette
- Heppner
- Mauffrey
- Dachser
- DPD France (Geopost)
- Upela (comparateur multi-transporteurs)

Pour chacun, Container Club affiche :

- Nom, logo, description
- Zones couvertes (national, régional, international)
- Fourchettes de prix indicatives par zone (sans engagement)
- Délais moyens
- Lien direct vers devis en ligne ou contact téléphonique
- Notes spécifiques ("Mentionnez Container Club pour suivi prioritaire" si applicable)

Page dédiée `/transport-partenaires` (publique, SEO friendly).

### 2.8 Évolution future (V2, post-30 livraisons)

Table `delivery_history` préparée dès la V1 (vide au démarrage). À chaque livraison :

- Admin enregistre manuellement le coût réel facturé par le transporteur
- Date, zone, distance, volume, transporteur utilisé, prix payé par le client

Dans 6-12 mois, avec 30-50 livraisons d'historique, possibilité d'activer un **estimateur dynamique** basé sur les vrais coûts moyens par zone et par transporteur, sans dépendre d'API externe. Section visible client : _"Fourchette indicative basée sur nos 30 dernières livraisons sur votre zone : 380-520€"_.

L'introduction de tarifs forfaitaires facturés par Container Club n'interviendra qu'après signature d'un contrat-cadre transporteur (V2 ou V3).

### 2.9 Programme fidélité

Remise automatique selon containers livrés au même `company_id` :

| Containers livrés | Remise sur HT |
| ----------------- | ------------- |
| 2                 | -2%           |
| 3-4               | -3%           |
| 5-9               | -4%           |
| 10+               | -5%           |

Cumulable avec tiers dégressifs, appliquée sur `total_ht` avant TVA.

---

## 3. PERSONAE & PARCOURS

### 3.1 Personae cibles

- **Sophie** — gérante hôtel 4\* — desktop bureau + mobile inspections
- **Marc** — paysagiste indépendant — mobile prédominant (terrain)
- **Antoine** — gérant restaurant plage — équilibré
- **Camille** — acheteuse chaîne campings — desktop majoritaire
- **Pierre** — revendeur B2B local — volume très important, mix devices

### 3.2 Parcours principal (happy path)

```
T0     : Découverte (LinkedIn, SEO, bouche-à-oreille Terrassea)
T+5min : Configure son panier sans compte, voit ses économies temps réel
T+10min: Clic "Réserver", crée compte minimal (email+nom+société), paie frais
T+10min: Email confirmation + devis PDF
T+J  à T+J+30  : Container se remplit, emails milestones (50%, 70%, 80%)
T+J+30 : 80% + 3 séries → appel acompte 27% (lien Stripe par email)
T+J+30 à T+J+75 : Production usine 45j, contrôle SGS, embarquement
T+J+75 : Container embarqué, tracking maritime communiqué
T+J+90 : Arrivée port, appel solde 70%
T+J+95 : Solde payé, livraison programmée
T+J+100: Livré (port ou zone), réception signée
T+J+130: Email témoignage avec code promo 10% prochain container
```

### 3.3 Parcours retour (deuxième commande+)

- Magic link 1 clic depuis email
- Données pré-remplies
- "Recommander à l'identique" sur ancienne commande
- Remise fidélité auto appliquée
- Code parrainage personnel disponible

---

## 4. ARCHITECTURE TECHNIQUE

### 4.1 Stack

**Frontend** : TanStack Start v1 + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + React Three Fiber + Lucide + TanStack Query + Zustand + React Hook Form + Zod

**Backend** : Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) + Stripe + Resend + Cloudflare Workers

**DevOps** : GitHub + Vitest + Playwright + Plausible + Sentry

### 4.2 Structure de fichiers

```
/
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx                    # Home + catalogue
│   │   ├── containers/
│   │   │   ├── $ref.tsx                 # Détail container public
│   │   │   └── historique.tsx           # Historique containers
│   │   ├── comment-ca-marche.tsx
│   │   ├── transport-partenaires.tsx    # Page publique transporteurs (V1.2)
│   │   ├── faq.tsx
│   │   ├── conditions/
│   │   │   ├── cgv.tsx
│   │   │   ├── confidentialite.tsx
│   │   │   ├── mentions-legales.tsx
│   │   │   └── remboursement.tsx
│   │   ├── contact.tsx
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   ├── callback.tsx
│   │   │   └── logout.tsx
│   │   ├── account/
│   │   │   ├── index.tsx
│   │   │   ├── reservations.tsx
│   │   │   ├── reservations.$id.tsx
│   │   │   ├── invoices.tsx
│   │   │   ├── documents.tsx            # Rapports SGS + certifs (clients connectés)
│   │   │   ├── referrals.tsx            # Programme parrainage
│   │   │   ├── reviews.tsx              # Mes avis donnés
│   │   │   ├── claims.tsx               # Mes réclamations SAV
│   │   │   └── settings.tsx
│   │   ├── admin/
│   │   │   ├── index.tsx
│   │   │   ├── containers/
│   │   │   ├── products/
│   │   │   ├── reservations/
│   │   │   ├── companies/
│   │   │   ├── pricing/
│   │   │   ├── carriers/                # Gestion transporteurs recommandés (V1.2)
│   │   │   ├── delivery-history/        # Historique livraisons (alimente V2)
│   │   │   ├── callbacks/               # Demandes de rappel
│   │   │   ├── reviews/                 # Modération avis
│   │   │   ├── claims/                  # Gestion SAV
│   │   │   ├── countries/               # Multi-pays
│   │   │   └── reports/
│   │   └── api/
│   │       ├── webhooks/stripe.ts
│   │       ├── checkout.ts
│   │       ├── callback-requests.ts
│   │       ├── reservations.ts
│   │       └── pdf/{quote,invoice}.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── MobileStickyCart.tsx
│   │   ├── home/
│   │   │   ├── Hero.tsx
│   │   │   ├── ValueProps.tsx
│   │   │   ├── ProcessTimeline.tsx
│   │   │   ├── ComparisonTable.tsx      # Tableau comparatif générique
│   │   │   ├── PastContainersGrid.tsx
│   │   │   └── CtaFinal.tsx
│   │   ├── catalog/
│   │   │   ├── CategoryFilter.tsx
│   │   │   ├── SortDropdown.tsx
│   │   │   ├── ProductRow.tsx           # Desktop
│   │   │   ├── ProductCard.tsx          # Mobile
│   │   │   ├── VariantSelector.tsx
│   │   │   ├── TableConfigurator.tsx    # Plateau + pied combinés
│   │   │   ├── QuantityStepper.tsx
│   │   │   ├── MoqProgressBar.tsx
│   │   │   ├── ProductDetailDialog.tsx
│   │   │   ├── ProductGallery.tsx
│   │   │   ├── ProductDocumentsList.tsx # Docs SGS (auth required)
│   │   │   └── ProductReviews.tsx
│   │   ├── container/
│   │   │   ├── ContainerScene3D.tsx
│   │   │   ├── ContainerScene3DFallback.tsx  # Image statique
│   │   │   ├── ContainerFillBar.tsx
│   │   │   ├── ContainerStatusBadge.tsx
│   │   │   ├── ContainerTimeline.tsx
│   │   │   ├── SeriesProgressIndicator.tsx
│   │   │   ├── RealtimeIndicator.tsx    # Petit dot vivant
│   │   │   └── ParticipantsCount.tsx    # "12 pros engagés"
│   │   ├── cart/
│   │   │   ├── OrderSidebar.tsx
│   │   │   ├── OrderSummary.tsx
│   │   │   ├── PricingBreakdown.tsx
│   │   │   ├── TieredPricingViz.tsx
│   │   │   └── DeliveryInfoBox.tsx     # Encart info livraison rendue port
│   │   ├── delivery/
│   │   │   ├── CarrierPartnersList.tsx  # Liste publique transporteurs
│   │   │   ├── CarrierCard.tsx          # Card unitaire transporteur
│   │   │   └── DeliveryModeSelector.tsx # 3 radio buttons checkout
│   │   ├── reservation/
│   │   │   ├── ReservationDialog.tsx
│   │   │   ├── ReservationForm.tsx
│   │   │   ├── PaymentForm.tsx
│   │   │   ├── CgvAcceptance.tsx        # Case obligatoire CGV
│   │   │   └── ReservationConfirmation.tsx
│   │   ├── validation/                  # V1.3 — Validation entrées
│   │   │   ├── SiretInput.tsx           # Input avec validation temps réel
│   │   │   ├── SiretVerificationDisplay.tsx # Affichage résultat INSEE
│   │   │   ├── EmailDomainWarning.tsx   # Warning email perso
│   │   │   └── ValidatedInput.tsx       # Composant générique input validé
│   │   ├── reassurance/
│   │   │   ├── TrustBadges.tsx
│   │   │   ├── FaqAccordion.tsx
│   │   │   ├── TestimonialCard.tsx
│   │   │   └── CertificationsBar.tsx
│   │   ├── callback/
│   │   │   ├── CallbackButton.tsx       # Bouton flottant
│   │   │   ├── CallbackDialog.tsx
│   │   │   └── CallbackForm.tsx
│   │   ├── reviews/
│   │   │   ├── ReviewStars.tsx
│   │   │   ├── ReviewCard.tsx
│   │   │   ├── ReviewForm.tsx
│   │   │   └── ReviewSummary.tsx
│   │   ├── referrals/
│   │   │   ├── ReferralCode.tsx
│   │   │   ├── ReferralShareButtons.tsx
│   │   │   └── ReferralStats.tsx
│   │   ├── account/
│   │   │   ├── ReservationStatusCard.tsx
│   │   │   ├── ReservationTimeline.tsx
│   │   │   ├── InvoicesList.tsx
│   │   │   ├── PaymentHistory.tsx
│   │   │   ├── DocumentsLibrary.tsx
│   │   │   └── ClaimsList.tsx
│   │   ├── admin/
│   │   │   ├── ContainerEditor.tsx
│   │   │   ├── ProductEditor.tsx
│   │   │   ├── ReservationManager.tsx
│   │   │   ├── PricingConfig.tsx
│   │   │   ├── KpiDashboard.tsx
│   │   │   ├── CallbackManager.tsx
│   │   │   ├── ReviewModerator.tsx
│   │   │   ├── ClaimManager.tsx
│   │   │   └── CountryManager.tsx
│   │   └── ui/                          # shadcn
│   ├── lib/
│   │   ├── supabase/{client,server,types}.ts
│   │   ├── stripe/{client,server,webhooks}.ts
│   │   ├── resend/
│   │   │   ├── client.ts
│   │   │   └── templates/                # React Email templates
│   │   ├── pricing/
│   │   │   ├── tiers.ts
│   │   │   ├── reservation-fee.ts
│   │   │   ├── moq.ts
│   │   │   ├── loyalty.ts
│   │   │   ├── referral.ts
│   │   │   └── aggregation.ts
│   │   ├── delivery/
│   │   │   └── carriers.ts              # Helpers carrier_partners
│   │   ├── container/
│   │   │   ├── fill-calculator.ts
│   │   │   ├── packing.ts
│   │   │   ├── status.ts
│   │   │   ├── auto-open.ts             # Logique 3 modes
│   │   │   └── realtime.ts              # Helpers Supabase Realtime
│   │   ├── pdf/{quote-generator,invoice-generator}.ts
│   │   ├── validation/
│   │   │   ├── schemas.ts               # Zod schemas pour tous inputs API
│   │   │   ├── siret.ts                 # V1.3 - Validation SIRET (algo + INSEE)
│   │   │   ├── email.ts                 # V1.3 - Détection domaines personnels
│   │   │   └── vat-vies.ts              # Vérif TVA intracom (futur multi-pays)
│   │   ├── security/                    # V1.3 - Sécurité
│   │   │   ├── headers.ts               # Headers HTTP sécurisés
│   │   │   ├── rate-limit.ts            # Helpers rate limiting
│   │   │   ├── events.ts                # Log security_events
│   │   │   └── audit.ts                 # Audit log helper
│   │   ├── i18n/                        # Multi-langues prêt
│   │   │   ├── config.ts
│   │   │   └── locales/{fr,en,es,it,de}.ts
│   │   ├── utils/{format,postal-codes,country}.ts
│   │   └── constants.ts
│   ├── stores/
│   │   ├── cart.store.ts
│   │   ├── ui.store.ts
│   │   ├── country.store.ts             # Pays sélectionné
│   │   └── realtime.store.ts            # États temps réel
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useContainer.ts
│   │   ├── useContainerRealtime.ts      # WebSocket
│   │   ├── useReservation.ts
│   │   ├── useAuth.ts
│   │   ├── useMoqStatus.ts
│   │   ├── useCountry.ts
│   │   └── useTranslation.ts
│   ├── styles/{globals,print}.css
│   └── types/{api,domain,supabase}.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_schema.sql
│   │   ├── 0002_pricing_config.sql
│   │   ├── 0003_realtime_setup.sql
│   │   ├── 0004_referrals.sql
│   │   ├── 0005_reviews.sql
│   │   ├── 0006_callbacks.sql
│   │   ├── 0007_documents.sql
│   │   ├── 0008_claims_sav.sql
│   │   └── 0009_audit_log.sql
│   ├── functions/
│   │   ├── check-container-fill/
│   │   ├── process-deposit-call/
│   │   ├── process-balance-call/
│   │   ├── auto-open-container/
│   │   ├── send-milestone-emails/
│   │   ├── process-overdue-reservations/
│   │   ├── refresh-product-ratings/
│   │   └── generate-pdf/
│   └── seed.sql
├── public/
├── tests/{unit,integration,e2e}
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRICING.md
│   ├── LEGAL.md
│   └── API.md
└── README.md
```

### 4.3 Variables d'environnement

```bash
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
RESEND_DOMAIN=containerclub.fr

# INSEE Sirene API (vérification SIRET)
INSEE_API_KEY=
INSEE_API_BASE_URL=https://api.insee.fr/api-sirene/3.11
INSEE_OAUTH_URL=https://api.insee.fr/token
INSEE_CLIENT_ID=
INSEE_CLIENT_SECRET=

# Rate limiting (V1 : Cloudflare WAF gratuit, Upstash optionnel pour V2)
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=

# Sécurité — domaines emails personnels (warning, pas blocage)
BLOCKED_EMAIL_DOMAINS_WARN=gmail.com,yahoo.com,yahoo.fr,hotmail.com,hotmail.fr,outlook.com,outlook.fr,free.fr,orange.fr,wanadoo.fr,laposte.net,sfr.fr,bbox.fr,neuf.fr

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_IMAGES_HASH=

# Analytics
VITE_PLAUSIBLE_DOMAIN=

# Monitoring
VITE_SENTRY_DSN=

# Business defaults (overridable via app_config)
DEFAULT_VAT_RATE=20
RESERVATION_FEE_RATE=0.03
RESERVATION_FEE_MIN=150
RESERVATION_FEE_MAX=500
CONTAINER_CAPACITY_CBM=28
CONTAINER_THRESHOLD_PERCENT=80
MIN_SERIES_REQUIRED=3
CONTAINER_AUTO_OPEN_MODE=manual
```

---

## 5. MODÈLE DE DONNÉES COMPLET

### 5.1 Schéma SQL Supabase

```sql
-- ============================================
-- EXTENSIONS
-- ============================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- TYPES ENUM
-- ============================================
create type product_category as enum ('chair', 'armchair', 'table', 'bench', 'accessory');
create type container_status as enum (
  'draft','open','threshold_reached','production',
  'manufactured','shipped','customs','arrived','delivered','cancelled'
);
create type reservation_status as enum (
  'cart','pending_reservation_fee','reserved',
  'pending_deposit','deposit_paid','pending_balance',
  'paid_full','cancelled','refunded','converted_to_credit'
);
create type payment_type as enum (
  'reservation_fee','deposit','balance','refund','credit_applied'
);
create type payment_status as enum (
  'pending','succeeded','failed','refunded','disputed'
);
create type user_role as enum ('buyer','admin','super_admin');
create type delivery_mode as enum (
  'pickup_at_port',           -- Enlèvement libre au port (défaut)
  'partner_carrier_needed',   -- Besoin de la liste transporteurs Container Club
  'self_arranged'             -- Transporteur déjà organisé par le client
);
create type document_type as enum (
  'test_report','fire_certificate','reach_compliance',
  'tech_sheet','warranty_terms','assembly_guide',
  'care_instructions','material_origin','sustainability'
);
create type callback_status as enum (
  'pending','scheduled','completed','no_answer','cancelled'
);
create type callback_slot as enum (
  'now','today_pm','tomorrow_am','tomorrow_pm','specific'
);
create type referral_status as enum (
  'pending','validated','expired','revoked'
);
create type claim_type as enum (
  'apparent_defect','non_conformity','hidden_defect','transport_damage'
);
create type claim_status as enum (
  'open','in_review','accepted','partial','rejected','resolved'
);
create type container_auto_open_mode as enum ('manual','semi_auto','full_auto');

-- ============================================
-- RÉFÉRENTIELS GÉOGRAPHIQUES (multi-pays prêt)
-- ============================================

create table countries (
  code text primary key,            -- 'FR', 'ES', 'IT', 'DE'
  name text not null,
  name_local text,                  -- "France", "España"
  currency text not null default 'EUR',
  vat_rate numeric(4,2) not null default 20.00,
  locale text not null default 'fr-FR',
  is_active boolean default false,  -- activé un par un
  display_order int default 0,
  flag_emoji text,
  created_at timestamptz default now()
);

create table ports (
  id uuid primary key default gen_random_uuid(),
  country_code text references countries(code),
  code text unique not null,        -- 'FRMRS', 'FRLEH', 'ESBCN'
  name text not null,
  city text,
  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz default now()
);

-- ============================================
-- TRANSPORTEURS RECOMMANDÉS (V1 : sans contrat, juste info)
-- ============================================

create table carrier_partners (
  id uuid primary key default gen_random_uuid(),

  -- Identité
  name text not null,
  logo_url text,
  description text,
  website_url text,

  -- Spécialités et couverture
  specialties text[] default array[]::text[],  -- ['national','palette','mobilier','express']
  coverage_zones text[] default array[]::text[],  -- ['national_fr','region_idf','europe']
  countries_served text[] default array['FR']::text[],

  -- Contact
  contact_url text,             -- URL devis en ligne
  contact_phone text,
  contact_email text,
  dedicated_contact_name text,  -- "Mr Dupont, contact dédié pour Container Club"

  -- Tarifs indicatifs (SANS ENGAGEMENT — uniquement pour info client)
  -- Format texte libre pour flexibilité
  typical_price_range_near text,      -- "200-300€" (<200 km du port)
  typical_price_range_medium text,    -- "350-500€" (200-500 km)
  typical_price_range_far text,       -- "600-800€" (500-900 km)
  typical_price_range_extreme text,   -- "Sur devis" (>900 km, Corse, DOM)
  typical_delay_days int,             -- 3 (jours moyens)

  -- Notes
  notes_for_customers text,           -- "Mentionnez Container Club pour suivi prioritaire"
  internal_notes text,                -- ADMIN ONLY

  -- Position et activation
  is_recommended boolean default true,
  is_active boolean default true,
  display_order int default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- HISTORIQUE LIVRAISONS (préparé pour V2)
-- ============================================
-- En V1 : table vide, ou remplie manuellement par admin après chaque livraison
-- En V2 : alimente un futur estimateur dynamique de tarif transport

create table delivery_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  company_id uuid references companies(id),

  -- Origine
  port_id uuid references ports(id),
  port_name text,

  -- Destination
  delivery_postal_code text,
  delivery_city text,
  delivery_country text default 'FR',
  estimated_distance_km int,

  -- Transport effectif
  carrier_partner_id uuid references carrier_partners(id),
  carrier_name_used text,       -- au cas où ce n'est pas un partner

  -- Logistique
  palettes_count int,
  total_weight_kg numeric(8,2),
  total_cbm numeric(6,4),

  -- Coûts (renseigné par admin a posteriori)
  cost_paid_by_client numeric(10,2),

  -- Timing
  pickup_date date,
  delivery_date date,
  actual_delay_days int,

  -- Notes
  admin_notes text,

  created_at timestamptz default now()
);

create index idx_delivery_history_destination on delivery_history(delivery_postal_code, delivery_country);
create index idx_delivery_history_carrier on delivery_history(carrier_partner_id);

-- NOTE V1 : les tables delivery_zones et postal_code_zones de la v1.1
-- ont été retirées. Elles pourront être réintroduites en V2 quand des
-- contrats transporteurs cadres seront signés et que Container Club
-- facturera lui-même la livraison.

-- ============================================
-- CATALOGUE PRODUITS
-- ============================================

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  category product_category not null,
  name text not null,
  slug text unique not null,        -- pour URLs SEO
  description text,
  long_description text,

  -- Dimensions et logistique
  dimensions_cm jsonb not null,     -- { l, w, h }
  cbm_per_unit numeric(6,4) not null,
  weight_kg numeric(6,2),

  -- MOQ et coût
  moq_units int not null,
  cost_landed_port_eur numeric(10,2) not null,  -- ADMIN ONLY
  retail_price_ref numeric(10,2),               -- pour affichage économie

  -- Variantes multi-axes (table : ['top_config', 'leg_finish'])
  variant_types text[] default array[]::text[],

  -- Conformité
  hs_code text,
  fire_rating text,
  eco_category text,
  eco_contribution numeric(6,2) default 0,

  -- Médias
  main_image_url text,
  gallery_urls text[] default array[]::text[],
  thumb_url text,

  -- Métadonnées
  features text[] default array[]::text[],
  materials text[] default array[]::text[],
  warranty_months int default 24,

  -- SEO
  meta_title text,
  meta_description text,

  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  variant_type text not null,       -- 'weaving_color', 'top_config', 'leg_finish'
  value text not null,              -- 'noir_charbon', 'top_round_80_teak', 'leg_only'
  display_name text,                -- 'Noir charbon', 'Rond 80cm Teck'
  display_name_short text,          -- 'Noir', 'R80 Teck'
  hex_color text,
  image_url text,
  price_adjustment numeric(8,2) default 0,  -- ex. -30% pour "leg_only"
  is_active boolean default true,
  display_order int default 0,
  unique (product_id, variant_type, value)
);

-- Combinaisons valides de variantes pour les produits multi-axes (tables)
-- Permet de gérer "pied seul" comme une combinaison spéciale
create table product_variant_combinations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  variant_ids uuid[] not null,      -- combinaison de variants
  is_special_combo boolean default false,  -- true pour "pied seul"
  combo_label text,                 -- "Pied seul", "Pack complet"
  price_adjustment_total numeric(8,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Documents qualité (clients connectés uniquement)
create table product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  document_type document_type not null,
  title text not null,
  description text,
  file_url text not null,
  file_size_bytes int,
  language text default 'fr',
  issued_by text,                   -- 'SGS', 'Bureau Veritas', 'Eurofins'
  issued_at date,
  valid_until date,
  is_published boolean default true,  -- toujours auth required, mais peut être désactivé
  display_order int default 0,
  created_at timestamptz default now()
);

-- ============================================
-- CONTAINERS
-- ============================================

create table containers (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,   -- 'CC-2026-001'
  port_id uuid references ports(id),
  country_code text references countries(code),  -- denorm pour query rapide

  -- Capacité
  capacity_cbm numeric(6,2) not null default 28.00,
  threshold_percent int not null default 80,
  min_series_required int not null default 3,

  -- Cycle de vie
  status container_status not null default 'draft',
  opened_at timestamptz,
  expected_close_at timestamptz,
  closed_at timestamptz,
  threshold_reached_at timestamptz,
  production_started_at timestamptz,
  manufactured_at timestamptz,
  shipped_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,

  -- Métadonnées
  factory_partner text,
  shipping_line text,
  bill_of_lading text,
  vessel_name text,
  customs_declaration_ref text,

  -- Coûts ADMIN ONLY
  total_landed_cost numeric(10,2),
  customs_duty numeric(10,2),
  customs_agent_fees numeric(10,2),

  -- Médias (containers livrés)
  cover_image_url text,
  gallery_urls text[] default array[]::text[],

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Métriques temps réel
create table container_metrics (
  container_id uuid primary key references containers(id) on delete cascade,
  total_cbm_committed numeric(8,4) default 0,
  fill_percent numeric(5,2) default 0,
  series_reached int default 0,
  series_in_progress int default 0,
  professionals_engaged int default 0,
  total_revenue_ht numeric(10,2) default 0,
  total_units_sold int default 0,
  last_calculated_at timestamptz default now()
);

-- Pools MOQ par (container × produit × combinaison de variantes)
create table moq_pools (
  id uuid primary key default gen_random_uuid(),
  container_id uuid references containers(id) on delete cascade,
  product_id uuid references products(id),
  variant_id uuid references product_variants(id),  -- variante principale
  variant_combination_id uuid references product_variant_combinations(id),  -- pour multi-axes
  moq_required int not null,
  units_committed int default 0,
  is_reached boolean default false,
  reached_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- COMPANIES & USERS
-- ============================================

create table companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,

  -- Identifiants nationaux (V1.3)
  siret text,                       -- 14 chiffres (FR)
  siren text,                       -- 9 chiffres (FR, dérivé du SIRET)
  vat_number text,                  -- TVA intracom si applicable
  national_business_id text,        -- Pour autres pays (NIF ES, P.IVA IT, etc.)
  country_code text references countries(code) default 'FR',

  -- Vérification SIRET (V1.3 — via API INSEE)
  siret_verified boolean default false,
  siret_verified_at timestamptz,
  siret_verification_data jsonb,    -- payload INSEE complet
  naf_code text,                    -- code NAF/APE (ex: 5510Z)
  naf_label text,                   -- libellé activité
  legal_form text,                  -- SARL, SAS, EI, etc.
  legal_form_code text,             -- code juridique INSEE
  creation_date date,               -- date création entreprise
  is_active_company boolean default true,  -- false si cessée à l'INSEE
  inactive_since date,

  -- Anti-fraude / risque (V1.3)
  risk_flag text default 'normal' check (risk_flag in ('normal','review','blocked')),
  risk_notes text,                  -- ADMIN ONLY

  -- Contact
  billing_email text,
  billing_phone text,

  -- Adresses
  billing_address jsonb,            -- pré-rempli depuis SIRET si dispo
  default_delivery_address jsonb,
  default_delivery_postal_code text,
  default_delivery_country text,

  -- Statut
  is_verified boolean default false,
  verified_at timestamptz,
  verification_notes text,

  -- Fidélité
  loyalty_tier int default 0,
  total_containers_completed int default 0,
  total_lifetime_value numeric(12,2) default 0,

  -- Parrainage
  referred_by_code_id uuid,         -- FK différée vers referral_codes

  -- Préférences
  preferred_locale text default 'fr-FR',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- V1.3 : Contrainte d'unicité SIRET (anti-spam comptes)
-- Un SIRET ne peut être lié qu'à un seul compte company actif
create unique index idx_companies_siret_unique
  on companies(siret)
  where siret is not null and risk_flag != 'blocked';

create table users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id),
  first_name text,
  last_name text,
  email text not null,
  phone text,
  role user_role default 'buyer',

  -- Consentements RGPD
  email_marketing_consent boolean default false,
  email_marketing_consent_at timestamptz,
  cgv_accepted_at timestamptz,
  cgv_version_accepted text,

  last_login_at timestamptz,
  preferred_locale text default 'fr-FR',
  created_at timestamptz default now()
);

-- ============================================
-- RÉSERVATIONS
-- ============================================

create table reservations (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  container_id uuid references containers(id),
  user_id uuid references users_profile(id),
  company_id uuid references companies(id),

  -- Livraison (V1 : aucune facturation par Container Club)
  delivery_mode delivery_mode default 'pickup_at_port',
  delivery_postal_code text,        -- pour info uniquement
  delivery_address jsonb,           -- pour info uniquement
  delivery_country text default 'FR',
  delivery_fee numeric(8,2) default 0,  -- toujours 0 en V1, gardé pour V2
  delivery_notes text,              -- notes du client sur ses besoins transport

  -- Montants HT
  subtotal_ht numeric(10,2) not null,
  eco_contribution_total numeric(8,2) default 0,
  loyalty_discount numeric(8,2) default 0,
  referral_discount numeric(8,2) default 0,
  total_ht numeric(10,2) not null,
  vat_rate numeric(4,2) not null default 20.00,
  vat_amount numeric(10,2) not null,
  total_ttc numeric(10,2) not null,

  -- Marge ADMIN ONLY
  total_cbm numeric(6,4) not null,
  effective_margin_percent numeric(5,2),
  total_landed_cost numeric(10,2),

  -- Acomptes
  reservation_fee numeric(8,2) not null,
  deposit_amount numeric(10,2),
  balance_amount numeric(10,2),

  -- Statut
  status reservation_status not null default 'cart',

  -- Timeline
  reserved_at timestamptz,
  deposit_called_at timestamptz,
  deposit_paid_at timestamptz,
  balance_called_at timestamptz,
  balance_paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  -- CGV
  cgv_version_accepted text,
  cgv_accepted_at timestamptz,

  -- Parrainage
  referral_code_used_id uuid,       -- FK différée

  -- Notes admin
  admin_notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) on delete cascade,
  product_id uuid references products(id),
  variant_id uuid references product_variants(id),
  variant_combination_id uuid references product_variant_combinations(id),

  quantity int not null check (quantity > 0),

  -- Prix bloqués à la réservation
  unit_cost_landed numeric(10,2) not null,  -- ADMIN ONLY
  unit_price_ht numeric(10,2) not null,
  unit_eco_contribution numeric(6,2) default 0,

  subtotal_ht numeric(10,2) not null,
  eco_contribution_total numeric(8,2) default 0,
  cbm_total numeric(6,4) not null,

  moq_pool_id uuid references moq_pools(id),

  -- Changement post-clôture (MOQ non atteint)
  original_variant_id uuid references product_variants(id),
  original_variant_combination_id uuid references product_variant_combinations(id),
  variant_changed_at timestamptz,
  variant_change_reason text,

  created_at timestamptz default now()
);

-- ============================================
-- PAIEMENTS
-- ============================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  company_id uuid references companies(id),

  type payment_type not null,
  amount numeric(10,2) not null,
  currency text default 'EUR',
  status payment_status not null default 'pending',

  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_payment_method text,

  is_refundable boolean default false,
  refundable_until timestamptz,

  initiated_at timestamptz default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_amount numeric(10,2),
  refund_reason text,

  created_at timestamptz default now()
);

-- Avoirs (frais réservation transformés en crédit)
create table credits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  amount numeric(8,2) not null,
  source_reservation_id uuid references reservations(id),
  reason text,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_on_reservation_id uuid references reservations(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- PARRAINAGE
-- ============================================

create table referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,        -- 'CONTAINER-PIERRE-X7K9'
  referrer_company_id uuid references companies(id),
  custom_label text,                -- "Mon code spécial fidèles"
  is_active boolean default true,
  total_uses int default 0,
  max_uses int default 10,          -- anti-abuse
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid references referral_codes(id),
  referrer_company_id uuid references companies(id),
  referred_company_id uuid references companies(id),
  referred_reservation_id uuid references reservations(id),

  -- Récompenses (paramétrables)
  referrer_credit_amount numeric(8,2) not null,
  referred_discount_amount numeric(8,2) not null,

  status referral_status not null default 'pending',
  validated_at timestamptz,

  created_at timestamptz default now()
);

-- Liaison différée
alter table companies
  add constraint companies_referred_by_fk
  foreign key (referred_by_code_id) references referral_codes(id);

alter table reservations
  add constraint reservations_referral_code_fk
  foreign key (referral_code_used_id) references referral_codes(id);

-- ============================================
-- REVIEWS
-- ============================================

create table reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) unique,
  company_id uuid references companies(id),

  overall_rating int not null check (overall_rating between 1 and 5),
  quality_rating int check (quality_rating between 1 and 5),
  value_rating int check (value_rating between 1 and 5),
  delivery_rating int check (delivery_rating between 1 and 5),
  communication_rating int check (communication_rating between 1 and 5),

  title text,
  comment text,
  photo_urls text[],

  is_verified_purchase boolean default true,
  is_published boolean default false,
  published_at timestamptz,

  admin_response text,
  admin_response_at timestamptz,

  helpful_count int default 0,

  created_at timestamptz default now()
);

create table review_helpfulness (
  review_id uuid references reviews(id) on delete cascade,
  company_id uuid references companies(id),
  is_helpful boolean,
  voted_at timestamptz default now(),
  primary key (review_id, company_id)
);

-- Vue matérialisée pour ratings produit
create materialized view product_ratings as
select
  ri.product_id,
  avg(r.overall_rating)::numeric(3,2) as average_rating,
  avg(r.quality_rating)::numeric(3,2) as quality_avg,
  avg(r.value_rating)::numeric(3,2) as value_avg,
  avg(r.delivery_rating)::numeric(3,2) as delivery_avg,
  count(r.id) as review_count,
  count(*) filter (where r.overall_rating = 5) as rating_5_count,
  count(*) filter (where r.overall_rating = 4) as rating_4_count,
  count(*) filter (where r.overall_rating = 3) as rating_3_count,
  count(*) filter (where r.overall_rating = 2) as rating_2_count,
  count(*) filter (where r.overall_rating = 1) as rating_1_count
from reviews r
join reservation_items ri on ri.reservation_id = r.reservation_id
where r.is_published = true
group by ri.product_id;

create unique index idx_product_ratings_product on product_ratings(product_id);

-- ============================================
-- CALLBACK REQUESTS
-- ============================================

create table callback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id),
  company_id uuid references companies(id),

  name text not null,
  company_name text,
  phone text not null,
  email text,

  preferred_slot callback_slot,
  scheduled_at timestamptz,
  subject text,
  context_url text,
  reservation_id uuid references reservations(id),

  status callback_status not null default 'pending',
  assigned_to_admin uuid references users_profile(id),
  called_at timestamptz,
  call_notes text,
  outcome text,

  created_at timestamptz default now()
);

-- ============================================
-- RÉCLAMATIONS SAV
-- ============================================

create table claims (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,   -- 'CLAIM-2026-001'
  reservation_id uuid references reservations(id),
  reservation_item_id uuid references reservation_items(id),
  company_id uuid references companies(id),

  claim_type claim_type not null,
  description text not null,
  photo_urls text[] not null default array[]::text[],

  affected_quantity int,

  status claim_status not null default 'open',

  -- Timeline
  reported_at timestamptz default now(),
  delivered_at_reservation timestamptz,
  days_since_delivery int,

  -- Résolution
  resolution_type text,             -- 'replacement', 'partial_refund', 'full_refund', 'rejected'
  resolution_amount numeric(8,2),
  resolved_at timestamptz,
  admin_notes text,
  customer_communication text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- CONTENU & TEMOIGNAGES
-- ============================================

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  container_id uuid references containers(id),
  reservation_id uuid references reservations(id),
  company_display_name text,
  city text,
  business_type text,
  quote text,
  photo_urls text[],
  rating int check (rating between 1 and 5),
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- LOGS & AUDIT
-- ============================================

create table email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id),
  reservation_id uuid references reservations(id),
  template text not null,
  subject text,
  recipient text not null,
  resend_id text,
  status text,
  error_message text,
  sent_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- ============================================
-- SÉCURITÉ — TRACKING ÉVÉNEMENTS (V1.3)
-- ============================================
-- Log tous les événements de sécurité pour audit et détection d'anomalies

create type security_event_type as enum (
  'login_success',
  'login_failed',
  'magic_link_sent',
  'magic_link_rate_limited',
  'siret_lookup_success',
  'siret_lookup_failed',
  'siret_lookup_invalid',
  'siret_lookup_inactive',
  'siret_duplicate_attempt',     -- tentative de créer compte avec SIRET existant
  'email_warning_shown',         -- email perso flagged
  'rate_limit_hit',
  'suspicious_pattern',          -- détection comportement anormal
  'admin_action',
  'data_export',                 -- demande RGPD export
  'data_deletion',               -- demande RGPD suppression
  'failed_payment_attempt',
  'refund_initiated'
);

create table security_events (
  id uuid primary key default gen_random_uuid(),
  event_type security_event_type not null,
  user_id uuid references users_profile(id),
  company_id uuid references companies(id),

  -- Contexte technique
  ip_address inet,
  user_agent text,
  request_id text,                 -- pour correlation logs Cloudflare

  -- Données contextuelles
  metadata jsonb,                  -- ex: { siret_attempted: '...', reason: '...' }
  severity text default 'info' check (severity in ('info','warning','error','critical')),

  -- Investigation admin
  reviewed_by uuid references users_profile(id),
  reviewed_at timestamptz,
  resolution text,

  created_at timestamptz default now()
);

create index idx_security_events_type_created
  on security_events(event_type, created_at desc);
create index idx_security_events_ip_created
  on security_events(ip_address, created_at desc);
create index idx_security_events_user
  on security_events(user_id, created_at desc)
  where user_id is not null;
create index idx_security_events_severity
  on security_events(severity, created_at desc)
  where severity in ('error','critical');

-- ============================================
-- CACHE VÉRIFICATIONS SIRET (V1.3)
-- ============================================
-- Cache des résultats INSEE pour éviter appels redondants
-- TTL : 7 jours (les données INSEE sont stables au-delà)

create table siret_cache (
  siret text primary key,
  insee_response jsonb not null,
  is_valid boolean not null,
  is_active boolean not null,
  fetched_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

create index idx_siret_cache_expires on siret_cache(expires_at);

-- ============================================
-- CONFIGURATION (key-value)
-- ============================================

create table app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references users_profile(id),
  updated_at timestamptz default now()
);

-- Seed config initial
insert into app_config (key, value, description) values
('pricing_tiers', '[
  {"min_cbm": 0, "max_cbm": 0.80, "margin_percent": 35},
  {"min_cbm": 0.80, "max_cbm": 2.00, "margin_percent": 32},
  {"min_cbm": 2.00, "max_cbm": 4.00, "margin_percent": 30},
  {"min_cbm": 4.00, "max_cbm": 8.00, "margin_percent": 27},
  {"min_cbm": 8.00, "max_cbm": null, "margin_percent": 25}
]'::jsonb, 'Marges dégressives par tranche de CBM (incrémental)'),

('reservation_fee', '{
  "rate": 0.03,
  "min": 150,
  "max": 500
}'::jsonb, 'Frais de réservation 3% min 150 max 500'),

('loyalty_discount', '[
  {"min_containers": 2, "discount_percent": 2},
  {"min_containers": 3, "discount_percent": 3},
  {"min_containers": 5, "discount_percent": 4},
  {"min_containers": 10, "discount_percent": 5}
]'::jsonb, 'Remise fidélité selon nb containers livrés'),

('referral_program', '{
  "referrer_credit": 200,
  "referred_discount": 100,
  "credit_validity_months": 12,
  "max_uses_per_code": 10
}'::jsonb, 'Programme parrainage - montants ajustables'),

('container_auto_open_mode', '"manual"'::jsonb,
 'manual | semi_auto | full_auto'),

('container_capacity_default', '28'::jsonb,
 'Capacité CBM par défaut pour nouveau container 20HC'),

('container_threshold_percent', '80'::jsonb,
 'Seuil de remplissage pour déclencher production'),

('min_series_required', '3'::jsonb,
 'Minimum séries MOQ atteintes pour déclencher production'),

('cgv_current_version', '"1.0"'::jsonb,
 'Version CGV en vigueur'),

('callback_business_hours', '{
  "monday": {"start": "09:00", "end": "18:00"},
  "tuesday": {"start": "09:00", "end": "18:00"},
  "wednesday": {"start": "09:00", "end": "18:00"},
  "thursday": {"start": "09:00", "end": "18:00"},
  "friday": {"start": "09:00", "end": "17:00"}
}'::jsonb, 'Horaires pour callbacks');

-- ============================================
-- INDEX
-- ============================================

create index idx_products_active on products(is_active) where is_active = true;
create index idx_products_category on products(category);
create index idx_products_slug on products(slug);

create index idx_containers_status on containers(status)
  where status in ('open','threshold_reached');
create index idx_containers_port on containers(port_id);
create index idx_containers_country on containers(country_code);

create index idx_reservations_user on reservations(user_id);
create index idx_reservations_container on reservations(container_id);
create index idx_reservations_company on reservations(company_id);
create index idx_reservations_status on reservations(status);

create index idx_moq_pools_container on moq_pools(container_id);
create index idx_moq_pools_reached on moq_pools(container_id) where is_reached = true;

create index idx_payments_reservation on payments(reservation_id);
create index idx_payments_stripe on payments(stripe_payment_intent_id);

create index idx_carrier_partners_active on carrier_partners(is_active, display_order)
  where is_active = true;

create index idx_email_log_user on email_log(user_id, sent_at desc);

create index idx_callbacks_status on callback_requests(status, scheduled_at);
create index idx_claims_status on claims(status, reported_at);
create index idx_reviews_published on reviews(is_published, published_at desc);
create index idx_referral_codes_company on referral_codes(referrer_company_id);

-- ============================================
-- TRIGGERS
-- ============================================

create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger containers_updated_at before update on containers
  for each row execute function set_updated_at();
create trigger reservations_updated_at before update on reservations
  for each row execute function set_updated_at();
create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();
create trigger claims_updated_at before update on claims
  for each row execute function set_updated_at();
create trigger moq_pools_updated_at before update on moq_pools
  for each row execute function set_updated_at();

-- Trigger MOQ et metrics (déclenche temps réel via Supabase Realtime)
create or replace function update_moq_and_metrics()
returns trigger as $$
declare
  v_container_id uuid;
begin
  select container_id into v_container_id
  from reservations
  where id = coalesce(new.reservation_id, old.reservation_id);

  -- Recalcule le pool MOQ concerné
  update moq_pools mp
  set
    units_committed = coalesce((
      select sum(ri.quantity)
      from reservation_items ri
      join reservations r on r.id = ri.reservation_id
      where ri.product_id = mp.product_id
        and (
          (mp.variant_id is not null and ri.variant_id = mp.variant_id)
          or (mp.variant_combination_id is not null and ri.variant_combination_id = mp.variant_combination_id)
        )
        and r.container_id = mp.container_id
        and r.status in ('reserved','pending_deposit','deposit_paid','pending_balance','paid_full')
    ), 0),
    updated_at = now()
  where mp.container_id = v_container_id;

  -- Mise à jour is_reached et reached_at
  update moq_pools
  set
    is_reached = (units_committed >= moq_required),
    reached_at = case
      when is_reached = false and units_committed >= moq_required then now()
      when units_committed < moq_required then null
      else reached_at
    end
  where container_id = v_container_id;

  -- Recalcul métriques container
  insert into container_metrics (container_id)
  values (v_container_id)
  on conflict (container_id) do nothing;

  update container_metrics cm
  set
    total_cbm_committed = coalesce((
      select sum(ri.cbm_total)
      from reservation_items ri
      join reservations r on r.id = ri.reservation_id
      where r.container_id = v_container_id
        and r.status in ('reserved','pending_deposit','deposit_paid','pending_balance','paid_full')
    ), 0),
    fill_percent = coalesce((
      select sum(ri.cbm_total) / c.capacity_cbm * 100
      from reservation_items ri
      join reservations r on r.id = ri.reservation_id
      join containers c on c.id = r.container_id
      where r.container_id = v_container_id
        and r.status in ('reserved','pending_deposit','deposit_paid','pending_balance','paid_full')
      group by c.capacity_cbm
    ), 0),
    series_reached = (
      select count(*) from moq_pools
      where container_id = v_container_id and is_reached = true
    ),
    series_in_progress = (
      select count(*) from moq_pools
      where container_id = v_container_id and is_reached = false and units_committed > 0
    ),
    professionals_engaged = (
      select count(distinct r.company_id)
      from reservations r
      where r.container_id = v_container_id
        and r.status in ('reserved','pending_deposit','deposit_paid','pending_balance','paid_full')
    ),
    total_revenue_ht = coalesce((
      select sum(r.total_ht)
      from reservations r
      where r.container_id = v_container_id
        and r.status in ('reserved','pending_deposit','deposit_paid','pending_balance','paid_full')
    ), 0),
    total_units_sold = coalesce((
      select sum(ri.quantity)
      from reservation_items ri
      join reservations r on r.id = ri.reservation_id
      where r.container_id = v_container_id
        and r.status in ('reserved','pending_deposit','deposit_paid','pending_balance','paid_full')
    ), 0),
    last_calculated_at = now()
  where cm.container_id = v_container_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger reservation_items_update_moq
  after insert or update or delete on reservation_items
  for each row execute function update_moq_and_metrics();

-- Trigger pour incrémenter loyalty_tier au statut delivered
create or replace function update_loyalty_on_delivery()
returns trigger as $$
begin
  if new.status = 'delivered' and old.status != 'delivered' then
    update companies c
    set
      total_containers_completed = total_containers_completed + (
        select count(distinct r.id)
        from reservations r
        where r.company_id = c.id
          and r.container_id = new.id
          and r.status in ('paid_full')
      ),
      total_lifetime_value = total_lifetime_value + coalesce((
        select sum(r.total_ht)
        from reservations r
        where r.company_id = c.id
          and r.container_id = new.id
          and r.status in ('paid_full')
      ), 0)
    where c.id in (
      select distinct r.company_id
      from reservations r
      where r.container_id = new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger containers_loyalty_update
  after update on containers
  for each row execute function update_loyalty_on_delivery();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table companies enable row level security;
alter table users_profile enable row level security;
alter table reservations enable row level security;
alter table reservation_items enable row level security;
alter table payments enable row level security;
alter table claims enable row level security;
alter table reviews enable row level security;
alter table referral_codes enable row level security;
alter table callback_requests enable row level security;
alter table product_documents enable row level security;
alter table credits enable row level security;

-- Buyers : voient leurs propres données
create policy "Users see own company" on companies for select
  using (id in (select company_id from users_profile where id = auth.uid()));

create policy "Users see own profile" on users_profile for select
  using (id = auth.uid());

create policy "Users see own reservations" on reservations for select
  using (company_id in (select company_id from users_profile where id = auth.uid()));

create policy "Users see own items" on reservation_items for select
  using (reservation_id in (
    select id from reservations
    where company_id in (select company_id from users_profile where id = auth.uid())
  ));

create policy "Users see own payments" on payments for select
  using (company_id in (select company_id from users_profile where id = auth.uid()));

create policy "Users see own claims" on claims for select
  using (company_id in (select company_id from users_profile where id = auth.uid()));

create policy "Users see own credits" on credits for select
  using (company_id in (select company_id from users_profile where id = auth.uid()));

create policy "Users see own callbacks" on callback_requests for select
  using (
    user_id = auth.uid()
    or company_id in (select company_id from users_profile where id = auth.uid())
  );

create policy "Users see own referrals" on referral_codes for select
  using (referrer_company_id in (select company_id from users_profile where id = auth.uid()));

-- Documents produits : visibles pour utilisateurs authentifiés uniquement
create policy "Authenticated users see published documents" on product_documents for select
  using (auth.role() = 'authenticated' and is_published = true);

-- Reviews publiées : lecture publique
create policy "Anyone reads published reviews" on reviews for select
  using (is_published = true);

create policy "Users see own reviews" on reviews for select
  using (company_id in (select company_id from users_profile where id = auth.uid()));

-- Admins : full access
create policy "Admins full access companies" on companies for all
  using ((select role from users_profile where id = auth.uid()) in ('admin','super_admin'));

create policy "Admins full access reservations" on reservations for all
  using ((select role from users_profile where id = auth.uid()) in ('admin','super_admin'));

create policy "Admins full access reservation_items" on reservation_items for all
  using ((select role from users_profile where id = auth.uid()) in ('admin','super_admin'));

create policy "Admins full access claims" on claims for all
  using ((select role from users_profile where id = auth.uid()) in ('admin','super_admin'));

create policy "Admins full access reviews" on reviews for all
  using ((select role from users_profile where id = auth.uid()) in ('admin','super_admin'));

create policy "Admins full access callbacks" on callback_requests for all
  using ((select role from users_profile where id = auth.uid()) in ('admin','super_admin'));

-- ============================================
-- REALTIME (Supabase)
-- ============================================

-- Activer Realtime sur les tables critiques
alter publication supabase_realtime add table containers;
alter publication supabase_realtime add table container_metrics;
alter publication supabase_realtime add table moq_pools;
alter publication supabase_realtime add table reservations;
```

### 5.2 Tables publiquement lisibles

Lecture sans auth (pas de RLS bloquante) :

- `countries` (où `is_active = true`)
- `ports` (où `is_active = true`)
- `delivery_zones` ❌ supprimée en v1.2
- `postal_code_zones` ❌ supprimée en v1.2
- `carrier_partners` ✅ (où `is_active = true`)
- `products` (où `is_active = true`)
- `product_variants` (où `is_active = true`)
- `product_variant_combinations`
- `containers` (où `status in ('open','threshold_reached','delivered')`)
- `container_metrics`
- `moq_pools`
- `testimonials` (où `is_published = true`)
- `app_config` (lecture seule)
- `product_ratings` (vue matérialisée)

**Restrictions colonnes serveur** : ne JAMAIS exposer `cost_landed_port_eur`, `total_landed_cost`, `unit_cost_landed`, `effective_margin_percent`, `customs_duty`, `customs_agent_fees`, `total_landed_cost` côté client. Filtrer dans les RPC ou les routes API.

---

## 6. LOGIQUE MÉTIER CRITIQUE

### 6.1 Calcul prix avec tiers dégressifs (méthode incrémentale)

```typescript
// src/lib/pricing/tiers.ts

import type { PricingTier } from '@/types/domain'

export interface CartLineForPricing {
  productId: string
  variantId: string | null
  variantCombinationId: string | null
  quantity: number
  cbmPerUnit: number
  costLanded: number
  ecoContribution: number
}

export interface PricedLine extends CartLineForPricing {
  effectiveMargin: number
  unitPriceHt: number
  subtotalHt: number
  ecoContributionTotal: number
  cbmTotal: number
}

export interface PricingResult {
  lines: PricedLine[]
  totalCbm: number
  effectiveMarginPercent: number
  subtotalHt: number
  ecoContributionTotal: number
  totalHt: number
}

/**
 * Calcule le pricing avec méthode INCRÉMENTALE.
 * Chaque tranche de CBM est facturée au tier correspondant.
 * Évite profit leakage et fractionnement de commandes.
 */
export function calculateOrderPricing(
  lines: CartLineForPricing[],
  tiers: PricingTier[],
): PricingResult {
  if (lines.length === 0) {
    return {
      lines: [],
      totalCbm: 0,
      effectiveMarginPercent: tiers[0]?.marginPercent ?? 35,
      subtotalHt: 0,
      ecoContributionTotal: 0,
      totalHt: 0,
    }
  }

  const sortedTiers = [...tiers].sort((a, b) => a.minCbm - b.minCbm)

  // Tri stable : les lignes traitées dans l'ordre d'ajout au panier
  // Cela donne un calcul déterministe et juste
  let cbmCumulative = 0
  const pricedLines: PricedLine[] = []

  for (const line of lines) {
    const lineCbmTotal = line.cbmPerUnit * line.quantity
    const cbmStart = cbmCumulative
    const cbmEnd = cbmCumulative + lineCbmTotal

    let weightedMarginSum = 0
    let cbmAccountedFor = 0

    for (const tier of sortedTiers) {
      const tierStart = tier.minCbm
      const tierEnd = tier.maxCbm ?? Infinity

      const overlapStart = Math.max(cbmStart, tierStart)
      const overlapEnd = Math.min(cbmEnd, tierEnd)
      const overlap = Math.max(0, overlapEnd - overlapStart)

      if (overlap > 0) {
        weightedMarginSum += overlap * tier.marginPercent
        cbmAccountedFor += overlap
      }
    }

    const effectiveMargin =
      cbmAccountedFor > 0
        ? weightedMarginSum / cbmAccountedFor
        : sortedTiers[0].marginPercent

    const unitPriceHt = round2(
      line.costLanded * (1 + effectiveMargin / 100) + line.ecoContribution,
    )
    const subtotalHt = round2(unitPriceHt * line.quantity)
    const ecoContributionTotal = round2(line.ecoContribution * line.quantity)

    pricedLines.push({
      ...line,
      effectiveMargin,
      unitPriceHt,
      subtotalHt,
      ecoContributionTotal,
      cbmTotal: lineCbmTotal,
    })

    cbmCumulative = cbmEnd
  }

  const subtotalHt = pricedLines.reduce((s, l) => s + l.subtotalHt, 0)
  const ecoContributionTotal = pricedLines.reduce(
    (s, l) => s + l.ecoContributionTotal,
    0,
  )
  const totalCbm = pricedLines.reduce((s, l) => s + l.cbmTotal, 0)

  const totalWeightedMargin = pricedLines.reduce(
    (s, l) => s + l.effectiveMargin * l.cbmTotal,
    0,
  )
  const effectiveMarginPercent =
    totalCbm > 0 ? totalWeightedMargin / totalCbm : sortedTiers[0].marginPercent

  return {
    lines: pricedLines,
    totalCbm,
    effectiveMarginPercent,
    subtotalHt: round2(subtotalHt),
    ecoContributionTotal: round2(ecoContributionTotal),
    totalHt: round2(subtotalHt),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

### 6.2 Agrégation anti-fractionnement

Quand un client crée une réservation, vérifier s'il a déjà des réservations actives sur le même container :

```typescript
// src/lib/pricing/aggregation.ts

export async function getCumulativeCbmForCompany(
  companyId: string,
  containerId: string,
  excludeReservationId?: string,
): Promise<number> {
  const { data } = await supabase
    .from('reservations')
    .select('total_cbm')
    .eq('company_id', companyId)
    .eq('container_id', containerId)
    .in('status', [
      'reserved',
      'pending_deposit',
      'deposit_paid',
      'pending_balance',
      'paid_full',
    ])
    .neq('id', excludeReservationId ?? '00000000-0000-0000-0000-000000000000')

  return (data ?? []).reduce((sum, r) => sum + Number(r.total_cbm), 0)
}

/**
 * Recalcule le pricing en tenant compte du CBM déjà engagé par le client
 * sur ce container.
 */
export async function calculatePricingWithExisting(
  newLines: CartLineForPricing[],
  companyId: string,
  containerId: string,
  tiers: PricingTier[],
): Promise<PricingResult> {
  const existingCbm = await getCumulativeCbmForCompany(companyId, containerId)

  // On crée une ligne "fantôme" représentant le CBM déjà engagé
  // pour démarrer le calcul incrémental au bon endroit
  const ghostLine: CartLineForPricing = {
    productId: '__existing__',
    variantId: null,
    variantCombinationId: null,
    quantity: 1,
    cbmPerUnit: existingCbm,
    costLanded: 0,
    ecoContribution: 0,
  }

  const result = calculateOrderPricing([ghostLine, ...newLines], tiers)

  // On retire la ligne fantôme du résultat
  return {
    ...result,
    lines: result.lines.slice(1),
    subtotalHt: result.subtotalHt,
    totalCbm: result.totalCbm - existingCbm,
  }
}
```

### 6.3 Calcul frais de réservation

```typescript
// src/lib/pricing/reservation-fee.ts

export interface ReservationFeeConfig {
  rate: number // 0.03
  min: number // 150
  max: number // 500
}

export function calculateReservationFee(
  subtotalHt: number,
  config: ReservationFeeConfig,
): number {
  const calculated = subtotalHt * config.rate
  const result = Math.min(Math.max(calculated, config.min), config.max)
  return Math.round(result * 100) / 100
}
```

### 6.4 Statut MOQ

```typescript
// src/lib/pricing/moq.ts

export interface MoqStatus {
  status: 'reached' | 'almost' | 'progressing' | 'starting' | 'empty'
  unitsCommitted: number
  unitsRequired: number
  unitsRemaining: number
  percent: number
  message: string
  colorClass: 'success' | 'amber' | 'neutral' | 'muted'
}

export function getMoqStatus(
  unitsCommitted: number,
  moqRequired: number,
): MoqStatus {
  const percent = (unitsCommitted / moqRequired) * 100
  const remaining = Math.max(0, moqRequired - unitsCommitted)

  if (unitsCommitted === 0) {
    return {
      status: 'empty',
      unitsCommitted,
      unitsRequired: moqRequired,
      unitsRemaining: remaining,
      percent: 0,
      message: 'Soyez le premier à engager cette série',
      colorClass: 'muted',
    }
  }
  if (unitsCommitted >= moqRequired) {
    return {
      status: 'reached',
      unitsCommitted,
      unitsRequired: moqRequired,
      unitsRemaining: 0,
      percent: 100,
      message: `✓ Série confirmée (${unitsCommitted}/${moqRequired})`,
      colorClass: 'success',
    }
  }
  if (percent >= 80) {
    return {
      status: 'almost',
      unitsCommitted,
      unitsRequired: moqRequired,
      unitsRemaining: remaining,
      percent,
      message: `Presque atteint ! Manque ${remaining} unités`,
      colorClass: 'amber',
    }
  }
  if (percent >= 40) {
    return {
      status: 'progressing',
      unitsCommitted,
      unitsRequired: moqRequired,
      unitsRemaining: remaining,
      percent,
      message: `En cours · Manque ${remaining} unités`,
      colorClass: 'amber',
    }
  }
  return {
    status: 'starting',
    unitsCommitted,
    unitsRequired: moqRequired,
    unitsRemaining: remaining,
    percent,
    message: `Démarrage · Manque ${remaining} unités`,
    colorClass: 'neutral',
  }
}
```

### 6.5 Programme fidélité

```typescript
// src/lib/pricing/loyalty.ts

export interface LoyaltyTier {
  minContainers: number
  discountPercent: number
}

export function getLoyaltyDiscount(
  companyContainersCompleted: number,
  tiers: LoyaltyTier[],
): number {
  const applicable = tiers
    .filter((t) => companyContainersCompleted >= t.minContainers)
    .sort((a, b) => b.discountPercent - a.discountPercent)
  return applicable[0]?.discountPercent ?? 0
}

export function applyLoyaltyDiscount(
  totalHt: number,
  containersCompleted: number,
  tiers: LoyaltyTier[],
): { discountPercent: number; discountAmount: number; totalAfter: number } {
  const discountPercent = getLoyaltyDiscount(containersCompleted, tiers)
  const discountAmount =
    Math.round(totalHt * (discountPercent / 100) * 100) / 100
  return {
    discountPercent,
    discountAmount,
    totalAfter: totalHt - discountAmount,
  }
}
```

### 6.6 Machine à états container

```typescript
// src/lib/container/status.ts

export type ContainerStatus =
  | 'draft'
  | 'open'
  | 'threshold_reached'
  | 'production'
  | 'manufactured'
  | 'shipped'
  | 'customs'
  | 'arrived'
  | 'delivered'
  | 'cancelled'

const ALLOWED_TRANSITIONS: Record<ContainerStatus, ContainerStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['threshold_reached', 'cancelled'],
  threshold_reached: ['production', 'cancelled', 'open'],
  production: ['manufactured', 'cancelled'],
  manufactured: ['shipped'],
  shipped: ['customs'],
  customs: ['arrived'],
  arrived: ['delivered'],
  delivered: [],
  cancelled: [],
}

export function canTransition(
  from: ContainerStatus,
  to: ContainerStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export interface ProductionConditions {
  fillPercent: number
  seriesReached: number
  minSeriesRequired: number
  thresholdPercent: number
  hasUnpaidDeposits: boolean
}

export function canStartProduction(c: ProductionConditions): {
  canStart: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  if (c.fillPercent < c.thresholdPercent) {
    reasons.push(
      `Remplissage ${c.fillPercent.toFixed(1)}% < ${c.thresholdPercent}%`,
    )
  }
  if (c.seriesReached < c.minSeriesRequired) {
    reasons.push(
      `${c.seriesReached} séries atteintes / ${c.minSeriesRequired} requises`,
    )
  }
  if (c.hasUnpaidDeposits) {
    reasons.push('Acomptes non encore tous payés')
  }

  return {
    canStart: reasons.length === 0,
    reasons,
  }
}
```

### 6.7 Calcul délai SAV selon type de défaut

```typescript
// src/lib/claims/sav.ts

export type ClaimType =
  | 'apparent_defect'
  | 'non_conformity'
  | 'hidden_defect'
  | 'transport_damage'

export interface ClaimRules {
  type: ClaimType
  maxDaysAfterDelivery: number
  requiresPhotos: boolean
  description: string
}

export const CLAIM_RULES: Record<ClaimType, ClaimRules> = {
  apparent_defect: {
    type: 'apparent_defect',
    maxDaysAfterDelivery: 2, // 48h
    requiresPhotos: true,
    description:
      'Défaut visible à la réception (casse, manquant, défaut esthétique évident)',
  },
  transport_damage: {
    type: 'transport_damage',
    maxDaysAfterDelivery: 2, // 48h
    requiresPhotos: true,
    description:
      'Dommage causé par le transport (à signaler aussi au transporteur)',
  },
  non_conformity: {
    type: 'non_conformity',
    maxDaysAfterDelivery: 14,
    requiresPhotos: true,
    description: 'Erreur de référence, couleur, dimensions, quantité manquante',
  },
  hidden_defect: {
    type: 'hidden_defect',
    maxDaysAfterDelivery: 730, // 2 ans = garantie légale
    requiresPhotos: true,
    description:
      'Vice caché découvert après usage normal (garantie légale 2 ans)',
  },
}

export function isClaimEligible(
  claimType: ClaimType,
  deliveredAt: Date,
  reportedAt: Date = new Date(),
): { eligible: boolean; daysElapsed: number; deadline: Date } {
  const rules = CLAIM_RULES[claimType]
  const msPerDay = 1000 * 60 * 60 * 24
  const daysElapsed = Math.floor(
    (reportedAt.getTime() - deliveredAt.getTime()) / msPerDay,
  )
  const deadline = new Date(
    deliveredAt.getTime() + rules.maxDaysAfterDelivery * msPerDay,
  )

  return {
    eligible: daysElapsed <= rules.maxDaysAfterDelivery,
    daysElapsed,
    deadline,
  }
}
```

### 6.8 Validation SIRET via API INSEE (V1.3)

**Quand vérifier ?** Le SIRET est demandé et vérifié **dès qu'un utilisateur veut** :

- Soumettre une réservation (paiement frais)
- Recevoir un devis par email
- Soumettre une demande de callback commercial

**Pas demandé** : lors de la simple navigation, ajout au panier, exploration du catalogue.

**Stratégie de validation en 3 étapes** :

```typescript
// src/lib/validation/siret.ts

export type SiretValidationResult =
  | { status: 'invalid_format'; reason: string }
  | { status: 'invalid_checksum'; reason: string }
  | { status: 'not_found'; reason: string }
  | { status: 'inactive'; reason: string; inactive_since?: string }
  | { status: 'duplicate'; reason: string; existing_company_id: string }
  | { status: 'verified'; data: SiretData }
  | {
      status: 'verification_unavailable'
      data: { format_ok: true }
      reason: string
    }

/**
 * Étape 1 : Validation algorithmique (offline, jamais bloquante)
 */
export function validateSiretFormat(siret: string): {
  valid: boolean
  reason?: string
} {
  const cleaned = siret.replace(/\s/g, '')

  // 14 chiffres exactement
  if (!/^\d{14}$/.test(cleaned)) {
    return {
      valid: false,
      reason: 'Le SIRET doit contenir exactement 14 chiffres',
    }
  }

  // Algorithme de Luhn modifié pour SIRET français
  // (le SIRET utilise une variante de Luhn — somme pondérée modulo 10)
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i])
    if (i % 2 === 0) digit *= 2 // poids 2 pour positions paires
    if (digit > 9) digit -= 9
    sum += digit
  }

  if (sum % 10 !== 0) {
    return {
      valid: false,
      reason: 'Numéro SIRET invalide (clé de contrôle incorrecte)',
    }
  }

  return { valid: true }
}

/**
 * Étape 2 : Vérification API INSEE avec cache
 */
export async function verifySiretWithInsee(
  siret: string,
): Promise<SiretValidationResult> {
  // 1. Validation algorithmique préalable
  const formatCheck = validateSiretFormat(siret)
  if (!formatCheck.valid) {
    return { status: 'invalid_format', reason: formatCheck.reason! }
  }

  // 2. Check cache local (table siret_cache, TTL 7j)
  const cached = await getCachedSiret(siret)
  if (cached && cached.expires_at > new Date()) {
    return interpretCachedResponse(cached)
  }

  // 3. Appel API INSEE via Edge Function
  try {
    const response = await callInseeApi(siret)

    if (!response.ok) {
      if (response.status === 404) {
        return {
          status: 'not_found',
          reason: "Ce SIRET n'existe pas dans le répertoire INSEE Sirene",
        }
      }
      // 5xx, timeout, etc. → fallback gracieux
      return {
        status: 'verification_unavailable',
        data: { format_ok: true },
        reason:
          'Service de vérification temporairement indisponible. Votre SIRET sera vérifié sous 24h.',
      }
    }

    const data = await response.json()

    // 4. Cache la réponse
    await cacheSiretResponse(siret, data)

    // 5. Vérifier statut entreprise
    if (data.etablissement.etatAdministratifEtablissement === 'F') {
      // Établissement fermé
      return {
        status: 'inactive',
        reason: "Cet établissement est fermé selon l'INSEE",
        inactive_since: data.etablissement.dateFermetureEtablissement,
      }
    }

    // 6. Vérifier non-duplication
    const existing = await findCompanyBySiret(siret)
    if (existing) {
      return {
        status: 'duplicate',
        reason: 'Ce SIRET est déjà associé à un compte existant',
        existing_company_id: existing.id,
      }
    }

    // 7. SIRET vérifié OK
    return {
      status: 'verified',
      data: extractSiretData(data),
    }
  } catch (err) {
    // Network error, timeout, etc.
    return {
      status: 'verification_unavailable',
      data: { format_ok: true },
      reason: 'Vérification temporairement indisponible',
    }
  }
}

export interface SiretData {
  siret: string
  siren: string
  legal_name: string // Raison sociale
  trading_name?: string // Nom commercial
  legal_form: string // SARL, SAS, EI, etc.
  legal_form_code: string // Code juridique INSEE
  naf_code: string // Ex: 5510Z
  naf_label: string // Ex: "Hôtels et hébergement similaire"
  address: {
    street: string
    postal_code: string
    city: string
    country: string
  }
  creation_date: string // ISO date
  is_active: boolean
  is_diffusable: boolean // false si statut "diffusion partielle"
  raw_response: object // payload brut INSEE
}

function extractSiretData(inseeResponse: any): SiretData {
  const etab = inseeResponse.etablissement
  const ul = etab.uniteLegale
  const adresse = etab.adresseEtablissement

  return {
    siret: etab.siret,
    siren: etab.siren,
    legal_name:
      ul.denominationUniteLegale ||
      `${ul.prenom1UniteLegale ?? ''} ${ul.nomUniteLegale ?? ''}`.trim(),
    trading_name: etab.denominationUsuelleEtablissement,
    legal_form: getLegalFormLabel(ul.categorieJuridiqueUniteLegale),
    legal_form_code: ul.categorieJuridiqueUniteLegale,
    naf_code: etab.activitePrincipaleEtablissement,
    naf_label: getNafLabel(etab.activitePrincipaleEtablissement),
    address: {
      street:
        `${adresse.numeroVoieEtablissement ?? ''} ${adresse.typeVoieEtablissement ?? ''} ${adresse.libelleVoieEtablissement ?? ''}`.trim(),
      postal_code: adresse.codePostalEtablissement ?? '',
      city: adresse.libelleCommuneEtablissement ?? '',
      country: 'FR',
    },
    creation_date: ul.dateCreationUniteLegale,
    is_active: etab.etatAdministratifEtablissement === 'A',
    is_diffusable: ul.statutDiffusionUniteLegale === 'O',
    raw_response: inseeResponse,
  }
}
```

**Comportement bloquant** (selon décision section 18.bis) :

| Cas                               | Action                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Format invalide                   | Erreur affichée, blocage formulaire                                                     |
| Checksum invalide                 | Erreur affichée, blocage formulaire                                                     |
| SIRET non trouvé INSEE            | Erreur affichée, blocage formulaire                                                     |
| Établissement fermé/cessé         | **Blocage strict**, message clair, suggestion contact admin                             |
| SIRET déjà utilisé (autre compte) | Blocage + suggestion "Vous avez peut-être déjà un compte"                               |
| API INSEE down                    | **Non bloquant** : on accepte, on flag `siret_verified = false`, re-vérif auto sous 24h |
| Verified OK                       | Auto-remplissage form, passage à l'étape suivante                                       |

**Edge Function `verify-siret`** :

```typescript
// supabase/functions/verify-siret/index.ts

Deno.serve(async (req) => {
  // 1. Auth requise (uniquement utilisateurs en cours de checkout)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  // 2. Rate limiting (30 req/min/user)
  const userId = await getUserIdFromToken(authHeader)
  const rateLimit = await checkRateLimit(`siret:${userId}`, 30, 60)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      event_type: 'rate_limit_hit',
      user_id: userId,
      metadata: { endpoint: 'verify-siret' },
    })
    return new Response('Too many requests', { status: 429 })
  }

  const { siret } = await req.json()

  // 3. Validation format
  const formatCheck = validateSiretFormat(siret)
  if (!formatCheck.valid) {
    await logSecurityEvent({
      event_type: 'siret_lookup_invalid',
      user_id: userId,
      metadata: { siret, reason: formatCheck.reason },
    })
    return new Response(
      JSON.stringify({
        status: 'invalid_format',
        reason: formatCheck.reason,
      }),
      { status: 400 },
    )
  }

  // 4. Check cache
  const cached = await getCachedSiret(siret)
  if (cached) return new Response(JSON.stringify(cached))

  // 5. OAuth INSEE (token cached côté serveur)
  const token = await getInseeAccessToken()

  // 6. Appel INSEE
  const response = await fetch(
    `${Deno.env.get('INSEE_API_BASE_URL')}/siret/${siret}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    if (response.status === 404) {
      await logSecurityEvent({
        event_type: 'siret_lookup_failed',
        user_id: userId,
        metadata: { siret, status: 404 },
      })
      return new Response(
        JSON.stringify({
          status: 'not_found',
        }),
        { status: 404 },
      )
    }
    // 5xx → fallback
    return new Response(
      JSON.stringify({
        status: 'verification_unavailable',
      }),
      { status: 200 },
    ) // pas d'erreur côté client, on accepte
  }

  const inseeData = await response.json()

  // 7. Cache 7 jours
  await cacheSiretResponse(siret, inseeData)

  // 8. Log success
  await logSecurityEvent({
    event_type: 'siret_lookup_success',
    user_id: userId,
    metadata: { siret },
  })

  // 9. Vérif duplication
  const existing = await findCompanyBySiret(siret)

  return new Response(
    JSON.stringify({
      status: existing ? 'duplicate' : 'verified',
      data: extractSiretData(inseeData),
      existing_company_id: existing?.id,
    }),
  )
})
```

**Cron de revérification** (Edge Function `recheck-pending-sirets`, quotidien) :

Pour tous les `companies.siret_verified = false`, relance la vérification INSEE. Si toujours en échec après 7 jours, alerte admin pour revue manuelle.

### 6.9 Validation email — Domaines personnels avec warning (V1.3)

**Décision** : tolérance souple. On affiche un warning mais on n'empêche pas la création de compte.

```typescript
// src/lib/validation/email.ts

const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.fr',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'laposte.net',
  'sfr.fr',
  'bbox.fr',
  'neuf.fr',
  'icloud.com',
  'me.com',
]

export function checkEmailDomain(email: string): {
  isPersonal: boolean
  domain: string
  showWarning: boolean
  warningMessage?: string
} {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  const isPersonal = PERSONAL_EMAIL_DOMAINS.includes(domain)

  return {
    isPersonal,
    domain,
    showWarning: isPersonal,
    warningMessage: isPersonal
      ? 'Cette adresse semble personnelle. Pour une activité professionnelle, nous recommandons fortement un email à votre nom de domaine. Vous pouvez continuer si nécessaire.'
      : undefined,
  }
}
```

**UX checkout** : si email perso → afficher un encart orange en bas du champ email avec le message + bouton "Je comprends, continuer" + bouton "Modifier mon email".

Le warning est tracé dans `security_events` (type `email_warning_shown`) pour analyse statistique : si X% des comptes sont créés avec email perso, peut-être ajuster la stratégie.

---

```typescript
// src/lib/claims/sav.ts

export type ClaimType =
  | 'apparent_defect'
  | 'non_conformity'
  | 'hidden_defect'
  | 'transport_damage'

export interface ClaimRules {
  type: ClaimType
  maxDaysAfterDelivery: number
  requiresPhotos: boolean
  description: string
}

export const CLAIM_RULES: Record<ClaimType, ClaimRules> = {
  apparent_defect: {
    type: 'apparent_defect',
    maxDaysAfterDelivery: 2, // 48h
    requiresPhotos: true,
    description:
      'Défaut visible à la réception (casse, manquant, défaut esthétique évident)',
  },
  transport_damage: {
    type: 'transport_damage',
    maxDaysAfterDelivery: 2, // 48h
    requiresPhotos: true,
    description:
      'Dommage causé par le transport (à signaler aussi au transporteur)',
  },
  non_conformity: {
    type: 'non_conformity',
    maxDaysAfterDelivery: 14,
    requiresPhotos: true,
    description: 'Erreur de référence, couleur, dimensions, quantité manquante',
  },
  hidden_defect: {
    type: 'hidden_defect',
    maxDaysAfterDelivery: 730, // 2 ans = garantie légale
    requiresPhotos: true,
    description:
      'Vice caché découvert après usage normal (garantie légale 2 ans)',
  },
}

export function isClaimEligible(
  claimType: ClaimType,
  deliveredAt: Date,
  reportedAt: Date = new Date(),
): { eligible: boolean; daysElapsed: number; deadline: Date } {
  const rules = CLAIM_RULES[claimType]
  const msPerDay = 1000 * 60 * 60 * 24
  const daysElapsed = Math.floor(
    (reportedAt.getTime() - deliveredAt.getTime()) / msPerDay,
  )
  const deadline = new Date(
    deliveredAt.getTime() + rules.maxDaysAfterDelivery * msPerDay,
  )

  return {
    eligible: daysElapsed <= rules.maxDaysAfterDelivery,
    daysElapsed,
    deadline,
  }
}
```

---

## 7. SPÉCIFICATIONS PAR PAGE

### 7.1 Home `/`

Architecture verticale (mobile-first), 9 sections :

**A. Header sticky (h-14 mobile / h-16 desktop)**

- Logo monogramme "C" + wordmark
- Desktop nav : Catalogue / Comment ça marche / Containers livrés / FAQ / Mon compte
- Mobile : burger menu (Sheet shadcn)
- Indicateur Realtime discret (petit dot vert "● Live")
- Bouton callback flottant : "💬 Discuter avec un expert" (fixed bottom-right, mobile en bas avant sticky cart)

**B. Hero**

- Badge dynamique haut : "🟢 Container CC-2026-001 — Marseille — J-{X} — {%} rempli"
- H1 : "Mobilier outdoor pro, direct usine, sans intermédiaire"
- Sous-titre : "Pré-commande groupée par container 20'. Le prix d'un grossiste pro, la qualité d'un revendeur premium. Engagez-vous à partir de 150€."
- 3 chips réassurance horizontales :
  - 🇫🇷 Importateur officiel français
  - ✓ Contrôle qualité SGS systématique
  - 🛡️ Garantie 2 ans + SAV France
- Photo container ports (lifestyle, pas générique)
- CTA principal "Explorer le catalogue" + CTA secondaire "Comment ça marche"

**C. Section "Pourquoi Container Club" (3 piliers)**
3 cards : Direct usine / Groupé entre pros / Tout est géré pour vous

**D. Comment ça marche (timeline 5 étapes)**
Voir détails dans home spec.

**E. Tableau comparatif générique** (nouveau)
Comparaison Container Club vs Grossistes pro standard vs Revendeurs spécialisés français. Sans noms ni chiffres exacts, format qualitatif :

```
                        │ Container │ Grossistes │ Revendeurs │
                        │ Club      │ pro std    │ spécialisés│
────────────────────────┼───────────┼────────────┼────────────┤
Prix HT/unité           │ €€        │ €€         │ €€€        │
Rotin garanti UV 5 ans  │ ✅        │ ❓         │ Variable   │
Certification M1/M2     │ ✅        │ ❌         │ Variable   │
Rapport SGS disponible  │ ✅        │ ❌         │ Variable   │
Garantie                │ 2 ans FR  │ 1 an       │ Variable   │
Origine transparente    │ ✅        │ ❌         │ Variable   │
SAV France              │ ✅        │ Partiel    │ ✅         │
Conformité REACH        │ ✅        │ ❓         │ Variable   │
```

**F. Catalogue (ancre `#catalogue`)** — section principale

Mobile : filtres pills horizontaux scrollables, ProductCard verticale.
Desktop : 2 colonnes 60/40 avec sidebar 3D sticky.

Filtres : Tous / Chaise / Fauteuil / Table / Banc
Tri : Prix croissant, décroissant, Volume CBM, Popularité (reviews)

**ProductRow desktop** — voir mockup section précédente.

**ProductCard mobile** — voir mockup section précédente.

**Pour les tables (multi-variantes)** : composant `TableConfigurator` dédié qui présente :

1. Choix configuration plateau (cards visuelles : Rond 80, Carré 70, Rect 160×80, Pied seul -30%)
2. Si plateau choisi → choix couleur plateau (4 swatches)
3. Choix finition pied (2 swatches)
4. MOQ s'applique sur la combinaison complète

**G. Bloc livraison rendue port** (V1.2 — nouveau)

Encart dédié juste avant la section "Containers livrés", explicite et assumé :

```
┌─────────────────────────────────────────────────────────────┐
│ 🚚 COMMENT LA LIVRAISON FONCTIONNE                          │
│                                                             │
│ Notre prix s'arrête au port d'arrivée (Le Havre ou         │
│ Marseille-Fos). Pour la livraison finale jusqu'à chez       │
│ vous, deux options :                                        │
│                                                             │
│ 📦 Enlèvement libre au port                                 │
│    Vous récupérez avec votre propre transporteur           │
│                                                             │
│ 🤝 Faire appel à un transporteur                            │
│    Nous vous fournissons une liste de partenaires          │
│    présélectionnés à contacter directement                 │
│                                                             │
│ Pourquoi ? Transparence sur les coûts (variables selon     │
│ votre zone), liberté de choix de votre transporteur, et    │
│ aucune marge cachée sur le transport.                       │
│                                                             │
│ [ Voir nos transporteurs recommandés → ]                    │
└─────────────────────────────────────────────────────────────┘
```

Le bouton mène vers `/transport-partenaires`.

**H. Containers livrés (preuve sociale)**
Grid 3 cards desktop / scroll horizontal mobile.

**I. FAQ Accordion** (5 questions principales) + lien "/faq" complet.

**J. CTA final + Footer**

### 7.2 Détail container `/containers/[ref]`

Page publique (SEO friendly) :

- Header : référence, port, statut, dates clés
- Visualisation 3D plein largeur
- Participants anonymisés ("Un professionnel du sud de la France — 60 chaises Cannes Beige")
- Détail séries déclenchées
- Compte à rebours clôture
- CTA "Rejoindre ce container"
- Pour containers passés : galerie photo + témoignages

### 7.3 Historique `/containers/historique`

Tous les containers (filtres par port, année, statut). SEO majeur.

### 7.4 Espace client `/account/*`

**`/account`** — Dashboard avec stats personnelles
**`/account/reservations`** — Liste + détails
**`/account/invoices`** — Factures PDF
**`/account/documents`** — Bibliothèque rapports SGS, certificats (clients connectés)
**`/account/referrals`** — Code parrainage + stats
**`/account/reviews`** — Mes avis sur commandes livrées
**`/account/claims`** — Mes réclamations SAV avec statut
**`/account/settings`** — Profil société

### 7.5 Admin `/admin/*`

Dashboard, gestion containers/produits/réservations/companies/pricing/callbacks/reviews/claims/countries/reports.

### 7.6 Page transport partenaires `/transport-partenaires` (V1.2)

Page publique dédiée à la liste des transporteurs recommandés. **SEO friendly**, indexable.

**Structure** :

**Header**

- Titre H1 : "Transporteurs recommandés"
- Sous-titre : "Container Club ne facture pas la livraison finale. Vous contactez directement le transporteur de votre choix qui établira un devis selon vos besoins."

**Section "Pourquoi cette approche"** (texte assumé)

> "Nous avons choisi de ne pas inclure la livraison du port jusqu'à votre établissement dans nos prix. Trois raisons : transparence (les coûts varient selon votre zone), choix (vous gardez la main sur votre transporteur), simplicité pour vous (un appel, un devis, vous décidez). Cette approche nous permet de garder nos prix imbattables sans marge cachée sur le transport."

**Tarifs indicatifs** (encart informatif, pas un engagement)

```
FOURCHETTES INDICATIVES (8-12 palettes depuis Le Havre/Marseille)

Zone proche      (< 200 km)  → 200-300€
Zone moyenne     (200-500 km) → 350-500€
Zone lointaine   (500-900 km) → 600-800€
Zone extrême     (> 900 km / Corse / DOM) → Sur devis

Ces fourchettes sont indicatives. Le tarif définitif est établi
par le transporteur selon votre configuration précise (accessibilité,
créneau, urgence).
```

**Liste des transporteurs** (issue de `carrier_partners`)

Pour chaque transporteur, une card :

```
┌──────────────────────────────────────────────────────────┐
│ [Logo]  GEODIS DISTRIBUTION                              │
│         Réseau national palette                          │
│                                                          │
│ Spécialités : Palette · National · Mobilier             │
│ Couverture : France métropolitaine                       │
│ Délai moyen : 3 jours ouvrés                             │
│                                                          │
│ Tarifs indicatifs :                                      │
│ • Zone proche : 220-280€                                 │
│ • Zone moyenne : 380-480€                                │
│ • Zone lointaine : 620-780€                              │
│                                                          │
│ 📞 Tél : 01 XX XX XX XX                                  │
│ 🌐 Devis en ligne : geodis.com/devis-palette             │
│ 📧 Email : ...                                           │
│                                                          │
│ 💡 Mentionnez "Container Club" pour suivi prioritaire    │
│                                                          │
│ [ Demander un devis ]                                    │
└──────────────────────────────────────────────────────────┘
```

**FAQ transport** en bas de page (5-6 questions essentielles) :

1. Comment se passe l'enlèvement au port ?
2. Que dois-je communiquer au transporteur ?
3. Quand puis-je organiser le transport ?
4. Que se passe-t-il en cas de dommage pendant le transport ?
5. Puis-je utiliser un transporteur qui n'est pas dans votre liste ?
6. Acceptez-vous d'organiser le transport pour moi ?

**CTA en bas** : "Besoin d'aide pour choisir ? Demandez à être rappelé"

### 7.7 Pages secondaires

**`/comment-ca-marche`** — Timeline détaillée + FAQ par étape
**`/faq`** — FAQ complète recherchable
**`/conditions/cgv`** — CGV B2B blindées (voir section 18)
**`/conditions/remboursement`** — Politique remboursement détaillée
**`/conditions/confidentialite`** — RGPD
**`/conditions/mentions-legales`** — Mentions complètes
**`/contact`** — Formulaire + callback option

---

## 8. SYSTÈME TEMPS RÉEL

### 8.1 Architecture

Supabase Realtime (WebSocket) sur 4 tables :

- `containers` (changements statut)
- `container_metrics` (% fill, séries, pros engagés)
- `moq_pools` (MOQ atteint par variante)
- `reservations` (nouvelles réservations)

### 8.2 Hook React

```typescript
// src/hooks/useContainerRealtime.ts
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useContainerStore } from '@/stores/realtime.store'
import { toast } from '@/lib/toast'

export function useContainerRealtime(containerId: string) {
  const update = useContainerStore((s) => s.updateFromRealtime)

  useEffect(() => {
    if (!containerId) return

    let toastQueue: string[] = []
    let toastTimer: number | null = null

    const flushToasts = () => {
      if (toastQueue.length > 0) {
        const message = toastQueue[toastQueue.length - 1]
        toast.success(message)
        toastQueue = []
      }
      toastTimer = null
    }

    const queueToast = (message: string) => {
      toastQueue.push(message)
      if (!toastTimer) {
        toastTimer = window.setTimeout(flushToasts, 60_000) // max 1/min
      }
    }

    const channel = supabase
      .channel(`container-${containerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'container_metrics',
          filter: `container_id=eq.${containerId}`,
        },
        (payload) => {
          const newMetrics = payload.new as any
          const oldMetrics = payload.old as any
          update.metrics(newMetrics)

          // Toasts subtils sur paliers
          const newFill = Number(newMetrics.fill_percent)
          const oldFill = Number(oldMetrics?.fill_percent ?? 0)
          if (oldFill < 50 && newFill >= 50)
            queueToast('Container à 50% de remplissage 🎯')
          if (oldFill < 70 && newFill >= 70)
            queueToast('Container à 70% — plus que 10% avant production')
          if (oldFill < 80 && newFill >= 80)
            queueToast('🎉 Container à 80% — production lancée !')
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'moq_pools',
          filter: `container_id=eq.${containerId}`,
        },
        (payload) => {
          const pool = payload.new as any
          const oldPool = payload.old as any
          update.moqPool(pool)

          if (!oldPool?.is_reached && pool.is_reached) {
            queueToast("Une nouvelle série vient d'être confirmée ✓")
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
          filter: `container_id=eq.${containerId}`,
        },
        () => {
          queueToast('Un professionnel vient de rejoindre ce container 🤝')
        },
      )
      .subscribe()

    return () => {
      if (toastTimer) window.clearTimeout(toastTimer)
      supabase.removeChannel(channel)
    }
  }, [containerId, update])
}
```

### 8.3 Notifications anonymisées (validé)

**Format obligatoire** : "Un professionnel vient de rejoindre ce container"  
**JAMAIS** : "Restaurant La Pizza à Lyon vient de réserver 40 chaises"

Pas de mention de ville, nom, type d'établissement. Anonymisation totale pour conformité RGPD et discrétion B2B.

### 8.4 Animations

Sur la barre de remplissage : transition CSS fluide (`transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1)`).

Sur la scène 3D : nouveaux blocs apparaissent avec animation drei `<animated.mesh>` (spring fade-in + scale-up).

Sur les pastilles MOQ : pulse animation quand seuil franchi.

---

## 9. DOCUMENTS QUALITÉ (RAPPORTS SGS)

### 9.1 Accès restreint

**Décision validée** : documents uniquement accessibles aux **clients connectés** (auth required).

Justification : éviter pillage concurrent, créer valeur ajoutée à la création de compte.

RLS Supabase :

```sql
create policy "Authenticated users see published documents"
  on product_documents for select
  using (auth.role() = 'authenticated' and is_published = true);
```

### 9.2 Types de documents supportés

- `test_report` — Rapport SGS / Bureau Veritas
- `fire_certificate` — Certificat norme feu M1/M2
- `reach_compliance` — Conformité REACH
- `tech_sheet` — Fiche technique
- `warranty_terms` — Conditions garantie
- `assembly_guide` — Notice montage
- `care_instructions` — Entretien
- `material_origin` — Origine matériaux
- `sustainability` — Certifications durabilité

### 9.3 UI fiche produit

Si utilisateur non connecté → bandeau :

```
🔒 Documents qualité (rapports SGS, certifications)
   Connectez-vous pour consulter les 4 documents disponibles
   [ Se connecter ]
```

Si utilisateur connecté → liste documents téléchargeables (PDF via signed URL Supabase Storage).

### 9.4 Bibliothèque centralisée `/account/documents`

Pour les clients connectés : tous les documents de tous les produits qu'ils ont commandés (ou consultés), classés par catégorie. Permet par exemple à un acheteur de retrouver le certificat M2 d'une chaise qu'il a achetée il y a 6 mois pour son contrôle ERP.

---

## 10. PROGRAMME PARRAINAGE

### 10.1 Mécanique (validée, montants ajustables)

- **Parrain reçoit** : crédit défini dans `app_config.referral_program.referrer_credit` (200€ par défaut)
- **Filleul reçoit** : réduction sur frais réservation `app_config.referral_program.referred_discount` (100€ par défaut)
- **Validation** : le filleul doit aller jusqu'au paiement des frais
- **Crédit parrain** : utilisable 12 mois, sur n'importe quelle commande future
- **Max 10 parrainages réussis** par parrain (anti-abuse, ajustable)

### 10.2 Flow

```
1. Pierre se connecte → voit son code "PIERRE-X7K9-2026" dans /account/referrals
2. Pierre partage le lien containerclub.fr/?ref=PIERRE-X7K9-2026
3. Marc clique → cookie `ref_code` posé
4. Marc explore, crée son panier, va payer
5. Sur le formulaire de réservation, badge "Parrainé par Pierre — 100€ de réduction"
6. Marc paie ses frais (par exemple 250€ réduits à 150€)
7. Webhook Stripe → création row `referrals` avec status='pending'
8. Une fois la réservation confirmée → status='validated', crédit 200€ créé pour Pierre
9. Email à Pierre : "Marc a rejoint Container Club grâce à vous, 200€ crédités"
10. Pierre utilise son crédit sur sa prochaine commande
```

### 10.3 UX `/account/referrals`

```
┌──────────────────────────────────────────┐
│ MON CODE DE PARRAINAGE                    │
│                                          │
│ CONTAINER-PIERRE-X7K9                     │
│ [ 📋 Copier ]                            │
│                                          │
│ Mon lien :                               │
│ containerclub.fr/?ref=CONTAINER-PIERRE-X7K9 │
│ [ 📤 Partager ] [WhatsApp] [Email] [LI]  │
├──────────────────────────────────────────┤
│ MES STATISTIQUES                          │
│                                          │
│ 👥 Pros parrainés    3                   │
│ 🎁 Crédits gagnés    600€                │
│ 💳 Crédits dispo    400€                 │
│ ⏳ En attente        1                   │
├──────────────────────────────────────────┤
│ HISTORIQUE                                │
│                                          │
│ ✅ Restaurant L'Olive · 12/03 · +200€    │
│ ✅ Hôtel Plage · 28/02 · +200€           │
│ ⏳ Camping Soleil · en cours             │
└──────────────────────────────────────────┘
```

### 10.4 Sécurité

- Anti-fraude : email du filleul doit différer de tous les emails du parrain
- Anti-auto-parrainage : SIRET différent obligatoire
- Code rate-limited : 100 utilisations/jour max par code (anti-spam)

---

## 11. SYSTÈME DE NOTATION

### 11.1 Mécanique

- Reviews uniquement sur réservations `paid_full` et container `delivered`
- Trigger email automatique 30 jours après livraison
- 1 review max par réservation
- Modération admin avant publication (statut `is_published`)
- Possibilité droit de réponse admin (visible publiquement)
- Pas de suppression possible par le client (intégrité)

### 11.2 Notes détaillées

Note globale (obligatoire 1-5) + 4 notes optionnelles :

- Qualité produits
- Rapport qualité/prix
- Livraison
- Communication

### 11.3 UX

**Sur fiche produit (en bas)** :

```
⭐⭐⭐⭐☆ 4,6/5  (47 avis vérifiés)

▓▓▓▓▓▓▓▓▓░ 38 avis 5⭐
▓▓▓▓░░░░░░  6 avis 4⭐
▓░░░░░░░░░  2 avis 3⭐
░░░░░░░░░░  1 avis 2⭐

Filtrer : [Tous] [5⭐] [4⭐] [Avec photos]
Trier : [Plus utiles ↓] [Plus récents] [Plus anciens]

[Liste des avis individuels]
```

**Card avis individuel** :

```
⭐⭐⭐⭐⭐
"Excellente qualité, exactement comme décrit"
— Hôtellerie · Achat vérifié · 15 mars 2026

Détails : Qualité ⭐⭐⭐⭐⭐ · Rapport prix ⭐⭐⭐⭐
          Livraison ⭐⭐⭐⭐⭐ · Communication ⭐⭐⭐⭐⭐

[Texte du commentaire...]

[📷 Photo 1] [📷 Photo 2]

👍 Utile (12) · 🚩 Signaler

↳ Réponse de Container Club :
   "Merci beaucoup pour votre retour ! ..."
```

### 11.4 Schema.org pour SEO

Implémentation `AggregateRating` et `Review` sur les fiches produits :

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Chaise Cannes Empilable",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.6",
      "reviewCount": "47"
    },
    "review": [
      {
        "@type": "Review",
        "author": "Hôtellerie",
        "datePublished": "2026-03-15",
        "reviewRating": { "ratingValue": "5" },
        "reviewBody": "..."
      }
    ]
  }
</script>
```

---

## 12. CALLBACK REQUESTS

### 12.1 Mécanique

Bouton "Discuter avec un expert" visible :

- Header desktop (top right)
- Bouton flottant mobile (bottom right, au-dessus sticky cart)
- Fin de fiche produit pour les produits >5 unités MOQ
- Modal réservation pour panier >2000€

### 12.2 Formulaire ultra-court

```
┌──────────────────────────────────────────┐
│ 💬 Échangeons par téléphone               │
│                                          │
│ Nous vous rappelons sous 2h ouvrées      │
│                                          │
│ Nom complet *                            │
│ [____________________________________]   │
│                                          │
│ Société *                                │
│ [____________________________________]   │
│                                          │
│ Téléphone *                              │
│ [____________________________________]   │
│                                          │
│ Quand vous rappeler ?                    │
│ ○ Dans l'heure                           │
│ ○ Cet après-midi                         │
│ ○ Demain matin                           │
│ ○ Demain après-midi                      │
│ ○ Choisir une autre date                 │
│                                          │
│ Sujet                                    │
│ [Question produit         v]             │
│                                          │
│ [   Demander mon rappel   ]              │
│                                          │
│ Horaires : 9h-18h du lundi au vendredi   │
└──────────────────────────────────────────┘
```

### 12.3 Validation horaires

Si l'utilisateur choisit "Dans l'heure" hors horaires ouvrés → message :
"Nous sommes actuellement fermés (horaires : 9h-18h). Préférez-vous être rappelé demain matin dès 9h ?"

### 12.4 Admin

Dashboard `/admin/callbacks` :

- Liste triée par urgence (créneaux les plus proches en haut)
- Notifications Slack/email à chaque nouvelle demande
- Bouton "Marquer comme appelé" + champ notes + outcome
- SLA visible : "X demandes en attente, dont Y dans <2h"

---

## 13. AUTO-OUVERTURE CONTAINERS

### 13.1 Trois modes (config `container_auto_open_mode`)

**Mode `manual`** (recommandé pour démarrage)

- Aucune auto-ouverture
- L'admin crée chaque nouveau container manuellement
- Le système peut juste **suggérer** : "Le container CC-2026-001 est passé en production il y a 7 jours, ouvrir CC-2026-002 ?"

**Mode `semi_auto`**

- Détection automatique des conditions
- Notification admin avec bouton "Approuver l'ouverture"
- 1 clic confirme et ouvre le nouveau container

**Mode `full_auto`**

- Ouverture automatique sans intervention
- Garde-fous : max 1 container `open` par port simultanément
- Notification admin systématique avec possibilité d'annuler dans les 24h

### 13.2 Edge Function `auto-open-container`

```typescript
// supabase/functions/auto-open-container/index.ts

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async () => {
  // Lire la config du mode
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'container_auto_open_mode')
    .single()

  const mode = (config?.value as string) ?? 'manual'

  if (mode === 'manual') {
    // Juste générer une notification admin si conditions remplies
    await suggestNewContainerToAdmin()
    return new Response('Manual mode — admin notified if applicable')
  }

  // Récupère les ports actifs
  const { data: ports } = await supabase
    .from('ports')
    .select('*')
    .eq('is_active', true)

  for (const port of ports ?? []) {
    // Vérifie qu'aucun container 'open' n'existe pour ce port
    const { count: openCount } = await supabase
      .from('containers')
      .select('*', { count: 'exact', head: true })
      .eq('port_id', port.id)
      .eq('status', 'open')

    if ((openCount ?? 0) > 0) continue

    // Récupère le dernier container de ce port
    const { data: lastContainer } = await supabase
      .from('containers')
      .select('*')
      .eq('port_id', port.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Conditions d'ouverture du suivant
    const shouldOpen =
      !lastContainer ||
      [
        'production',
        'manufactured',
        'shipped',
        'customs',
        'arrived',
        'delivered',
      ].includes(lastContainer.status)

    if (!shouldOpen) continue

    // Génère la référence
    const year = new Date().getFullYear()
    const { count: yearCount } = await supabase
      .from('containers')
      .select('*', { count: 'exact', head: true })
      .like('reference', `CC-${year}-%`)

    const newRef = `CC-${year}-${String((yearCount ?? 0) + 1).padStart(3, '0')}`

    // Calcul date de clôture estimée (35 jours)
    const expectedCloseAt = new Date()
    expectedCloseAt.setDate(expectedCloseAt.getDate() + 35)

    // Créer
    const { data: newContainer } = await supabase
      .from('containers')
      .insert({
        reference: newRef,
        port_id: port.id,
        country_code: port.country_code,
        capacity_cbm: 28,
        threshold_percent: 80,
        min_series_required: 3,
        status: mode === 'full_auto' ? 'open' : 'draft',
        opened_at: mode === 'full_auto' ? new Date().toISOString() : null,
        expected_close_at: expectedCloseAt.toISOString(),
      })
      .select()
      .single()

    if (mode === 'semi_auto') {
      // Notifier admin pour validation
      await notifyAdmin('Nouveau container prêt à être ouvert', newContainer)
    } else {
      // Full auto : créer pools MOQ automatiquement pour tous les produits actifs
      await createMoqPoolsForContainer(newContainer.id)

      // Email broadcast aux clients existants
      await broadcastNewContainerEmail(newContainer)
    }
  }

  return new Response('OK')
})
```

### 13.3 Cron

Cette function tourne quotidiennement à 7h via Supabase scheduled tasks.

### 13.4 Toggle admin

Page `/admin/settings` permet de basculer le mode :

```
Mode auto-ouverture
○ Manual (recommandé pour démarrage)
○ Semi-auto (notification + 1 clic)
● Full auto (totalement automatique)
```

Changement immédiat, audit log.

---

## 14. ARCHITECTURE MULTI-PAYS

### 14.1 Approche

Système entièrement préparé pour multi-pays dès le départ, mais **seul `FR` est activé** au lancement (champ `is_active = true`).

### 14.2 Comment l'ajout d'un pays se passe (futur)

Pour activer l'Espagne par exemple, l'admin :

1. `UPDATE countries SET is_active = true WHERE code = 'ES'`
2. Ajoute ses ports (Barcelone, Valence) via admin `/admin/countries`
3. Ajoute des transporteurs partenaires couvrant l'Espagne via `/admin/carriers`
4. Crée un premier container destination ES
5. Le site bascule automatiquement : sélecteur pays visible, contenu adapté

**Note V1.2** : la gestion des zones de livraison + facturation transport (tables `delivery_zones` et `postal_code_zones`) sera réintroduite en V2 quand Container Club aura signé des contrats-cadres transporteurs et facturera lui-même. En attendant, chaque pays a sa liste de `carrier_partners` que le client contacte directement.

### 14.3 Sélection de pays côté client

**Phase 1 (FR uniquement)** : pas de sélecteur visible, FR est implicite.

**Phase 2+ (multi-pays)** :

- Bannière haut : "🇫🇷 Vous êtes en France · Changer"
- Détection auto via IP (geo Cloudflare)
- Stocké en cookie + `country.store.ts`
- Le catalogue ne change pas (même produits) mais :
  - Les containers affichés sont filtrés par pays
  - Le calcul de livraison utilise les zones du pays
  - La langue de l'interface s'adapte
  - La TVA appliquée est celle du pays
  - L'utilisateur peut volontairement changer

### 14.4 i18n

Structure prête dans `src/lib/i18n/locales/` :

- `fr.ts` (complet au lancement)
- `en.ts` (Lorem ipsum / placeholder, activable plus tard)
- `es.ts`, `it.ts`, `de.ts` (placeholders)

Hook `useTranslation` minimal :

```typescript
export function useTranslation() {
  const locale = useCountryStore((s) => s.locale)
  return {
    t: (key: string) => getTranslation(locale, key) ?? key,
    locale,
  }
}
```

Système simple basé sur des objets imbriqués, sans dépendance externe lourde (pas i18next pour MVP). Évolution possible si besoin.

### 14.5 URLs

- Phase 1 : URLs neutres `/produits`, `/account`, etc.
- Phase 2 : URLs préfixées `/fr/`, `/es/`, `/it/`, `/de/` pour SEO international

Le routing TanStack Start supporte ça nativement via param dynamique.

---

## 15. DIRECTION ARTISTIQUE

### 15.1 Palette CSS

```css
/* src/styles/globals.css */
@layer base {
  :root {
    /* Backgrounds */
    --color-bg-base: #f4ede1;
    --color-bg-alt: #faf6ee;
    --color-bg-elevated: #ffffff;
    --color-bg-dark: #1a1a1c;

    /* Texte */
    --color-text-primary: #1a1a1c;
    --color-text-secondary: #5a544a;
    --color-text-muted: #8a8276;
    --color-text-on-dark: #faf6ee;

    /* Accents */
    --color-accent-primary: #b85c1f;
    --color-accent-hover: #9d4d18;
    --color-accent-light: #f4e3d1;

    /* Bordures */
    --color-border-base: #e8dfd0;
    --color-border-strong: #c9bfac;

    /* États */
    --color-success: #3a5a3a;
    --color-success-bg: #e8eee0;
    --color-warning: #9a7b2a;
    --color-warning-bg: #f4ecd6;
    --color-danger: #8a3a2a;
    --color-danger-bg: #f0d8cc;
    --color-info: #3a4f6a;
    --color-info-bg: #d8e0e8;

    /* CTAs */
    --color-cta-primary: #1a1a1c;
    --color-cta-primary-hover: #2a2a2c;
    --color-cta-text: #faf6ee;
  }
}
```

### 15.2 Typographie

Police principale : Inter (Google Fonts) + JetBrains Mono pour les références et montants.

Hiérarchie clamp pour responsive automatique :

- Display : `clamp(2rem, 5vw, 3.5rem)` letter-spacing -0.04em
- H1 : `clamp(1.75rem, 4vw, 2.5rem)` letter-spacing -0.03em
- H2 : `clamp(1.5rem, 3vw, 2rem)` letter-spacing -0.02em
- H3 : 1.25rem letter-spacing -0.01em
- Body : 1rem line-height 1.6
- Label : 0.75rem UPPERCASE letter-spacing 0.1em

### 15.3 Composants

Bordures fines (1px), coins arrondis modérés (4-8px), ombres subtiles uniquement (`0 1px 2px rgba(0,0,0,0.04)` au repos).

Esthétique éditoriale premium, jamais brillante ou tech criarde.

---

## 16. MOBILE OPTIMISATION

### 16.1 Principes absolus

- Mobile-first dans tous les composants
- Touch targets ≥ 44×44 px
- Breakpoints : sm 640 / md 768 / lg 1024 / xl 1280
- Test prioritaire : iPhone SE 2 (375px), iPhone 14 Pro (393px), Galaxy S22 (360px), iPad mini (768px)

### 16.2 Performance

Cibles :

- LCP < 2.5s sur 4G
- INP < 200ms
- CLS < 0.1
- Bundle JS initial < 200kb gzipped

Stratégies :

- Code splitting par route (TanStack Start natif)
- Lazy load 3D scene, modals, composants lourds
- Images Cloudflare Images avec srcset auto WebP/AVIF
- Preload polices critiques (Inter Regular 400 + Semibold 600)

### 16.3 Forms mobile

Toujours :

- `inputmode` correct (email, tel, numeric)
- `autocomplete` correct (email, tel, organization, postal-code, given-name, family-name)
- Stepper +/- pour quantités (pas input number sur mobile)
- Validation debounced 500ms
- Erreurs sous le champ avec icône

### 16.4 Catalogue mobile

ProductCard verticale, quick-add bouton, filtres en Sheet bottom-up.

### 16.5 3D mobile

- `<Canvas dpr={[1, 1.5]}>` (pas retina 3x)
- Pas d'environnement HDR
- Auto-rotate désactivé par défaut
- Bouton "Voir en 3D plein écran" plutôt qu'inline
- Fallback image statique si WebGL non disponible ou détecté lent

### 16.6 Sticky cart bar

Visible dès 1 item au panier, hauteur 56px, fixed bottom :

```
3 articles · 72% rempli · 4 943€ HT     [ Réserver → ]
```

### 16.7 Checkout (V1.3 — flow en 4 étapes avec SIRET obligatoire)

**Étape 1 — Identification professionnelle** (V1.3 — NOUVELLE)

```
┌─────────────────────────────────────────────────────────────┐
│ VOS INFORMATIONS PROFESSIONNELLES                            │
│                                                              │
│ Numéro SIRET (14 chiffres) *                                │
│ [____________________________]                              │
│ ⓘ Le SIRET de l'établissement de facturation                │
│                                                              │
│ [ 🔍 Vérifier mon SIRET ]                                    │
│                                                              │
│ ─── Après vérification API INSEE réussie ───                │
│                                                              │
│ ✓ HOTEL DU SOLEIL                                            │
│ ✓ 13 Rue de la Plage, 06400 Cannes                          │
│ ✓ Hôtellerie (code NAF 5510Z)                                │
│ ✓ SAS · Active depuis 2015                                   │
│                                                              │
│ [ ✓ Ce sont mes informations ]                              │
│                                                              │
│ Si erreur : message explicite + bouton "Modifier SIRET"     │
└─────────────────────────────────────────────────────────────┘
```

**Cas d'erreur SIRET** (selon section 6.8) :

- Format invalide → message inline "Format incorrect (14 chiffres attendus)"
- Non trouvé INSEE → "Ce SIRET n'existe pas. Vérifiez votre saisie."
- **Établissement cessé** → "Cet établissement est fermé selon l'INSEE. Si vous pensez qu'il s'agit d'une erreur, [contactez-nous]." → **blocage strict**
- **SIRET déjà utilisé** → "Ce SIRET est déjà associé à un compte. [Se connecter] ou [Réinitialiser le mot de passe]."
- API INSEE indisponible → "Vérification temporairement indisponible. Vous pouvez continuer, votre SIRET sera vérifié sous 24h." → **non bloquant**

**Étape 2 — Coordonnées de contact**

```
Nom complet *      [________________]  (autocomplete name)
Email pro *        [________________]  (autocomplete email)
Téléphone *        [________________]  (autocomplete tel)
```

**Validation email** :

- Si domaine personnel (gmail, yahoo, etc.) → encart orange visible :

```
⚠️ Cette adresse semble personnelle. Pour une activité
   professionnelle, nous recommandons un email à votre nom
   de domaine. Vous pouvez continuer si nécessaire.
   [ Je comprends, continuer ]  [ Modifier mon email ]
```

**Étape 3 — Mode de livraison** (V1.2, inchangé)

```
● Enlèvement libre au port (gratuit)
○ J'ai déjà mon transporteur habituel
○ Je souhaite être mis en relation avec un transporteur

Note optionnelle : ____________________________________
```

**Étape 4 — Récap + paiement**

- Récap commande (items, prix, économies, frais réservation)
- **Acceptation CGV obligatoire** (case à cocher avec lien vers CGV)
- Stripe Payment Element (3DS2 systématique)
- Apple Pay / Google Pay activés
- Stripe Radar actif (anti-fraude automatique)

**Aucune facturation de transport** à aucune étape. Le `delivery_fee` reste à 0 en V1.

**Création compte automatique** :

- Pas de "create account" forcé
- Magic link envoyé après paiement réussi
- Toutes les données SIRET et contact sont stockées dans `companies` et `users_profile`
- `siret_verified = true` si l'API INSEE a répondu OK, sinon `false` avec re-vérification cron quotidien

**Indicateur de progression** :

```
[Étape 1: SIRET ✓] [Étape 2: Contact ✓] [Étape 3: Livraison ✓] [Étape 4: Paiement ●]
```

---

## 17. SEO / GEO / LLM

### 17.1 SEO classique

**Pages indexables prioritaires** :

- `/` (catalogue principal)
- `/produits/[slug]` (futur, page produit dédiée par produit)
- `/containers/[ref]` (chaque container = une page riche)
- `/containers/historique`
- `/comment-ca-marche`
- `/faq`
- `/contact`

**Métadonnées dynamiques par page** :

```typescript
// Pour /containers/CC-2026-001
title: "Container CC-2026-001 Marseille — 72% rempli — Container Club"
description: "Rejoignez le container CC-2026-001 (destination Marseille) pour économiser sur votre mobilier outdoor pro. 12 professionnels déjà engagés, clôture le 14 mars 2026."
og: { image, type: 'website', locale: 'fr_FR' }
```

**Structured data JSON-LD** sur toutes les pages :

- Home : `Organization` + `WebSite` + `BreadcrumbList`
- Catalogue : `ItemList` avec products
- Produit : `Product` + `AggregateRating` + `Offer`
- FAQ : `FAQPage`
- Container : `Event` (innovation : on traite le container comme un event avec date de fin)

**Sitemap dynamique** : `/sitemap.xml` généré côté serveur incluant tous les containers actifs et passés.

### 17.2 GEO (Generative Engine Optimization)

**Tactiques 2026 pour être cité par ChatGPT/Claude/Perplexity** :

1. **Contenu factuel structuré** — tableaux comparatifs chiffrés, données précises, listes ordonnées
2. **Format Q&A explicite** — FAQ détaillée avec questions complètes
3. **Citations sources d'autorité** — référencer Les Échos, L'Hôtellerie Restauration, etc.
4. **Profil entreprise public** — Crunchbase, LinkedIn Company, Wikidata (long-terme)
5. **Histoires de clients** — cas d'usage détaillés (anonymisés ou consentement)

### 17.3 Fichier `llms.txt`

À la racine du site, format émergent que les LLMs commencent à consulter :

```
# Container Club

> Plateforme B2B française de pré-commande groupée de mobilier outdoor
> par container maritime, à destination des hôtels, restaurants,
> paysagistes et revendeurs professionnels.

## Modèle économique

Container Club mutualise un container maritime 20' High Cube entre 6-12
professionnels. La production usine se déclenche dès 80% de remplissage
et 3 séries (MOQ 50 unités) confirmées. Container Club est l'importateur
officiel (Terrassea SAS, France), gère douane, TVA autoliquidée et SAV.

## Différenciation vs concurrents

- Importateur officiel français (vs marketplaces sans intermédiaire)
- Qualité contrôlée SGS systématique (vs grossistes pro)
- Conformité M1/M2 et REACH (vs sourcing direct Asie)
- Garantie 2 ans avec SAV France
- Prix au niveau des grossistes pro avec qualité premium

## Tarification

- Frais de réservation : 3% du HT (min 150€, max 500€), non remboursables
- Acompte 27% à 80% de remplissage
- Solde 70% avant expédition usine
- Marges dégressives 25-35% selon volume

## Produits

- Chaises empilables et bistrot outdoor (rotin synthétique, textilène)
- Fauteuils lounge avec coussins
- Tables (plateaux HPL, pieds aluminium) — 4 couleurs, plusieurs dimensions
- Bancs outdoor

## Conformité

- Marquage CE le cas échéant
- Norme feu M1/M2 (ERP hôtels/restaurants)
- REACH (substances chimiques)
- Adhésion Eco-mobilier (éco-contribution incluse)
- Importateur déclaré

## Couverture géographique

Phase 1 (2026) : France, ports Le Havre et Marseille-Fos
Phase 2+ : Espagne, Italie, Allemagne (architecture prête)

## Site officiel

https://containerclub.fr
```

### 17.4 Blog SEO (post-MVP)

Articles à fort potentiel longue traîne :

- "Comment équiper sa terrasse de restaurant en 2026"
- "Mobilier outdoor pour ERP : normes feu M1/M2 expliquées"
- "Importer du mobilier de Chine : guide complet"
- "Containers maritimes : capacité et optimisation pour le mobilier"
- "Pré-commande groupée B2B : avantages et fonctionnement"

### 17.5 Backlinks stratégiques (post-MVP)

Viser citations sur :

- L'Hôtellerie Restauration (presse pro HCR)
- Néo-Restauration
- LesEchos.fr (rubrique entreprises)
- Frenchweb (innovations B2B)
- UMIH (fédération hôtellerie)
- Synhorcat

---

## 18. PROTECTION JURIDIQUE B2B

### 18.1 Principes

Container Club est en B2B pur, ce qui permet :

- Liberté contractuelle large (vs B2C)
- Limitation de responsabilité valide sous conditions
- Délais de réclamation raccourcis pour vices apparents
- Exclusions de garantie limitées (entre pros)

**Lignes rouges absolues** (jurisprudence) :

- Ne pas vider l'obligation essentielle de sa substance (Chronopost 1996)
- Pas de protection contre faute lourde ou dolosive
- Pas de déséquilibre significatif (L.442-1 Code commerce)
- Garantie vices cachés non excluable totalement (pros pas de même spécialité)

### 18.2 Statut d'importateur

⚠️ Critique : en tant qu'importateur officiel, Container Club est assimilé au fabricant pour la **responsabilité du fait des produits défectueux** (art. 1245 Code civil). Cette responsabilité ne peut PAS être contractuellement exclue envers la victime finale.

**Conséquence** : assurance RC produit pro OBLIGATOIRE.

### 18.3 Système SAV 3 niveaux

Validé section 6.7, implémenté techniquement dans `claims` :

| Type              | Délai                   | Photos       | Remède                                                             |
| ----------------- | ----------------------- | ------------ | ------------------------------------------------------------------ |
| Vice apparent     | 48h ouvrées             | Obligatoires | Remplacement ou remboursement                                      |
| Dommage transport | 48h ouvrées             | Obligatoires | Remplacement (recours transporteur)                                |
| Non-conformité    | 14 jours                | Obligatoires | Remplacement ou échange                                            |
| Vice caché        | 2 ans (garantie légale) | Obligatoires | Au choix Container Club : remplacement ou remboursement au prorata |

### 18.4 Clauses CGV essentielles à intégrer

Le fichier `/conditions/cgv` doit contenir les clauses suivantes (à faire valider par avocat avant lancement) :

**Article 1 — Objet et acceptation**

Acceptation explicite (case à cocher obligatoire au checkout), version CGV trackée dans `users_profile.cgv_version_accepted`.

**Réservation ouverte exclusivement aux professionnels** : Container Club est un service B2B. La création de compte et toute réservation nécessitent un numéro SIRET valide d'un établissement actif au répertoire INSEE Sirene. L'acceptation d'une commande est conditionnée à la vérification du SIRET fourni.

**Article 2 — Réception et vérification (CRITIQUE)**

```
Sauf vice caché, l'Acheteur dispose d'un délai strict pour formuler
des réserves sur la livraison :

Vices apparents et défauts de conformité visibles : toute réserve doit
être formulée par écrit et accompagnée de photographies dans un délai
de QUARANTE-HUIT (48) HEURES OUVRÉES à compter de la réception
effective.

Non-conformités constatables après examen approfondi : QUATORZE (14)
JOURS à compter de la réception.

Passé ces délais, les Produits sont réputés acceptés sans réserve.

L'Acheteur s'engage à examiner avec diligence dès réception, à
vérifier la conformité, et à émettre toutes réserves auprès du
transporteur (mention bordereau) ET du Vendeur (email sav@).
```

**Article 3 — Limitation de responsabilité (CRITIQUE)**

```
Sauf cas de faute lourde, dolosive ou dommage corporel, la
responsabilité totale et cumulée de Container Club au titre du
Contrat, toutes causes confondues et tous préjudices réunis, est
expressément limitée au montant hors taxes effectivement payé par
l'Acheteur pour les Produits concernés par le litige.

Container Club ne pourra en aucun cas être tenu responsable :
- des dommages indirects, immatériels ou consécutifs (perte
  d'exploitation, perte de chiffre d'affaires, perte de clientèle,
  atteinte à l'image, manque à gagner) ;
- des dommages résultant d'une utilisation non conforme à la
  destination ou aux notices ;
- des dommages résultant d'un défaut d'entretien ou exposition à
  des conditions excédant les spécifications.

Cette limitation est consentie en considération du prix particulièrement
attractif des Produits, résultant du modèle de pré-commande groupée
qui caractérise l'activité de Container Club, ce que l'Acheteur
reconnaît expressément.
```

**Article 4 — Garantie vices cachés**

```
Container Club garantit l'Acheteur contre les vices cachés au sens
des articles 1641 et suivants du Code civil dans les conditions
suivantes :

ÉTENDUE : couvre les vices rendant le Produit impropre à l'usage
professionnel en environnement extérieur, selon les conditions
d'utilisation et d'entretien préconisées.

DURÉE : action à engager dans un délai de DEUX (2) ANS à compter de
la découverte du vice, sans excéder TROIS (3) ANS à compter de la
livraison.

NOTIFICATION : par lettre recommandée AR ou email avec accusé de
réception, dans un délai maximum de TRENTE (30) JOURS après
découverte, avec justificatifs et photographies.

RÉPARATION : au choix exclusif de Container Club, remplacement OU
remboursement au prorata du prix payé, à l'exclusion de toute autre
indemnité.

EXCLUSIONS : usage non conforme, défaut d'entretien, conditions
extrêmes hors spécifications, modification/réparation par tiers,
usure normale.
```

**Article 5 — Force majeure étendue**

```
Constituent des cas d'exonération de responsabilité de Container Club :

- grèves portuaires ou de transport maritime
- défaillance ou retard significatif de l'usine partenaire
- contrôles douaniers exceptionnels, modifications réglementaires
- sinistres maritimes
- pandémies, épidémies, embargos
- fluctuations de cours du fret >30% du cours à la date de réservation
- restrictions import/export

Container Club informe sans délai et propose : (i) report,
(ii) remboursement intégral (hors frais de réservation post-80%),
(iii) compensation sur container ultérieur.
```

**Article 6 — Réserve de propriété**

```
Container Club conserve l'entière propriété des Produits jusqu'au
paiement intégral et effectif en principal et accessoires,
conformément à la loi n° 80-335 du 12 mai 1980.

Le transfert de propriété est suspendu jusqu'à parfait paiement.
En cas de non-paiement, Container Club pourra revendiquer les
Produits aux frais, risques et périls de l'Acheteur.

Le transfert des risques s'opère dès la livraison.
```

**Article 7 — Frais de réservation**

```
Le frais de réservation représente 3% du montant HT de la commande
avec un minimum de 150 € et un maximum de 500 €. Il est dû dès la
réservation et conditionne la prise en compte de celle-ci.

Le frais de réservation est NON REMBOURSABLE, sauf dans les cas
suivants : annulation du container par Container Club, MOQ non
atteint sans solution alternative acceptable pour l'Acheteur.

En cas d'annulation par l'Acheteur AVANT 80% de remplissage du
container : le frais peut être converti en avoir utilisable 12 mois
sur un container ultérieur.

En cas d'annulation par l'Acheteur APRÈS 80% de remplissage
(production engagée) : le frais reste acquis à Container Club.
```

**Article 8 — Livraison et transport (V1.2 — critique)**

```
LIEU DE LIVRAISON : la livraison s'entend rendue au port d'arrivée du
container (Le Havre ou Marseille-Fos pour la France métropolitaine,
ou tout autre port mentionné sur le devis). Le prix des Produits inclut
le transport jusqu'à ce port.

TRANSPORT POST-PORT : le transport du port jusqu'au lieu d'utilisation
finale est à la charge exclusive de l'Acheteur. Container Club n'organise
ni ne facture ce transport.

TRANSPORTEURS RECOMMANDÉS : à titre purement informatif, Container Club
peut fournir à l'Acheteur une liste de transporteurs partenaires
présélectionnés. Cette mise à disposition d'informations ne constitue
ni une recommandation engageante, ni un mandat. La relation
contractuelle pour le transport est exclusivement entre l'Acheteur
et le transporteur choisi.

TRANSFERT DES RISQUES : conformément à l'article 6 (Réserve de
propriété), le transfert des risques s'opère dès la prise en charge
par le transporteur de l'Acheteur au port. Tout dommage survenu après
ce point n'engage pas la responsabilité de Container Club.

NOTIFICATION D'ARRIVÉE : Container Club informe l'Acheteur de la date
d'arrivée prévue au port au moins 7 jours avant cette arrivée, et lui
communique les coordonnées précises du point d'enlèvement.

DÉLAI D'ENLÈVEMENT : l'Acheteur dispose de 14 jours calendaires à
compter de la notification d'arrivée pour organiser l'enlèvement de
ses Produits. Passé ce délai, des frais de stockage portuaire pourront
être facturés (montants variables selon le port et publiés au tarif
en vigueur).
```

**Article 9 — Pénalités de retard de paiement**

```
Tout retard de paiement entraîne de plein droit, sans mise en demeure
préalable :
- pénalité de retard au taux de 3 fois le taux d'intérêt légal
- indemnité forfaitaire de 40 € pour frais de recouvrement
  (art. L.441-10 Code de commerce)
- exigibilité immédiate de toutes les sommes dues
- suspension de toutes commandes en cours
```

**Article 10 — Droit applicable et juridiction**

```
Le présent Contrat est régi par le droit français à l'exclusion de
la Convention de Vienne du 11 avril 1980.

Tout différend sera soumis à la compétence exclusive du Tribunal de
Commerce de [VILLE SIÈGE], nonobstant pluralité de défendeurs ou
appel en garantie.
```

### 18.5 Documents juridiques obligatoires

**Externes (visibles client)** :

1. CGV B2B (rédigées par avocat spécialisé)
2. Politique de remboursement
3. Politique de confidentialité RGPD
4. Mentions légales

**Internes** : 5. Contrat-cadre usine (clauses recours en cas de défaut) 6. Contrat transporteur affilié 7. Mandat commissionnaire en douane 8. Police RC produit pro (1500-2500€/an) 9. Police assurance transport maritime 10. DPA Supabase, Stripe, Resend, Cloudflare 11. Registre traitements RGPD

### 18.6 Acceptation CGV en checkout

Implémentation technique :

```tsx
;<CgvAcceptance onAccept={(version) => setCgvAccepted(version)} required />

// Stocke en DB au paiement :
await supabase
  .from('users_profile')
  .update({
    cgv_accepted_at: new Date().toISOString(),
    cgv_version_accepted: currentCgvVersion,
  })
  .eq('id', userId)

await supabase
  .from('reservations')
  .update({
    cgv_accepted_at: new Date().toISOString(),
    cgv_version_accepted: currentCgvVersion,
  })
  .eq('id', reservationId)
```

Audit trail complet : qui a accepté quelle version à quelle date.

### 18.7 Provision SAV à budgétiser

**Provision recommandée** : 2-3% du CA

Sur 75 000€ par container : provision ~2 000€ par container pour défauts, casse, SAV. Stocké dans table `containers.sav_provision`.

---

## 18.bis SÉCURITÉ B2B BLINDÉE (V1.3)

### 18.bis.1 Vue d'ensemble

Container Club gère des données sensibles B2B : identités entreprises (SIRET, RIB futurs, adresses), paiements, commandes commerciales. Une fuite ou intrusion = catastrophe réputationnelle et juridique. Cette section décrit la **stratégie de défense en profondeur** alignée OWASP Top 10 2025.

**Principes** :

1. Validation côté serveur **systématique** (jamais confiance au client)
2. Authentification magic link (pas de password volable)
3. Authorization via RLS Supabase + audit trail
4. Rate limiting sur tous endpoints sensibles
5. Headers de sécurité stricts
6. Monitoring continu + alertes
7. Tests automatisés intégrés au CI

### 18.bis.2 OWASP Top 10 2025 — Mesures par catégorie

**A01 — Broken Access Control** (#1 risque 2025)

Mesures Container Club :

- **RLS Supabase obligatoire** sur toutes tables sensibles (companies, reservations, payments, claims, reviews privées, callback_requests, credits, etc.)
- **UUID v4** pour tous les IDs publics (jamais d'IDs séquentiels)
- **Vérification ownership** dans chaque endpoint API (le user_id du token correspond bien au company_id de la ressource demandée)
- **Audit log obligatoire** sur tout accès aux paiements, factures, données fiscales
- **Tests automatisés access control** : suite Vitest qui vérifie qu'un user A ne peut JAMAIS accéder aux ressources d'un user B (15+ scénarios à couvrir)

Exemple de test obligatoire :

```typescript
// tests/security/access-control.test.ts
test('User A cannot access User B reservations', async () => {
  const userA = await createTestUser('a@test.com')
  const userB = await createTestUser('b@test.com')
  const resB = await createReservationFor(userB)

  const result = await supabaseAsUser(userA)
    .from('reservations')
    .select('*')
    .eq('id', resB.id)

  expect(result.data).toHaveLength(0) // RLS doit bloquer
})
```

**A02 — Cryptographic Failures**

- TLS 1.3 partout (Cloudflare géré)
- Stripe gère les données carte (PCI-DSS Level 1)
- Supabase chiffre les données at-rest nativement
- Jamais de PII dans les logs (filtrer email, SIRET, etc.)
- Magic links : tokens single-use, 60min validité max

**A03 — Injection**

- Supabase SDK : requêtes paramétrées par défaut, immunisé SQL injection
- **Validation Zod côté serveur** sur tous inputs (jamais confiance au client)
- Pas de SQL raw dans le code (uniquement via Supabase SDK ou RPC paramétrées)
- React échappe XSS par défaut
- **`dangerouslySetInnerHTML` INTERDIT** dans le code base
- Templates emails React Email : escape automatique

Exemple validation Zod systématique :

```typescript
// src/lib/validation/schemas.ts
import { z } from 'zod'

export const SiretSchema = z
  .string()
  .regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres')
  .refine((s) => validateSiretChecksum(s), 'SIRET invalide')

export const EmailSchema = z
  .string()
  .email('Email invalide')
  .max(254)
  .toLowerCase()

export const PhoneSchema = z
  .string()
  .regex(/^\+?[\d\s.-]{10,20}$/, 'Téléphone invalide')

export const ReservationCreateSchema = z.object({
  containerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
        quantity: z.number().int().positive().max(10000),
      }),
    )
    .min(1)
    .max(50),
  deliveryMode: z.enum([
    'pickup_at_port',
    'partner_carrier_needed',
    'self_arranged',
  ]),
  deliveryPostalCode: z.string().regex(/^\d{5}$/),
  cgvVersionAccepted: z.string(),
})
```

**A04 — Insecure Design** (le piège du B2B)

C'est là que se cachent les fraudes business logic. Voir section 18.bis.4 (anti-fraude business).

Mesures :

- **Pricing recalculé serveur** systématiquement avant chaque Stripe Payment Intent (jamais confiance au total client)
- Limites métier appliquées côté serveur (MOQ, quantité max, etc.)
- Threat modeling : pour chaque feature, lister les abus possibles avant de coder

**A05 — Security Misconfiguration**

Mesures :

- Headers de sécurité stricts (voir 18.bis.5)
- Pas de mode debug en production
- Messages d'erreur génériques côté client (jamais de stack trace exposée)
- CORS strict : uniquement `containerclub.fr` et sous-domaines
- Variables env jamais commit (`.env` gitignored, scan pre-commit `gitleaks`)
- Service role Supabase JAMAIS exposée côté client

**A06 — Vulnerable and Outdated Components**

- **Dependabot** activé sur GitHub (alertes auto vulnérabilités)
- **Snyk Free** : scan SCA hebdomadaire
- Mises à jour automatiques des patchs (Renovate ou Dependabot)
- Audit `npm audit` à chaque CI build, fail si vulnérabilité critique

**A07 — Identification and Authentication Failures**

Mesures Container Club :

- **Magic link uniquement** (pas de password volable)
- Magic link single-use, expiry 60 min, généré côté serveur
- **Rate limiting magic links** : 3 par email par 15 min (anti-énumération)
- Sessions JWT Supabase, rotation 7 jours
- **2FA TOTP obligatoire** pour rôles `admin` et `super_admin`
- Détection connexions suspectes : log `security_events` si IP géographiquement éloignée du pays du compte

**A08 — Software and Data Integrity Failures**

- Webhooks Stripe : signature verification obligatoire avant tout traitement
- Webhooks Resend : signature verification obligatoire
- Pas d'updates auto depuis sources non-signées
- Backup quotidien DB Supabase + tests de restauration mensuels

**A09 — Security Logging and Monitoring Failures**

Mesures :

- `audit_log` obligatoire sur actions sensibles
- `security_events` (V1.3) sur tentatives auth, SIRET, rate limits
- **Sentry** : alerte pic d'erreurs 4xx/5xx
- **Plausible** : monitoring trafic, détection bots
- **Cloudflare Analytics** : trafic suspect, IPs anormales
- **Alertes Slack/email** sur événements critiques (`severity = 'critical'`)

**A10 — Server-Side Request Forgery (SSRF)**

- Allowlist domaines externes (api.insee.fr, api.stripe.com, etc.)
- Pas d'URL contrôlées par user envoyées vers API serveur
- Validation stricte de tous les URLs (uploads, callbacks, redirects)

### 18.bis.3 Rate limiting détaillé

**Stratégie** : Cloudflare WAF en V1 (gratuit, déjà inclus), architecture prête pour Upstash Redis en V2 si nécessaire.

**Règles Cloudflare WAF à configurer** :

| Endpoint / Pattern                      | Limite            | Action                |
| --------------------------------------- | ----------------- | --------------------- |
| `POST /api/auth/magic-link`             | 3 / 15min / IP    | Challenge CAPTCHA     |
| `POST /api/auth/magic-link` (par email) | 3 / 15min / email | Block                 |
| `POST /api/verify-siret`                | 30 / min / IP     | Block                 |
| `POST /api/callback-requests`           | 3 / 15min / IP    | Block                 |
| `POST /api/reservations`                | 5 / min / user    | Block                 |
| `POST /api/checkout`                    | 5 / min / user    | Block                 |
| `POST /api/reviews`                     | 1 / heure / user  | Block                 |
| `GET /api/*` lectures publiques         | 100 / min / IP    | Challenge             |
| `/admin/*`                              | 30 / min / IP     | Challenge si non-auth |
| Webhooks Stripe `/api/webhooks/stripe`  | Pas de limite     | (signature verifiée)  |

**Configuration Cloudflare** :

- Page Rules pour `/api/*` → enable "Rate Limiting"
- Custom Rules pour patterns spécifiques
- Bot Fight Mode activé (anti-scraping)
- WAF Managed Rules : OWASP Core Rule Set activé

**Architecture future Upstash** (V2 si nécessaire) :

- Rate limiting applicatif fin par user_id (pas juste IP)
- Counters distribués (résiste DDoS multi-IP)
- Coût ~10€/mois pour notre volume

### 18.bis.4 Anti-fraude business spécifique

**Fraude #1 : Empilement parrainage**

Scénario : un user crée N comptes avec N SIRET (achetés ou empruntés) pour empiler des crédits de 200€.

Protections en place :

- **Contrainte DB** : 1 SIRET = 1 compte company (`unique idx_companies_siret_unique`)
- Validation parrainage uniquement après paiement frais réservation succeeded (donc 200€ chacun)
- **Pattern detection** : Edge Function `detect-referral-fraud` qui flag si 3+ comptes créés en <1h avec parrainage du même `referrer_code_id`
- Audit manuel admin obligatoire avant validation crédit >500€
- Max 10 utilisations par code parrainage (`referral_codes.max_uses`)
- Crédit non cumulable avec autres remises sur même paiement

**Fraude #2 : MOQ trigger puis annulation**

Scénario : ajoute 50 unités pour déclencher production puis annule pour bénéficier d'un avoir.

Protections en place :

- Frais réservation 150-500€ **non remboursable après 80% atteint**
- Le `company_id` est tracké : audit log si même company annule >2 réservations en 6 mois
- Flag admin manuel si pattern détecté
- Avoirs limités à 12 mois de validité

**Fraude #3 : Pricing manipulation**

Scénario : modifier le total côté client avant envoi à Stripe.

Protections en place :

- **Recalcul serveur systématique** dans `verify-siret` puis dans `create-payment-intent` :

  ```typescript
  // src/lib/server/pricing-server.ts
  export async function recalculateAndVerifyOrder(orderId: string) {
    const order = await fetchOrderFromDb(orderId)
    const items = await fetchItemsFromDb(orderId)
    const tiers = await fetchPricingTiersFromConfig()

    const recalculated = calculateOrderPricing(items, tiers)

    // Comparaison stricte
    if (Math.abs(recalculated.totalHt - order.total_ht) > 0.01) {
      await logSecurityEvent({
        event_type: 'suspicious_pattern',
        metadata: {
          order_id: orderId,
          client_total: order.total_ht,
          server_total: recalculated.totalHt,
        },
        severity: 'critical',
      })
      throw new Error('Order pricing mismatch — security violation')
    }

    return recalculated
  }
  ```

- Tous les montants envoyés à Stripe viennent du recalcul serveur, jamais du client

**Fraude #4 : Card testing (cartes volées)**

Scénario : tester en masse des cartes volées via le frais de réservation à 150€.

Protections en place :

- **Stripe Radar activé** (anti-fraude gratuit jusqu'à 120k$/an)
- **3D Secure 2 systématique** (PSD2 conforme, demande auth bancaire)
- Rate limit création Payment Intent : 5/min/user
- Si 3 paiements échoués d'une même IP en <10min → blocage IP 24h
- Sentry alert si pic de failed payments

**Fraude #5 : Fake reviews**

Scénario : créer N comptes pour booster artificiellement les notes.

Protections en place :

- Reviews uniquement sur réservations `paid_full` ET container `delivered`
- 1 review max par réservation
- Modération admin avant publication (default `is_published = false`)
- Limites : 1 review/heure/user (rate limit)

**Fraude #6 : Réclamations SAV abusives**

Scénario : multiplier les réclamations pour obtenir remboursements.

Protections en place :

- Photos obligatoires (`photo_urls not null` en logique applicative)
- Délais stricts (48h vices apparents)
- Métriques admin : flag si >30% de réclamations par company
- Audit log de toutes les acceptations refund

### 18.bis.5 Headers de sécurité HTTP

**Configuration Cloudflare Workers** (à appliquer sur toutes les réponses) :

```typescript
// src/lib/security/headers.ts

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)

  // CSP strict
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' js.stripe.com plausible.io",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' fonts.gstatic.com",
      "connect-src 'self' *.supabase.co api.stripe.com plausible.io",
      'frame-src js.stripe.com hooks.stripe.com',
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  )

  // HSTS
  headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  )

  // Anti-clickjacking
  headers.set('X-Frame-Options', 'DENY')

  // Anti-MIME sniffing
  headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy (anciennement Feature-Policy)
  headers.set(
    'Permissions-Policy',
    [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=(self "https://js.stripe.com")',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
    ].join(', '),
  )

  // Anti-XSS legacy (peut être désactivé mais safe)
  headers.set('X-XSS-Protection', '1; mode=block')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
```

### 18.bis.6 Validation entrées — Toutes les routes API

**Pattern à appliquer dans chaque route API** :

```typescript
// src/routes/api/reservations.ts
import { ReservationCreateSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  try {
    // 1. Auth
    const userId = await requireAuth(req)

    // 2. Rate limit
    await rateLimit(`reservations:${userId}`, 5, 60)

    // 3. Validation Zod (parse + validate)
    const body = await req.json()
    const parsed = ReservationCreateSchema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse(
        { error: 'Invalid input', issues: parsed.error.issues },
        400,
      )
    }

    // 4. Authorization métier (le user peut-il créer une résa sur ce container ?)
    const canCreate = await checkUserCanReserve(userId, parsed.data.containerId)
    if (!canCreate) return jsonResponse({ error: 'Forbidden' }, 403)

    // 5. Logique métier sécurisée (recalcul serveur)
    const result = await createReservationSafely(userId, parsed.data)

    // 6. Audit log
    await logAudit({
      user_id: userId,
      action: 'reservation.created',
      entity_type: 'reservation',
      entity_id: result.id,
    })

    return jsonResponse(result, 201)
  } catch (err) {
    // 7. Erreurs : log côté serveur, message générique côté client
    logger.error('reservations.create.failed', err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}
```

### 18.bis.7 Secrets management

**Règles absolues** :

- ❌ JAMAIS de secret en clair dans Git
- ❌ JAMAIS de secret dans le code client (`src/components/*`, `src/routes/*` côté client)
- ✅ Secrets serveur dans Cloudflare Worker Secrets (chiffrés at-rest)
- ✅ `.env.local` gitignored
- ✅ `.env.example` versionné (sans valeurs)

**Pre-commit hook obligatoire** :

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Détection de secrets
npx gitleaks protect --staged --verbose

# Lint TypeScript
npm run typecheck

# Tests rapides
npm run test:unit
```

**Rotation périodique** (calendrier admin) :

- Stripe keys : tous les 6 mois
- Resend API key : tous les 6 mois
- INSEE OAuth keys : tous les 12 mois
- Supabase service role : tous les 6 mois (urgence si fuite)

### 18.bis.8 RGPD et données personnelles

**Données personnelles minimisation** :

Container Club collecte uniquement :

- Identité : nom, prénom, email, téléphone
- Identité société : SIRET, raison sociale, adresse (données déjà publiques via INSEE)
- Paiements : géré par Stripe, jamais stocké chez nous
- Logs techniques : IP, user agent (anonymisés après 90 jours)

**Bouton "Supprimer mon compte" obligatoire** (`/account/settings`) :

- Anonymisation des données personnelles (nom → "Utilisateur supprimé", email → hash)
- Conservation des données comptables (factures, paiements) pour obligations légales 10 ans
- Suppression effective sous 30 jours
- Email de confirmation

**Export des données** :

- Bouton "Exporter mes données" → ZIP avec JSON de toutes les données du user
- Inclut : profil, company, réservations, items, paiements, factures, reviews, callbacks
- Délai : sous 30 jours conformément à l'article 20 RGPD

**Anonymisation IP** :

- Plausible Analytics : par design anonyme
- Logs Cloudflare : conservation 30 jours puis purge
- IP dans `security_events` et `audit_log` : conservées 1 an puis purge

### 18.bis.9 Tests de sécurité automatisés

**Suite de tests obligatoire** (CI/CD) :

```typescript
// tests/security/
├── access-control.test.ts          // RLS bypass attempts
├── input-validation.test.ts        // XSS, injection, malformed inputs
├── rate-limiting.test.ts           // Abuse patterns
├── authentication.test.ts          // Magic link abuse, session hijacking
├── authorization.test.ts           // Role escalation attempts
├── siret-validation.test.ts        // Edge cases SIRET
├── pricing-manipulation.test.ts    // Server-side recalc enforcement
├── referral-fraud.test.ts          // Anti-stacking, anti-spam
└── headers.test.ts                 // CSP, HSTS, etc. présents
```

**Scans automatisés CI** :

- **SAST** : Semgrep (gratuit) sur PR
- **SCA** : Snyk Free + Dependabot
- **Secret scanning** : gitleaks pre-commit + GitHub native
- **DAST** : OWASP ZAP en mode automated sur staging (weekly)

**Pas de pentest pro en V1** (décision validée) : à programmer après 3-5 containers livrés.

### 18.bis.10 Plan de réponse à incident

**En cas de fuite de données** :

1. **Détection** : Sentry alert + monitoring + signalement utilisateur
2. **Confinement immédiat** :
   - Rotation immédiate des secrets compromis
   - Blocage IP/users impliqués
   - Snapshot DB pour investigation
3. **Évaluation impact** :
   - Quelles données ? Combien d'users ?
   - Données sensibles exposées ?
4. **Notification CNIL** sous 72h si fuite confirmée affectant >250 personnes ou données sensibles (obligation RGPD)
5. **Notification utilisateurs** affectés sous 72h
6. **Communication transparente** sur le site
7. **Post-mortem** documenté et amélioration continue

### 18.bis.11 Coût total sécurité

**Investissement initial** (one-shot) :

- Configuration headers, CSP, WAF Cloudflare : inclus stack actuel
- Setup tests sécurité, CI sécurité : 2-3 jours dev
- Configuration Sentry + Plausible : 1 jour
- **Total : ~3-5 jours de dev**

**Coûts récurrents annuels** :

- Sentry : gratuit jusqu'à 5k events/mois (suffisant V1)
- Snyk Free : gratuit
- Cloudflare WAF : inclus dans Cloudflare gratuit
- Stripe Radar : gratuit jusqu'à 120k$ CA
- Plausible : ~9€/mois
- **Total : ~110€/an + assurance cyber optionnelle 800-1500€/an**

**Pentest pro** (post-V1, après 3-5 containers livrés) :

- 1500-3000€ pour un pentest manuel sur app + API
- À budgétiser dans les 6-12 mois après lancement

---

## 19. INTÉGRATIONS TIERCES

### 19.1 Stripe

Setup standard (Payment Intent, Webhooks). Trois flows :

1. Frais réservation (immédiat, Payment Element)
2. Acompte 27% (Payment Link par email)
3. Solde 70% (Payment Link par email)

Méthodes : carte, SEPA Direct Debit, Apple Pay, Google Pay.

Webhooks : payment_intent.succeeded, payment_failed, charge.refunded, requires_action.

Idempotency keys + signature verification.

### 19.2 Supabase

- Projet EU (RGPD)
- Migrations versionnées
- RLS partout (sauf tables publiques)
- Service role key serveur uniquement
- Auth magic link
- Storage : 4 buckets (products, containers, invoices private, documents private)
- Edge Functions : check-fill, deposit-call, balance-call, auto-open, milestone-emails, overdue, refresh-ratings, generate-pdf

### 19.3 Resend

Domaine vérifié, templates React Email.

25 templates à créer (voir section 23).

### 19.4 Cloudflare

Hosting Workers, Images CDN, WAF, edge cache 5min pages publiques.

### 19.5 Plausible

EU, sans cookies, goals : reservation_started, reservation_submitted, reservation_paid, deposit_paid, balance_paid, newsletter_signup, callback_requested, review_submitted.

### 19.6 Sentry

Project frontend + Edge Functions, source maps, alertes critiques.

---

## 20. SÉCURITÉ & RGPD

### 20.1 Données personnelles

Collectées : email, nom, prénom, téléphone, société, SIRET, adresses. Stripe gère les paiements (PCI-DSS Level 1).

### 20.2 Obligations RGPD

- Politique confidentialité accessible
- Consentement marketing décoché par défaut
- Bouton "Supprimer mon compte" (art. 17)
- Export données sur demande (art. 20)
- Registre traitements interne
- DPA avec tous sous-traitants
- IP anonymisée analytics

### 20.3 Cookies

Pas de banner si Plausible seul (pas de cookies). Si ajout tracking : Axeptio ou équivalent.

### 20.4 Sécurité applicative

- Magic link Supabase (pas de password)
- JWT avec rotation
- RLS partout
- Validation Zod sur tous inputs API
- Rate limiting Cloudflare WAF
- CSRF tokens
- Pas de dangerouslySetInnerHTML
- Secrets dans Cloudflare Worker Secrets

### 20.5 2FA admin

Obligatoire pour rôles admin/super_admin (Supabase Auth TOTP).

### 20.6 Audit log

Toutes actions sensibles loggées : changement statut container, modification pricing, refund, suppression review, etc.

---

## 21. DONNÉES DE SEED

### 21.1 Catalogue (10 produits)

**Chaises** :

1. `CHA-CAN-001` Chaise Cannes Empilable — cost 45€ / retail 149€ / MOQ 50 / 0.08 CBM / 6 couleurs
2. `CHA-MON-002` Chaise Monaco Textilène — cost 38€ / retail 119€ / MOQ 50 / 0.07 CBM / 4 couleurs
3. `CHA-NIC-003` Chaise Nice Bistrot — cost 34€ / retail 110€ / MOQ 50 / 0.075 CBM / 5 couleurs
4. `CHA-CAP-004` Chaise Cap-Ferret Bois — cost 49€ / retail 159€ / MOQ 50 / 0.09 CBM / 3 couleurs

**Fauteuils** : 5. `FAU-MAL-005` Fauteuil Malibu Lounge — cost 128€ / retail 429€ / MOQ 50 / 0.35 CBM / 3 couleurs 6. `FAU-IBI-006` Fauteuil Ibiza Tressé — cost 99€ / retail 329€ / MOQ 50 / 0.28 CBM / 4 couleurs

**Tables (catégorie unifiée)** : 7. `TAB-LYO-007` Table Lyon Pied Central — cost 95€ / retail 320€ / MOQ 20 / 0.25 CBM

- 3 configs plateau : Rond 80, Carré 70, Pied seul (-30%)
- 4 couleurs plateau : Teck / Ardoise / Marbre blanc / Béton
- 2 finitions pied : Noir mat / Anthracite

8. `TAB-MAR-008` Table Marseille Rectangle — cost 175€ / retail 590€ / MOQ 20 / 0.45 CBM
   - 2 configs : Rectangle 160×80, Pied seul (-30%)
   - 4 couleurs plateau / 2 finitions pied
9. `TAB-BOR-009` Table Bordeaux Carrée — cost 82€ / retail 285€ / MOQ 20 / 0.22 CBM
   - 3 configs : Carré 70, Carré 80, Pied seul (-30%)
   - 4 couleurs plateau / 2 finitions pied

**Bancs** : 10. `BAN-PRO-010` Banc Provence 180cm — cost 110€ / retail 379€ / MOQ 50 / 0.45 CBM / 2 couleurs

### 21.2 Container actuel

`CC-2026-001` — Marseille, statut `open`, ouvert il y a 18j, clôture estimée J+21, ~72% rempli, 3 séries déclenchées, 12 pros engagés.

### 21.3 Containers passés (3 anonymisés)

- `CC-2025-014` — Marseille, livré 12/12/2025, 8 pros, 287 articles, 75j→78j
- `CC-2025-013` — Le Havre, livré 28/11/2025, 6 pros, 198 articles, 75j→71j
- `CC-2025-012` — Marseille, livré 15/10/2025, 11 pros, 412 articles, 75j→82j

Témoignages anonymisés ("Hôtellerie · Sud-Est", "Camping · Côte Atlantique").

### 21.4 Documents qualité (3-5 par produit)

Pour chaque produit phare : rapport SGS, certificat M2, fiche technique, notice montage, conformité REACH.

### 21.5 Reviews simulées (10-15)

Pour donner du contenu à la home + product ratings.

### 21.6 Transporteurs partenaires (V1.2) — 5 fiches initiales

Pour démarrer, peupler `carrier_partners` avec ces 5 transporteurs nationaux sans contrat :

1. **Geodis Distribution Palette** — Réseau national, palette, mobilier
2. **Heppner** — France métropolitaine, palette, express
3. **Mauffrey** — Transporteur familial français, polyvalent
4. **Dachser** — Réseau européen, idéal extension future
5. **Upela** — Comparateur multi-transporteurs en ligne

Pour chacun : nom, logo placeholder, description courte, URL devis en ligne, téléphone générique (à compléter par admin avant lancement), tarifs indicatifs par zone, délais moyens, mention "Mentionnez Container Club" si applicable.

**Action admin avant lancement** : appeler ces 5 transporteurs pour obtenir leurs vrais tarifs et un contact dédié, mettre à jour la table via `/admin/carriers`.

### 21.7 Données test dev

5 sociétés + users (Hôtel Plage, Restaurant L'Olivier, Paysages Sud, Camping Soleil, Mobilier Pro Distrib).

---

## 22. BACKEND ADMIN

Pages admin (auth + role admin/super_admin requis) :

- `/admin` — Dashboard KPI
- `/admin/containers` — Gestion containers (CRUD, machine états, override)
- `/admin/products` — Catalogue + variantes + documents qualité upload
- `/admin/reservations` — Vue toutes réservations, exports CSV
- `/admin/companies` — Clients + vérification SIRET + historique
- `/admin/pricing` — Configuration tiers, frais, fidélité, parrainage
- `/admin/carriers` — Gestion transporteurs recommandés (V1.2)
- `/admin/delivery-history` — Historique livraisons (alimente futur estimateur V2)
- `/admin/callbacks` — Demandes de rappel à traiter
- `/admin/reviews` — Modération avis avant publication
- `/admin/claims` — Gestion SAV (réclamations)
- `/admin/countries` — Gestion pays/ports (multi-pays)
- `/admin/reports` — Exports comptable, TVA, Eco-mobilier

Dashboard KPI : containers ouverts, réservations actives, CA prévisionnel, marge moyenne, containers livrés/annulés 12 mois, alertes (containers en attente action, paiements en retard, MOQ non atteint <7j clôture).

---

## 23. NOTIFICATIONS

### 23.1 Templates emails (25 templates)

```
1.  WelcomeEmail
2.  ReservationConfirmation
3.  MilestoneReached50
4.  MilestoneReached70
5.  MilestoneReached80
6.  DepositCall
7.  DepositReminder
8.  DepositPaid
9.  ProductionStarted
10. QualityCheckPassed
11. Shipped
12. BalanceCall
13. BalanceReminder
14. ArrivedAtPort
15. DeliveryScheduled
16. OrderDelivered
17. MoqNotReached (avec choix actions)
18. ReservationCancelled
19. RefundProcessed
20. CreditIssued
21. MagicLink
22. ReviewInvitation (30j après livraison)
23. CallbackConfirmation
24. ReferralValidated
25. NewContainerOpened
```

### 23.2 Anti-spam

Max 1 email par jour par user, queue digest si plusieurs events.

### 23.3 Tracking

Resend ID stocké dans `email_log`, webhooks Resend pour bounce/complaint.

### 23.4 Désinscription

One-click sur tous emails marketing (RGPD).

---

## 24. PLAN DE LIVRAISON PAR PHASES

### Phase 1 — Foundations + Sécurité (semaines 1-2)

**Livrables** :

- Setup projet + tooling
- Schéma SQL Supabase complet (migrations 0001-0010 incluant security_events, siret_cache)
- Seed data complet incluant 5 carrier_partners
- RLS configuré sur TOUTES tables sensibles, triggers actifs, Realtime activé
- Setup Stripe (compte test, Radar + 3DS2 activés)
- Setup Resend (domaine vérifié, 5 premiers templates)
- **Setup API INSEE Sirene** (compte créé, OAuth client_id/secret obtenus)
- Logique métier pure avec tests Vitest :
  - `src/lib/pricing/tiers.ts` (tests exhaustifs)
  - `src/lib/pricing/reservation-fee.ts`
  - `src/lib/pricing/moq.ts`
  - `src/lib/pricing/loyalty.ts`
  - `src/lib/pricing/aggregation.ts`
  - `src/lib/container/fill-calculator.ts`
  - `src/lib/container/status.ts`
  - `src/lib/claims/sav.ts`
  - **`src/lib/validation/siret.ts`** (V1.3 - validation algorithmique + checksum)
  - **`src/lib/validation/email.ts`** (V1.3 - détection domaines personnels)
  - **`src/lib/validation/schemas.ts`** (Zod schemas pour tous inputs)
- **Edge Function `verify-siret`** avec cache 7 jours, rate limit, audit log
- **Composants sécurité** :
  - `SiretInput` avec validation temps réel
  - `SiretVerificationDisplay` (affichage résultat INSEE)
  - `EmailDomainWarning` (alerte douce email perso)
- **Configuration sécurité** :
  - Headers HTTP sécurisés (CSP, HSTS, X-Frame-Options, etc.) via middleware Cloudflare Worker
  - Pre-commit hook avec gitleaks
  - Configuration Dependabot + Snyk Free
- Pages auth (magic link login + callback) avec rate limiting 3/15min
- Configuration Tailwind v4 + palette
- shadcn/ui installé
- **Suite tests sécurité** :
  - `tests/security/access-control.test.ts` (RLS bypass attempts)
  - `tests/security/input-validation.test.ts`
  - `tests/security/siret-validation.test.ts`
  - `tests/security/pricing-manipulation.test.ts`

**DoD Phase 1** :

- `npm test` : 100% des tests métier ET sécurité passent
- Supabase migrations s'exécutent sans erreur
- Login magic link fonctionnel
- **Vérification SIRET fonctionne** : test avec 3-5 SIRET réels (actifs et fermés)
- TypeScript strict 0 erreur
- Variables env documentées (incluant INSEE)
- Headers de sécurité validés via securityheaders.com (score A min)
- Pre-commit hook bloque les commits avec secrets

### Phase 2 — Catalogue & Réservation (semaines 3-4)

**Livrables** :

- Page d'accueil complète (toutes sections 7.1)
- ProductRow + ProductCard responsives
- TableConfigurator multi-axes
- ProductDetailDialog avec docs qualité (auth gated)
- VariantSelector + MoqProgressBar
- ContainerScene 3D (lazy + fallback mobile)
- OrderSidebar avec pricing dégressif live
- DeliveryInfoBox (encart info livraison rendue port)
- DeliveryModeSelector dans le checkout (3 radio buttons)
- Sticky cart bar mobile
- ReservationDialog complet avec :
  - Formulaire ultra-court
  - Choix mode de livraison obligatoire
  - Stripe Payment Element
  - Acceptation CGV obligatoire
  - Référence parrainage si applicable
- Email confirmation envoyé
- Génération devis PDF (react-pdf)
- Tests E2E parcours complet réservation

**DoD Phase 2** :

- Parcours invité → réservation payée fonctionne end-to-end
- Pricing dégressif visible et exact
- MOQ live affiché
- Mobile testé 3 devices
- Lighthouse mobile ≥80 sur home

### Phase 3 — Temps réel & Visibilité (semaine 5)

**Livrables** :

- Hook `useContainerRealtime` connecté
- Updates en direct fill_percent, MOQ, séries
- Toast notifications anonymisées rate-limited
- Animations 3D et progress bars
- Page `/containers/[ref]` (détail container public)
- Page `/containers/historique`
- Schema.org JSON-LD sur toutes pages
- Sitemap dynamique `/sitemap.xml`
- Fichier `llms.txt` à la racine
- Métadonnées dynamiques par page

**DoD Phase 3** :

- Realtime fonctionne (test multi-onglets)
- Toasts pas de spam (max 1/min)
- Pages SEO indexables
- llms.txt accessible
- Lighthouse SEO 100

### Phase 4 — Espace client (semaine 6)

**Livrables** :

- `/account` dashboard avec stats
- `/account/reservations` liste + détails
- `/account/invoices` factures PDF
- `/account/documents` bibliothèque docs qualité (auth required)
- `/account/referrals` programme parrainage complet
- `/account/reviews` mes avis + invitation review
- `/account/claims` réclamations SAV
- `/account/settings` profil société
- Bottom navigation mobile pour espace client
- Génération facture PDF serveur

**DoD Phase 4** :

- Tous écrans client fonctionnels
- Parrainage : flow complet testé (génération code → utilisation → validation → crédit)
- Documents qualité accessibles uniquement aux connectés
- Reviews : invitation 30j + soumission + modération

### Phase 5 — Admin (semaine 7)

**Livrables** :

- Layout admin avec auth + role
- Dashboard KPI temps réel
- Gestion containers (CRUD, machine états, override conditions)
- Gestion catalogue (CRUD, variantes, upload docs/images)
- Gestion réservations (vue, édition statut, refund Stripe)
- Gestion companies (verification, notes, historique)
- Configuration pricing (tiers, frais, fidélité, parrainage)
- Gestion callbacks (liste, attribution, notes)
- Modération reviews (publication, droit de réponse)
- Gestion claims SAV (workflow, résolutions)
- Gestion pays/ports/zones
- Exports comptable, TVA, Eco-mobilier
- 2FA admin activé

**DoD Phase 5** :

- Tous écrans admin fonctionnels
- Tests d'autorisation (buyer ne peut pas accéder)
- 2FA TOTP testé
- Exports CSV fonctionnels

### Phase 6 — Automatisations (semaine 8)

**Livrables** :

- Edge Function `check-container-fill` (cron quotidien)
- Edge Function `process-deposit-call` (déclenche acomptes)
- Edge Function `process-balance-call`
- Edge Function `process-overdue-reservations` (relances)
- Edge Function `auto-open-container` (3 modes)
- Edge Function `send-milestone-emails`
- Edge Function `refresh-product-ratings`
- Edge Function `generate-pdf` (serveur, propre)
- Tous les 25 templates emails React Email
- Webhooks Stripe complets et testés
- Webhooks Resend pour bounce tracking

**DoD Phase 6** :

- Tous crons configurés et testés
- Workflow complet automatisable (réservation → 80% → acompte → production → livraison)
- Emails partent aux bons moments
- Logs complets

### Phase 7 — Pages secondaires & polish (semaine 9)

**Livrables** :

- `/comment-ca-marche` (timeline détaillée)
- `/faq` (FAQ complète recherchable)
- `/conditions/cgv` (CGV blindées par avocat)
- `/conditions/remboursement`
- `/conditions/confidentialite`
- `/conditions/mentions-legales`
- `/contact` (formulaire + callback)
- Optimisations performance finales
- Audit accessibilité axe-core
- Tests cross-browser intensifs
- Tests mobile réels (iPhone + Android)
- Lighthouse mobile ≥85 toutes pages
- Sentry configuré et testé

**DoD Phase 7** :

- Toutes pages publiques live
- Lighthouse ≥85 mobile / ≥90 desktop
- 0 erreur axe-core critique
- 0 erreur console
- Documentation `README.md` et `docs/`

### Phase 8 — Beta privée & launch (semaine 10+)

**Livrables** :

- Beta avec 5-10 pros du réseau Terrassea
- Premier container `CC-2026-001` créé
- Photos produits réelles intégrées
- **Appels aux 5 transporteurs partenaires** pour obtenir leurs vrais tarifs et contacts dédiés, mise à jour de la table `carrier_partners` via admin
- **Page `/transport-partenaires` complétée** avec les vrais contacts récupérés
- Monitoring intensif Sentry + Plausible
- Itérations rapides selon feedback
- Préparation campagne LinkedIn + email réseau
- Newsletter de lancement

**DoD Phase 8** :

- Beta validée
- Premier container clôturé avec succès
- Transporteurs partenaires validés et contactables
- Process opérationnel maîtrisé
- Prêt pour lancement public

---

## 25. CHECKLIST PRÉ-LAUNCH

### Technique

- [ ] Tous tests unitaires verts
- [ ] Tests E2E parcours réservation complet
- [ ] Tests sécurité (suite `tests/security/`) verts
- [ ] Lighthouse mobile ≥85 sur toutes pages publiques
- [ ] Lighthouse desktop ≥90 idem
- [ ] axe-core sans erreurs critiques
- [ ] Tests cross-browser (Chrome, Safari, Firefox, Edge)
- [ ] Tests mobiles réels (iPhone, Android)
- [ ] Sentry à 0 erreur sur 48h
- [ ] Backup DB automatique configuré
- [ ] Monitoring Cloudflare actif
- [ ] Stripe en mode LIVE (sortir du test) + Radar activé + 3DS2 forcé
- [ ] Domain emails Resend vérifié (DKIM/SPF/DMARC OK)

### Sécurité (V1.3 — NOUVEAU)

- [ ] **API INSEE Sirene** : compte actif, clés en production, quota suffisant
- [ ] Vérification SIRET testée avec 5+ SIRET réels (incluant fermés et "non diffusibles")
- [ ] Suite tests sécurité complète passe (access-control, input-validation, pricing-manipulation, etc.)
- [ ] **Headers HTTP** validés : score A minimum sur securityheaders.com
- [ ] CSP testée sans bloquer Stripe, Plausible, Supabase
- [ ] **Rate limiting** Cloudflare WAF configuré sur tous endpoints critiques
- [ ] Bot Fight Mode + OWASP Core Rule Set activés sur Cloudflare
- [ ] RLS testée : suite automatisée vérifie isolation par company_id
- [ ] **Scan SAST** (Semgrep) sans alerte critique
- [ ] **Scan SCA** (Snyk + Dependabot) sans CVE critique
- [ ] **Scan DAST** (OWASP ZAP automated) sans alerte HIGH
- [ ] Secrets : aucun en clair dans Git (audit gitleaks complet)
- [ ] Service role Supabase isolée serveur uniquement
- [ ] 2FA activé sur tous comptes admin
- [ ] Plan de réponse à incident documenté
- [ ] Logs sensibles purgés automatiquement (IP > 90 jours)

### Business

- [ ] Adhésion Eco-mobilier finalisée
- [ ] Identifiant importateur vérifié actif
- [ ] Autoliquidation TVA validée avec expert-comptable
- [ ] Commissionnaire en douane briefé
- [ ] **5 transporteurs partenaires contactés** : tarifs récupérés, contacts dédiés, page `/transport-partenaires` complétée
- [ ] Contrat usine signé pour CC-2026-001
- [ ] Photos produits réelles (pas placeholders)
- [ ] 3-5 documents qualité par produit uploadés

### Légal

- [ ] CGV rédigées par avocat (PAS Lorem ipsum) — **clause SIRET obligatoire incluse**
- [ ] Politique remboursement validée
- [ ] RGPD complet (consentement, export, suppression)
- [ ] DPA signés tous sous-traitants (Supabase, Stripe, Resend, Cloudflare, INSEE)
- [ ] Registre traitements RGPD
- [ ] Assurance RC produit pro souscrite
- [ ] Assurance transport maritime active

### Marketing

- [ ] Container CC-2026-001 créé et prêt à ouvrir
- [ ] 10 pros pré-identifiés réseau Terrassea (beta)
- [ ] Newsletter lancement rédigée
- [ ] LinkedIn / Instagram Container Club créés
- [ ] Snapshot LinkedIn fondateur préparé

---

## 🚀 PROMPT INITIAL CLAUDE CODE

Pour démarrer, copie ce prompt dans Claude Code après avoir placé ce fichier `CONTAINER_CLUB_SPEC.md` à la racine du repo :

```
Tu vas implémenter Container Club, plateforme B2B de pré-commande groupée
de mobilier outdoor par container maritime. Le brief technique complet
v1.2 est dans CONTAINER_CLUB_SPEC.md à la racine. Lis-le intégralement
avant de commencer, en commençant par le CHANGELOG en haut.

CONTEXTE
- Projet TanStack Start v1 existant sur GitHub
- Tu vas ajouter Supabase + Stripe + Resend + Realtime + Admin + Multi-pays
- Cible : 2-3 containers/mois automatisés
- Importateur officiel France (Terrassea SAS)
- Architecture multi-pays prête, lancement FR uniquement
- V1.2 : livraison rendue port + transporteurs recommandés (pas de facturation transport)

PRIORITÉS NON-NÉGOCIABLES
1. TypeScript strict (jamais any)
2. Mobile-first absolu (touch targets ≥44px, breakpoints sm/md/lg/xl)
3. Tests Vitest sur toute logique métier (lib/)
4. Composants découpés (≤300 lignes par fichier)
5. Performance Lighthouse mobile ≥85
6. Accessibilité WCAG AA
7. Realtime Supabase pour container fill/MOQ
8. CGV blindées B2B (voir section 18, 10 articles)
9. Protection juridique importateur (assurance, audit trail)
10. SEO/GEO/LLM optimisé dès la V1

ATTAQUE PHASE 1 (foundations) MAINTENANT

1. Vérifie/crée la structure de fichiers (section 4.2)
2. Crée les migrations Supabase :
   - 0001_init_schema.sql (schéma complet section 5.1 — NOTE : delivery_zones
     et postal_code_zones supprimées en v1.2, remplacées par carrier_partners
     et delivery_history)
   - 0002_pricing_config.sql (seed app_config)
   - Pousse vers Supabase et vérifie qu'elles passent
3. Crée le seed data (section 21) dans supabase/seed.sql incluant
   les 5 carrier_partners initiaux
4. Active Supabase Realtime sur les 4 tables critiques
5. Installe les dépendances :
   @supabase/supabase-js, stripe, @stripe/stripe-js, resend,
   react-email, @react-three/fiber, @react-three/drei, lucide-react,
   zustand, react-hook-form, zod, @hookform/resolvers,
   @tanstack/react-query, vitest, @testing-library/react
6. Configure Tailwind v4 avec la palette (section 15.1)
7. Configure les variables env (.env.example) selon section 4.3
8. Crée les composants logique métier pure avec tests :
   - src/lib/pricing/tiers.ts (avec test exhaustif des tiers)
   - src/lib/pricing/reservation-fee.ts
   - src/lib/pricing/moq.ts
   - src/lib/pricing/loyalty.ts
   - src/lib/pricing/aggregation.ts
   - src/lib/container/fill-calculator.ts
   - src/lib/container/status.ts
   - src/lib/claims/sav.ts
9. Implémente l'auth magic link Supabase :
   - src/routes/auth/login.tsx
   - src/routes/auth/callback.tsx
   - src/lib/supabase/{client,server,types}.ts
   - Hook useAuth

LIVRABLE FIN PHASE 1 (DoD)
- npm test passe à 100% sur les fichiers lib/
- npm run typecheck : 0 erreur
- Supabase migrations s'exécutent sans erreur
- Login magic link fonctionne en local
- Documentation README.md à jour

VALIDE LA PHASE 1 avant de passer à la 2 (catalogue + réservation).
Pose des questions si le brief est ambigu sur un point précis.
```

---

**Fin du document v1.2** — ~4 200 lignes — Document exhaustif prêt pour génération complète par Claude Code en 8 phases.

Versionne ce document dans Git à la racine. Toutes les évolutions futures du projet doivent commencer par mettre à jour ce fichier.
