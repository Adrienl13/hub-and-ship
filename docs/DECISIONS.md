# 🧭 Container Club — Décisions techniques

> Journal des décisions techniques actées.
> Évite de redécider les mêmes choses plusieurs fois.
> Claude Code consulte ce fichier avant de proposer une nouvelle approche.

## Format

Chaque décision suit ce template :

```
## D-XXX — Titre court (YYYY-MM-DD)

**Statut** : Acceptée | Remplacée par D-YYY | Abandonnée
**Contexte** : Pourquoi cette décision était nécessaire
**Décision** : Ce qui a été choisi
**Alternatives** : Ce qui a été considéré et écarté
**Raison** : Justification du choix
**Conséquences** : Impacts attendus
```

---

## Décisions actées

### D-001 — Stack frontend TanStack Start v1 (2026-05-15)

**Statut** : Acceptée
**Contexte** : Choix framework React full-stack moderne
**Décision** : TanStack Start v1 + React 19 + TypeScript strict
**Alternatives** :

- Next.js 15 : trop opinionated, moins flexible
- Remix : excellent mais TanStack offre meilleure DX TypeScript
- Pure SPA Vite : pas de SSR, mauvais pour SEO B2B
  **Raison** : SSR natif, file-based routing, TS-first, intégration TanStack Query native, performance excellente, bundle léger
  **Conséquences** : Stack récente, communauté plus petite, mais documentation solide

---

### D-002 — Backend Supabase (2026-05-15)

**Statut** : Acceptée
**Contexte** : Choix BaaS pour MVP rapide
**Décision** : Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
**Alternatives** :

- Backend custom Node : trop long pour MVP
- Firebase : NoSQL inadapté pour data relationnelles B2B
- PocketBase : trop jeune, écosystème limité
  **Raison** : PostgreSQL = SQL puissant pour calculs métier, RLS robuste, Auth magic link out-of-box, Realtime WebSocket natif, EU hosting RGPD, prix raisonnable
  **Conséquences** : Vendor lock-in partiel, mitigé par compatibilité PostgreSQL standard

---

### D-003 — Pricing tiers méthode incrémentale (2026-05-17)

**Statut** : Acceptée
**Contexte** : Choisir entre tiers all-units vs incrémental
**Décision** : Méthode INCRÉMENTALE (chaque tranche CBM facturée au tier correspondant)
**Alternatives** :

- All-units : profit leakage important
- Volume thresholds rigides : pas de progressivité
  **Raison** : Évite la triche par fractionnement de commande, équitable, calcul déterministe
  **Conséquences** : Logique plus complexe à expliquer client → on affiche "économies débloquées" plutôt que "marge"

---

### D-004 — Catégories produits unifiées tables (2026-05-17)

**Statut** : Acceptée
**Contexte** : Gérer tables avec plateau + pied séparables ou ensemble
**Décision** : Catégorie unique `table` avec `product_variant_combinations` multi-axes
**Alternatives** :

- Tables séparées table_top / table_leg : gestion MOQ complexe
- Variantes simples : impossible de gérer "pied seul"
  **Raison** : Permet variante spéciale "pied seul -30%" via flag `is_special_combo`
  **Conséquences** : Schéma DB plus complexe mais UX cohérente

---

### D-005 — Coût landed port (2026-05-17)

**Statut** : Acceptée (V1.1)
**Contexte** : Champ admin pour coût d'achat — FOB ou rendu port
**Décision** : `cost_landed_port_eur` = prix usine + transport maritime jusqu'au port FR
**Alternatives** :

- `cost_fob_eur` : nécessite calcul fret par produit (complexe)
  **Raison** : Simplification calcul marge, transport maritime mutualisé par container plus simple à gérer au global
  **Conséquences** : Marge brute affichée par produit ne tient pas compte des frais douane/commissionnaire (gérés au niveau container)

---

### D-006 — Livraison V1 : rendue port (2026-05-17)

**Statut** : Acceptée (V1.2)
**Contexte** : Pas de partenariats transporteurs au lancement
**Décision** : Prix rendu port + liste transporteurs recommandés (sans facturation)
**Alternatives** :

- Forfaits internes par zone : risque marge négative, SAV transport à porter
- Upela API : devis incompatible avec délai 60j entre résa et arrivée port
  **Raison** : Zéro engagement, transparence, apprentissage des vrais coûts pour V2
  **Conséquences** : Plus de friction client mais positionnement "transparence" assumé. Évolution V2 prévue avec contrat-cadre transporteur

---

### D-007 — Vérification SIRET API INSEE (2026-05-17)

**Statut** : Acceptée (V1.3)
**Contexte** : Validation des sociétés B2B obligatoire
**Décision** : API INSEE Sirene gratuite (OAuth2, 30 req/min) + cache 7 jours
**Alternatives** :

- Pappers API : 50€/mois minimum, overkill pour 1 vérif/compte
- siren-api.fr : payant aussi
- Vérification manuelle admin : non scalable
  **Raison** : Source officielle, gratuit, données fraîches quotidiennes, suffisant pour notre volume
  **Conséquences** : Pas de SLA → fallback gracieux nécessaire, cron de re-vérification

---

### D-008 — SIRET cessé = blocage strict (2026-05-17)

**Statut** : Acceptée (V1.3)
**Contexte** : Comportement si SIRET cessé/inactif à l'INSEE
**Décision** : Blocage strict création compte
**Alternatives** :

- Warning + création possible : risque fraude
- Vérification manuelle admin : friction supplémentaire
  **Raison** : Risque juridique et financier trop important d'accepter une société non-existante
  **Conséquences** : Si vraie erreur INSEE → suggérer contact admin

---

### D-009 — Emails personnels = warning souple (2026-05-17)

**Statut** : Acceptée (V1.3)
**Contexte** : Beaucoup de pros indépendants n'ont pas d'email pro
**Décision** : Warning visible mais création possible
**Alternatives** :

- Blocage strict : perte 5-10% prospects (artisans, indépendants)
- Aucune validation : pas de signal qualité
  **Raison** : B2B inclut beaucoup de TPE/indépendants. Warning suffit pour les pros qui veulent paraître crédibles
  **Conséquences** : Tracking dans `security_events` pour analyse statistique

---

### D-010 — Rate limiting Cloudflare WAF V1 (2026-05-17)

**Statut** : Acceptée (V1.3)
**Contexte** : Protection endpoints sensibles
**Décision** : Cloudflare WAF (gratuit, déjà inclus) en V1, architecture prête Upstash pour V2
**Alternatives** :

- Upstash Redis dès V1 : ~10€/mois inutile pour volume initial
- Rate limit DB Postgres : plus complexe, moins performant
  **Raison** : Suffisant pour démarrage, économie 120€/an, migration future possible sans rework
  **Conséquences** : Règles moins fines que rate limit applicatif user-level, OK pour V1

---

### D-011 — Magic link auth uniquement (2026-05-15)

**Statut** : Acceptée
**Contexte** : Stratégie d'authentification
**Décision** : Magic link Supabase uniquement, pas de password
**Alternatives** :

- Email + password : risque password volé, gestion mots de passe oubliés
- SSO Google/LinkedIn : trop intrusif pour B2B, pas tous les pros ont Google Workspace
- Passkeys : trop récent, support fragmenté
  **Raison** : Pas de password = pas de password volé, UX fluide, sécurité forte
  **Conséquences** : Dépendance email opérationnel, prévoir fallback support

---

### D-012 — RGPD : suppression compte = anonymisation (2026-05-17)

**Statut** : Acceptée (V1.3)
**Contexte** : Droit à l'oubli RGPD vs obligation conservation comptable
**Décision** : Anonymisation données personnelles, conservation données comptables 10 ans
**Alternatives** :

- DELETE physique : viole obligation conservation factures
- Conservation totale : viole RGPD
  **Raison** : Compromis légal optimal, audit trail préservé
  **Conséquences** : Bouton "Supprimer mon compte" fait anonymisation, pas DELETE

---

## ⚠️ Décisions à prendre

Liste des questions ouvertes nécessitant arbitrage utilisateur :

- [ ] Aucune décision en attente

---

### D-013 — Dépendances React 19 compatibles R3F (2026-05-17)

**Statut** : Acceptée
**Contexte** : Le template Session 0 demandait React 19 RC avec `@react-three/fiber` v8, mais npm refuse l'installation car R3F v8 déclare un peer dependency React `>=18 <19`.
**Décision** : Conserver React 19 et mettre à jour `@react-three/fiber` en v9, `@react-three/drei` en v10, `three`, les types React/Three, et les SDK Stripe React/JS vers des versions dont les peer dependencies acceptent React 19.
**Alternatives** : Revenir à React 18 aurait contredit la décision D-001 et la stack indiquée dans le starter.
**Raison** : Ajustement minimal pour garder la stack React 19 tout en obtenant une installation npm propre.
**Conséquences** : Les futures scènes 3D devront suivre les APIs R3F v9, et l'intégration paiement devra suivre les APIs Stripe React v6.

---

### D-014 — TanStack Start Vite actuel pour Session 0 (2026-05-17)

**Statut** : Acceptée
**Contexte** : Le template utilisait le package historique `@tanstack/start` avec `vinxi`, mais l'écosystème actuel expose TanStack React Start via `@tanstack/react-start` et Vite.
**Décision** : Utiliser `@tanstack/react-start`, `@tanstack/react-router` et `@tanstack/router-cli` actuels, avec scripts `vite` pour dev/build/preview.
**Alternatives** : Forcer `vinxi` aurait conservé un scaffold plus proche du template, mais avec des imports virtuels et packages React Start incohérents sur npm actuel.
**Raison** : Obtenir une initialisation Session 0 installable, testable et maintenable sans bloquer sur une génération obsolète.
**Conséquences** : La configuration projet est Vite-first ; les futures étapes doivent suivre la documentation TanStack React Start récente.

---

### D-015 — Audit dépendances compatible Bun (2026-06-04)

**Statut** : Acceptée
**Contexte** : Le projet utilise `bun.lock`, donc `npm audit` échoue sans `package-lock.json`. L'audit Bun a ensuite signalé des advisories via `vitest@2`, `supabase@1` et leurs dépendances transitives.
**Décision** : Utiliser `bun audit --audit-level=moderate`, mettre à jour Vitest en v4 avec le plugin React dans `vitest.config.ts`, Supabase CLI en v2, Vite/TanStack Start en patch courant et Wrangler/Cloudflare Vite plugin en patch courant.
**Alternatives** : Ajouter un `package-lock.json` juste pour `npm audit` aurait doublonné le lockfile ; ignorer les advisories aurait laissé un audit sécurité rouge.
**Raison** : Garder un seul gestionnaire de dépendances cohérent et supprimer les vulnérabilités sans changer la stack applicative.
**Conséquences** : Les futures commandes d'audit doivent passer par Bun ; les tests TSX Vitest dépendent explicitement du plugin React.

---

### D-016 — Création réservation atomique via RPC Supabase (2026-06-05)

**Statut** : Acceptée
**Contexte** : Le tunnel public écrivait d'abord `reservations`, puis `reservation_items` depuis le navigateur. Une erreur sur le second insert pouvait laisser une réservation orpheline/incomplète visible en admin.
**Décision** : Créer `public.create_reservation_with_items(payload jsonb)` en `SECURITY DEFINER`, appelée par le client pour insérer réservation + lignes dans une seule transaction. La migration supprime ensuite les policies d'insert anonyme direct.
**Alternatives** : Garder deux inserts client avec cleanup manuel en cas d'erreur ; ajouter un endpoint serveur Cloudflare utilisant la service role.
**Raison** : La RPC garde la logique au plus près de PostgreSQL/RLS, évite un endpoint applicatif supplémentaire et permet des validations serveur sur les totaux, le SIRET, le statut initial et l'appartenance des lignes.
**Conséquences** : La migration DB doit être appliquée avant de considérer la surface RLS fermée. Le frontend conserve un fallback legacy uniquement pour survivre à un environnement où la RPC n'existe pas encore.

---

### D-017 — Filet serveur pour les demandes stock 24h (2026-06-06)

**Statut** : Acceptée
**Contexte** : Le stock 24h capte des demandes urgentes. Un échec de l'insert public Supabase navigateur (env anon absente, RLS en dérive, réseau client) ne doit pas transformer le lead en simple erreur silencieuse.
**Décision** : Ajouter `/api/stock-requests`, un endpoint serveur same-origin qui accepte uniquement l'ID du lot + coordonnées client, reconstruit le draft depuis le catalogue stock local et persiste via la service role Supabase. Le hook public tente navigateur, endpoint serveur, puis sauvegarde locale sur l'appareil en dernier ressort.
**Alternatives** : Garder uniquement l'insert navigateur ; envoyer toutes les demandes stock par email ; accepter un payload complet depuis le navigateur.
**Raison** : La reconstruction côté serveur évite de faire confiance aux prix/snapshots envoyés par le client et réduit le risque de perdre une demande chaude pendant une dérive d'environnement.
**Conséquences** : Le fallback local reste un mode dégradé non centralisé ; il doit être annoncé comme tel. La route serveur dépend de `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` côté worker.

---

## 📚 Lectures de référence

- [ADR Github template](https://github.com/joelparkerhenderson/architecture-decision-record)
- OWASP Top 10 2025 : https://owasp.org/Top10/
- API INSEE Sirene : https://portail-api.insee.fr/catalog/api/2ba0e549-5587-3ef1-9082-99cd865de66f
