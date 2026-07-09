# Audit — Outil de pilotage pricing admin (fiabilité & améliorations)

> Audit du 09/07/2026, après restauration du cockpit CODEX. Objectif : un
> outil **fiable** (ce qu'il affiche est vrai, ce qu'il enregistre agit) et
> **productif** (piloter 165 produits sans friction). Chaque constat cite le
> code ; chaque proposition est classée P0/P1/P2.

---

## 1. Verdict de fiabilité

### 🔴 Constat central : le panneau « Paramètres pricing » est aujourd'hui un placebo à 80 %

La chaîne théorique du moteur CODEX est :
`pricing_parameters` (fret, taux, marges) → `calculate_product_landed_cost_ht()`
→ `get_price()` → prix affichés/facturés.

**Mais dans le site actuellement en production, PERSONNE n'appelle
`get_price()` ni `get_public_product_prices()`** (seule une mention texte
dans l'aide du panneau, `AdminCatalogueTab.tsx:314`). Le catalogue public lit
`products.base_price_ht` (via `get_catalogue_prices`), et **rien ne recalcule
jamais `base_price_ht`** quand tu changes le fret ou une marge — aucun
trigger, aucun update (vérifié dans les 3 migrations moteur).

Concrètement : tu passes le fret de 4 500 € à 5 200 € dans le panneau →
l'enregistrement réussit, l'audit log s'écrit… **et aucun prix ne bouge
nulle part.** (Le frontend CODEX d'origine, lui, consommait le moteur en
direct via `get_public_product_prices` dans son `db.ts`/`cart.store.ts` —
c'est ce lien que la fusion a coupé, à raison côté architecture, sans le
remplacer côté outil.)

### Ce qui, en revanche, fonctionne réellement aujourd'hui

| Levier du panneau / éditeur | Effet réel |
|---|---|
| Marges direct/revendeur/distributeur | ✅ **Oui** — consommées par `get_catalogue_prices` v2 et la validation de réservation v3 (coefficients canaux) |
| Prix net partenaire (par produit) | ✅ Oui — écrit dans `product_partner_prices`, plancher de marge garanti par trigger |
| Prévisualisation calculée de l'éditeur produit | ✅ Oui — landed cost + prix par canal recalculés à l'écran depuis FOB (`AdminProductEditor.tsx:190-234`) |
| `base_price_ht` saisi à la main | ✅ Oui — c'est LA source des prix publics |
| Fret, taux USD/EUR, douane, assurance, frais fixes | ❌ **Aucun effet** sur les prix publics |
| Paliers volume (qté/remise) du panneau | ❌ Aucun effet — la grille client est codée en dur (`customer-discounts.ts` : 100→6 %, 150→10 %) |
| Frais de réservation (3 % / 150 / 500) du panneau | ❌ Aucun effet — codés en dur dans le RPC de réservation |

### Autres constats de fiabilité

1. **Versioning fantôme** — le schéma est conçu versionné (`version`,
   `is_active`, `effective_from`, index « une seule active ») mais
   `updatePricingParameters` **écrase la ligne active en place**
   (`repository.ts`) : aucun historique, aucun retour arrière, la
   traçabilité promise par le schéma n'existe pas.
2. **SKU témoin inerte** — les 7 champs `control_*` (ZF2000C : landed
   33,78 € → direct 64,18 €, etc.) sont conçus pour détecter une dérive de
   formule… mais rien ne les vérifie, ni en base ni à l'écran.
3. **Plancher de marge partiel** — `get_price` respecte
   `min_margin_floor` ; le chemin réellement utilisé (base × coefficient)
   ne connaît pas les planchers par produit. Tant que le recalcul est
   manuel, un `base_price_ht` saisi sous le plancher passe sans alerte.
4. **Saisie des coûts à l'unité** — 159 produits, FOB et qté/40HC à saisir
   produit par produit dans un dialog : l'outil décourage précisément la
   donnée dont le moteur a besoin (badge « Coûts à compléter »).
5. **Code** — `AdminCatalogueTab.tsx` ≈ 1 050 lignes (panneau + filtres +
   importeurs + table + 2 dialogs) ; conversions %↔taux dupliquées ;
   fonctions pricing du repository sans tests unitaires ; 4 boutons
   d'import de collections (utilitaires one-shot) en tête de toolbar.

---

## 2. Architecture recommandée : le recalcul explicite (« repricing »)

Deux options pour rebrancher le moteur :

- **Option A — prix dynamiques** (modèle CODEX d'origine) : le catalogue
  appelle le moteur à chaque lecture. Rejeté : ça re-couple le public au
  moteur, les prix bougent silencieusement (risque commercial), et ça
  défait la chaîne validée de bout en bout (canal + anti-fraude + factures).

- **Option B — recalcul explicite _(recommandée)_** : `base_price_ht` reste
  l'unique source des prix publics, et l'admin gagne un bouton
  **« Recalculer les prix »** : le moteur calcule le prix théorique de chaque
  produit ayant un FOB, l'écran affiche le **diff avant/après** (produit par
  produit, avec alertes plancher), et tu appliques en un clic — journalisé.
  Tu gardes le contrôle : changer le fret devient une décision visible, pas
  un effet de bord. C'est le comportement qu'un gérant attend d'un outil de
  pilotage.

---

## 3. Propositions (classées)

### P0 — Rendre l'outil VRAI (fiabilité)

> ✅ **Réalisé le 09/07/2026** — migration `20260709090000_pricing_pilotage_p0.sql`
> (à appliquer en prod, cf. `RUNBOOK_FUSION_DEPLOY.md` §2 lignes 9-10) +
> `src/lib/pricing/public-rules.ts`, panneau admin (bandeau témoin, carte
> « Recalcul des prix » avec aperçu diff, historique/restauration des
> versions), frais + paliers branchés client ET serveur sur les paramètres
> actifs avec la grille historique en fallback.

| # | Proposition | Ce que ça change |
|---|---|---|
| P0.1 | **Bouton « Recalculer les prix » avec diff** (dry-run → aperçu ancien/nouveau/Δ% par produit → appliquer) via `get_price` + RPC d'application auditée | Le panneau agit enfin sur les prix ; zéro surprise |
| P0.2 | **Versioning réel des paramètres** : chaque sauvegarde crée une nouvelle ligne (`version+1`), l'ancienne passe inactive ; historique + restauration dans le panneau | Traçabilité, rollback en 1 clic, le schéma tient sa promesse |
| P0.3 | **Garde-fou SKU témoin automatique** : à chaque affichage du panneau, recalcul du témoin vs `control_*` → bandeau vert « Formule conforme » ou rouge « Dérive détectée : +X % » | Détection immédiate d'une dérive de formule ou de données |
| P0.4 | **Unifier paliers volume + frais de réservation** : la grille client et le RPC de réservation lisent les valeurs des paramètres actifs (fallback = valeurs actuelles) | Les 4 champs « morts » du panneau prennent effet |

### P1 — Productivité (piloter 165 produits sans douleur)

| # | Proposition | Ce que ça change |
|---|---|---|
| P1.1 | **Import/export CSV des coûts** (SKU, FOB USD, qté/40HC, loss leader) avec validation et rapport d'erreurs | Saisir 159 FOB en 2 minutes depuis ton fichier fournisseur au lieu de 159 dialogs |
| P1.2 | **Simulateur d'impact dans le panneau** : avant d'enregistrer, « fret +15 % → prix moyen +2,3 %, 4 produits passeraient sous plancher, marge totale container +Y € » | Décider en connaissance de cause, sans tableur externe |
| P1.3 | **Édition inline** du prix HT et du FOB directement dans la liste produits (clic sur la cellule) | Corriger un prix = 3 secondes au lieu d'ouvrir l'éditeur complet |
| P1.4 | **Vue « Santé pricing »** en tête d'onglet : X produits sans FOB, Y sous plancher, Z sans image, dernier recalcul le… | L'état du catalogue en un coup d'œil |

### P2 — Intégration & code (dette)

| # | Proposition | Ce que ça change |
|---|---|---|
| P2.1 | **Rebaseline SQL** : intégrer proprement les 13 migrations fantômes CODEX dans l'historique du repo (renumérotées, dédupliquées avec nos bridges) | CI/preview identiques à la prod ; fin définitive de la couche fantôme |
| P2.2 | **Découpage** : `PricingParametersPanel`, filtres et importeurs extraits de `AdminCatalogueTab` ; helpers %↔taux partagés + testés ; tests unitaires des fonctions pricing du repository | Fichier lisible, régressions détectables |
| P2.3 | **Ranger les importeurs de collections** dans un panneau repliable « Données » (voire les retirer une fois l'import définitif) | Toolbar centrée sur le quotidien |
| P2.4 | Types Supabase **générés** (`supabase gen types`) au lieu de maintenus à la main | Fin des divergences types/DB comme celle qui a cassé la fusion |

---

## 4. Ordre d'exécution proposé

1. **Sprint fiabilité (P0.1 → P0.4)** — c'est lui qui transforme le panneau
   en vrai levier de pilotage. P0.1+P0.3 d'abord (recalcul + témoin), puis
   P0.2 (versions), puis P0.4 (unification).
2. **Sprint productivité (P1.1 → P1.4)** — CSV en premier : c'est le
   déblocage des 159 « Coûts à compléter ».
3. **Dette (P2)** — le rebaseline P2.1 en session dédiée, à froid.

*Références code : `AdminCatalogueTab.tsx` (panneau l.128-334, note l.314),
`AdminProductEditor.tsx` (préviz l.175-240), `catalogue-admin/repository.ts`
(update in place), migrations fantômes `20260701110000` (`get_price`,
planchers, l.242 fallback base→landed), `20260702113000`
(`get_public_product_prices`), grille client `customer-discounts.ts`, frais
codés en dur `20260706100000` (RPC réservation).*
