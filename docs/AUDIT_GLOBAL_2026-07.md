# Audit global — Container Club / prosimport.com

> Audit du 11/07/2026, à la demande d'Adrien : « vérifier que tout fonctionne,
> liens logiques, clics, intégrations partenaires, interfaces, espace admin,
> formules, changements de prix — tout doit être viable, qualitatif et
> fonctionnel », + fonctionnalités manquantes + personnalisation visuelle.
>
> **Méthode** : 8 auditeurs spécialisés en parallèle (navigation, chemin de
> l'argent, moteur pricing, espace admin, chaîne partenaires, données/SEO,
> UX/confiance, sécurité), chaque constat critique/majeur soumis à un
> contre-expert indépendant chargé de le réfuter — seuls les constats
> confirmés figurent ici. En complément : simulation réelle dans un
> navigateur (Chromium piloté) sur les 15 pages publiques + parcours d'achat
> par catégorie + dialog de réservation.

---

## 1. Ce que les simulations réelles confirment ✅

Parcours exécutés dans un vrai navigateur (viewport 1440×900, fr-FR) :

| Vérification | Résultat |
|---|---|
| Les 15 pages publiques répondent 200 avec titre + H1 uniques | ✅ (14/15 — la 404 répond bien 404) |
| Fiche produit : dialog s'ouvre, prix affiché, MOQ affiché | ✅ sur chaque catégorie testée |
| Filtres catalogue par type (Chaise/Fauteuil/Table/Banc) avec compteurs | ✅ |
| **Formules du checkout à l'écran** : panier 6 340 € HT → frais 190 € (3 % borné 150/500 ✓), acompte 1 712 € (30 % − frais ✓), solde 4 438 € (somme exacte ✓) | ✅ **les maths affichées sont justes** |
| Tunnel 4 étapes (SIRET → Contact → Livraison → Paiement) avec vérification INSEE | ✅ s'ouvre et gate correctement (Continuer désactivé sans SIRET vérifié) |
| Pages produit SSR (sitemap) : 200, H1, prix | ✅ |
| Page 404 : design propre + retours accueil/catalogue | ✅ |

*Limite d'environnement : l'audit navigateur a tourné sur le catalogue de
secours (Supabase injoignable depuis la sandbox) — les vérifications de
données live (165 produits, images) s'appuient sur le code + la prod déjà
vérifiée ensemble ce matin.*

---

## 2. Constats confirmés — synthèse

> 8 auditeurs ont remonté ~80 constats. La contre-expertise automatique a été
> interrompue par une limite de session ; j'ai donc **re-vérifié moi-même, par
> lecture directe du code, les 8 critiques et les majeurs porteurs** ci-dessous
> (colonne « Vérifié »). Les constats marqués « auditeur » sont crédibles mais
> non encore re-confirmés à la main — à traiter avec la même méthode avant fix.

### 🔴 Critiques (bloquent une fonction vitale)

| # | Constat | Preuve | Vérifié |
|---|---|---|---|
| C1 | **Le panier n'accepte que 6 produits de démo.** `setQty` valide l'id contre le mock `PRODUCTS` (p1…p6) ; tout produit réel du catalogue DB (ex. `bistro-bis-001`) ou créé par l'admin a un id absent du mock → `setQty` ne fait **rien**, impossible de l'ajouter au panier. | `src/stores/cart.store.ts:107-108` (`PRODUCTS.find(...)` puis `if (!product) return previous`) ; ids mock `products.ts:50-234`, ids DB `bistro-products.ts:7` | ✅ manuel |
| C2 | **Une seule réservation par container et par jour.** La référence `CC-XXX-YYYYMMDD-0001` est générée avec `sequence=1` en dur (aucun appelant ne le passe) ; la colonne `reference` est UNIQUE ; le RPC insère sans `ON CONFLICT` ni retry → la 2ᵉ réservation du jour (ou un client qui re-tente après un paiement annulé) échoue sur violation de contrainte. | `src/lib/reservations/draft.ts:126-141` ; contrainte `20260518162000:33` ; RPC `20260709090000:518-587` | ✅ manuel |
| C3 | **La remise volume −6 %/−10 % est promise mais jamais déduite.** `/prix` affirme « s'appliquent au panier, sans négociation ni code » et le widget panier affiche « Remise active 10 % », mais `calculateOrder` n'applique aucune remise — le sous-total et le montant payé ignorent les paliers. | `src/routes/prix.tsx:33-34` ; `TieredPricingViz.tsx:44-47` ; `src/lib/order.ts` (aucune logique de remise) | ✅ manuel |
| C4 | **Pages imbriquées invisibles (routes sans `<Outlet/>`).** Trois routes parentes ne rendent pas d'`<Outlet/>` → leurs enfants ne s'affichent jamais : **espace partenaire /partner/selections**, **devis co-brandé /p/$slug/devis** (CTA « Télécharger le devis » mort), **récapitulatif & factures client** `/account/reservations/$id/document` et `/facture/$id`. | `partner.tsx`, `p.$partnerSlug.tsx`, `account.reservations.$reservationId.tsx` : `grep Outlet = 0` | ✅ manuel |
| C5 | **Fonction serveur d'accrual de commission sans authentification.** `accrueReservationCommission` est une server-function `POST` qui utilise le client **service-role** sans aucun contrôle `is_admin`/session. L'`AdminGuard` ne protège que le composant client, pas l'endpoint HTTP → n'importe qui peut déclencher/écrire des commissions. | `src/lib/commission/ledger-server.ts:34-113` ; garde client seule `AdminCommissionsTab` sous `AdminGuard` | ✅ manuel |
| C6 | **Le Stock 24h public est un inventaire fictif codé en dur** (même en prod), alors que l'admin gère de vraies lignes de stock — le lecteur DB `useStockLines` n'est branché nulle part. | `src/routes/stock-24h.tsx:78` (`getAvailableStockLines()` sans argument = fixture `AVAILABLE_STOCK`), teaser home `index.tsx:457` | ✅ manuel |
| C7 | **Flux Google Merchant invalide.** `product-feed.xml` émet un `image_link` **relatif** (rejeté par Merchant) et détourne `g:multipack` = MOQ avec un `g:price` **unitaire** → Google lit un pack de 50 au prix d'une chaise (prix faussé ×50). | `src/routes/product-feed[.]xml.tsx:33,34,40` | auditeur |
| C8 | **Preuves & témoignages fictifs présentés comme réels.** 3 containers « livrés » (CC-2025-012/013/014) avec citations, notes 5/5 et photos Unsplash inventées sont servis comme « Preuves » — en contradiction frontale avec `/avis` qui indique n'avoir encore aucun avis. Un seul faux repéré détruit la crédibilité de `/prix`. | `src/lib/products.ts:301-356` ; fallback `listFallbackDeliveredContainers` | auditeur |

### 🟠 Majeurs (dégradent une fonction sans la bloquer)

| # | Constat | Vérifié |
|---|---|---|
| M1 | **Règle d'or contournable** : le recalcul (P0) et l'ajustement ciblé réécrivent `base_price_ht` **sans revalider** `channel_price_overrides` ; le trigger ne se déclenche qu'à l'écriture d'un override → un prix revendeur peut passer au-dessus du prix public. | ✅ manuel |
| M2 | **`admin_save_pricing_parameters` sans bornes** : aucun check de cohérence (tier3 ≤ tier2, min > max, taux > 1 ou négatif) → une typo admin peut publier des prix revendeur **négatifs** ou casser tous les checkouts. | ✅ manuel |
| M3 | **Le panier ne se vide jamais après un paiement réussi** (`resetCart` n'est appelé nulle part hors tests) → le client garde son panier « payé » et peut re-réserver par erreur. | ✅ manuel |
| M4 | **Règles de prix dupliquées en dur** sur `/prix` + FAQ + hero alors que le moteur est devenu dynamique (P0) → divergence garantie au 1ᵉʳ changement admin. | ✅ manuel |
| M5 | **Deux espaces partenaires concurrents** `/partner` (header, gaté `is_partner`) et `/partenaire` (footer, QR + commissions) avec gating incompatible → un partenaire approuvé peut ne rien voir. | auditeur |
| M6 | **Reprice → checkouts en cache cassés** : le catalog store ne refetch jamais ; après `admin_apply_reprice`, un panier ouvert garde l'ancien prix et le RPC anti-tampering rejette la réservation. | auditeur |
| M7 | **Hero home sans CTA** : le catalogue (moteur de conversion) arrive après 6 sections. | ✅ manuel |
| M8 | **Aucun téléphone ni adresse** sur `/contact` ni dans le footer — réassurance insuffisante pour des paniers 10-30 k€. | ✅ manuel |
| M9 | **Prix net partenaire sous le plancher** : le front n'avertit qu'en orange non bloquant, aucun garde-fou SQL sur `product_partner_prices`. | auditeur |
| M10 | **MOQ incohérents** : 7 tables de la collection bistrot à MOQ 50 alors que toutes les autres tables sont à 20. | auditeur |
| M11 | **Fuite du prix net partenaire** via les sélections publiées (le snapshot fige le prix canal du revendeur). | auditeur |
| M12 | **Commission créditée dès le statut `reserved`** (acompte seul) alors que la règle est « CA encaissé ». | auditeur |
| M13 | **Aucun moyen (UI ni RPC) de créer un `partner_code`** → la chaîne apporteur est coupée à l'étape clé. | auditeur |
| M14 | **`users_profile`/`companies` jamais créés** à l'inscription → la résolution de canal retombe toujours sur `direct` (latent : aucun revendeur live aujourd'hui, mais bloquant le jour où on en active un). | auditeur |
| M15 | **Pas de rate-limiting** sur `/api/contact`, `/api/partner-requests`, `/api/stock-requests` (seul garde = same-origin, contournable). | auditeur |

### 🟡 Mineurs notables

Maillage interne des fiches produit quasi nul (liens seulement via sitemap) ·
navigation header en `<a href>` (rechargement complet + perte du panier
mémoire) · éco-contribution calculée mais jamais facturée · `table_price_modifier_rate`
éditable mais consommé par aucune formule · triple identité de marque (Container
Club / Pros Import / Terrassea) exposée · emails légaux en `@terrassea.fr` vs
`@prosimport.com` partout ailleurs · `llms.txt` expose un Gmail personnel ·
frais mini 150 € possibles sur une commande inférieure · CSP en Report-Only avec
`unsafe-inline`/`unsafe-eval`.

### ✅ Ce qui fonctionne (confirmé)

Redirection www→apex (308) · page 404 propre · header/footer : tous les liens
primaires + 7 Ressources + 6 slugs légaux + 5 guides résolus · sitemap.xml (28
URLs) 100 % valides · **les 1121 images `/catalogue/**.webp` référencées
existent toutes** · capture d'attribution partenaire (`/p/$slug`, `?partner=`,
TTL 120 j) · 16 onglets admin rendus, deep-links emails validés · **les maths du
checkout à l'écran sont exactes** (frais 3 %/150/500, acompte 30 %−frais, solde =
reste, TVA 20 %) · tunnel 4 étapes avec vérification INSEE du SIRET · moteur
pricing P0 (recalcul explicite, versions, témoin) cohérent avec le SQL.

---

## 3. Personnalisation & design — propositions concrètes

### 3.1 Le diagnostic en une phrase

Le site est **éditorialement excellent** (le wording « On ne vous demande pas
de nous croire. On vous montre la méthode. » est au niveau des meilleures
D2C) mais **visuellement muet** : crème + typographie, zéro photographie
d'ambiance, zéro humain, zéro terrasse. Un gérant qui atterrit doit LIRE pour
comprendre. Ton objectif (« comprendre sans lire un seul mot ») demande
d'inverser la charge : l'image porte le message, le texte confirme.

**Atout inexploité n°1 : vous avez déjà 1 277 photos produit réelles dans
`/public/catalogue/`** — la matière première existe, elle n'est simplement
jamais mise en scène en dehors des cartes catalogue.

### 3.2 Sept propositions, par ordre d'impact

| # | Proposition | Pages | Effort |
|---|---|---|---|
| D1 | **Hero photographique plein écran** : une terrasse de restaurant équipée (golden hour, chaises Bistrot réelles), titre court par-dessus, UN CTA « Voir le catalogue ». Le visiteur voit le produit fini dans son contexte AVANT tout texte. À défaut de shooting : composition à partir des photos produit sur fond de terrasse (ou visuel généré photo-réaliste en attendant le premier container livré). | `/` | M |
| D2 | **Bande « la preuve par l'image »** : frise horizontale usine → container → port → terrasse (4 photos réelles du prochain container : contrôle SGS, chargement, déchargement, installation). C'est la version visuelle de la page /prix — et ça tue le doute « import = arnaque ». Chaque container livré enrichit la frise. | `/`, `/prix`, `/qualite` | S (process) + shooting terrain |
| D3 | **Mise en situation par catégorie** : en tête de chaque filtre catalogue et des landings chaises/tables, un bandeau photo « ambiance » (terrasse bistrot, rooftop lounge, brasserie) au lieu du fond uni. Les 4 collections (Bistrot, Cordage, Textilène, Piètements) deviennent des univers visuels distincts — pattern Apple : une gamme = une scène. | `/catalogue`, landings | M |
| D4 | **Configurateur visuel de terrasse** (le « wow » différenciant) : « Votre terrasse : 40 couverts » → le site propose le mix chaises+tables correspondant, l'affiche dans la scène 3D container déjà existante (elle est là, sous-exploitée !) et chiffre l'économie vs showroom. La 3D actuelle montre des cartons ; montrer la TERRASSE équivalente est l'étape d'après. | `/`, `/catalogue` | L |
| D5 | **Visages et voix** : photo d'Adrien/équipe + « qui importe pour vous » sur /a-propos et en signature de /prix ; à terme vidéo 60 s « pourquoi j'ai créé Container Club ». En B2B artisanal, l'incarnation est le premier signal de confiance — aujourd'hui le site est anonyme. | `/a-propos`, `/`, `/prix` | S |
| D6 | **Unifier l'identité visuelle** : une seule marque visible (Container Club), Pros Import en mention légale, retirer « Terrassea » des titres SEO ou l'assumer partout. Trois noms = trois fois moins de confiance. Logo réel (le « C » carré actuel fait placeholder). | global | S |
| D7 | **Design tokens de réassurance** : téléphone cliquable + adresse dans le footer et /contact, badges paiement (Stripe, CB, virement), drapeau « Importateur officiel enregistré en France — EORI », compte à rebours réel du container en cours. Petits éléments, gros effet sur un panier à 15 k€. | global | S |

### 3.3 Références utiles (pour se calibrer)

- **Apple** : une scène par produit, titre 5 mots, zéro paragraphe au-dessus
  de la ligne de flottaison → à transposer : une terrasse par collection.
- **Tediber / Emma** : la réassurance en bande continue (livraison, essai,
  garantie) sous le hero → à transposer : « Direct usine · Contrôle SGS ·
  Acompte protégé · −40 % vs showroom ».
- **Ankorstore / Faire (B2B)** : le prix pro affiché avec le « retail
  comparé » barré + MOQ explicite dès la carte produit (déjà bien fait ici) ;
  leur leçon : le B2B convertit sur la clarté des conditions, pas sur le
  lyrisme.
- **Maison Drucker / Fermob (concurrents mobilier terrasse)** : galeries de
  réalisations par établissement — la « preuve par le client équipé » est le
  standard du secteur.

---

## 4. Fonctionnalités manquantes (vision business)

Classées par impact sur la confiance et la conversion :

1. **Honorer les paliers volume au paiement** — le site PROMET −6 %/−10 %
   « appliqués au panier sans code » ; aujourd'hui c'est affiché mais jamais
   déduit. C'est LE chantier n°1 (intégrité de la promesse publique).
2. **Stock 24h branché sur la vraie base** — la page publie un inventaire
   fictif codé en dur alors que l'admin gère de vraies lignes de stock.
3. **Preuves réelles uniquement** — remplacer les containers « livrés » et
   témoignages de démonstration par un état honnête (« premier container en
   cours — suivez-le ») tant qu'il n'y a pas de vraie livraison. Un seul
   faux avis découvert détruit toute la page /prix.
4. **Calculateur d'économie terrasse** (« 40 couverts → X chaises + Y tables
   = Z € vs showroom ») sur / et /prix — transforme la promesse abstraite en
   chiffre personnel. (Était déjà dans la stratégie NEXT.)
5. **Rappel téléphonique / WhatsApp Business** — le gérant pressé ne remplit
   pas un formulaire email pour un devis à 15 k€.
6. **Suivi de container public** (« CC-2026-001 : 62 % rempli, départ estimé
   sept. ») avec jalons réels — c'est l'ADN du concept, il mérite une page.
7. **Import CSV des coûts FOB** (P1.1 de l'audit pricing) — débloquer les
   159 « Coûts à compléter » pour que le moteur serve à quelque chose.
8. **Emails transactionnels de cycle de vie** — confirmation de réservation
   détaillée, jalons du container (80 %, départ, arrivée), pas seulement le
   magic-link.

---

## 5. Ordre d'exécution recommandé

**Sprint 1 — « le site tient ses promesses » (avant toute pub) :**
C1 (panier), C3 (remise volume), C2 (référence), C4 (routes sans Outlet),
C6 (stock réel), C8 (retirer les fausses preuves). Ce sont les six qui, sinon,
font mentir le site ou l'empêchent de vendre.

**Sprint 2 — sécurité & intégrité pricing :** C5 (auth de l'accrual),
C7 (feed Merchant), M1/M2/M9 (garde-fous SQL prix), M3 (reset panier),
M4 (dédupliquer les règles de prix), M15 (rate-limiting).

**Sprint 3 — chaîne partenaires & cohérence :** M5/M13/M14 (unifier les
espaces + créer les codes + companies), M10/M11/M12 (MOQ, fuite, accrual),
mineurs SEO/maillage.

**Sprint 4 — personnalisation visuelle (§3) :** D1→D7, en commençant par le
hero photographique et la bande « preuve par l'image ».

> Je n'ai appliqué **aucun** correctif : cet audit est un état des lieux. Dis-moi
> par quel sprint tu veux commencer et je l'implémente avec la même rigueur
> (tests + vérif réelle) que les chantiers pricing.
