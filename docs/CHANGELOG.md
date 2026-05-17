# 📜 Container Club — Changelog des versions de spec

> Toutes les évolutions du brief technique `CONTAINER_CLUB_SPEC.md`.
> Format inspiré de Keep a Changelog.
> Date sous format YYYY-MM-DD.

## [Non publié]

Aucun changement en cours.

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
