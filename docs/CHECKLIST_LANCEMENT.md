# Checklist de lancement — Terrassea / prosimport.com

État au 17 septembre 2026. Établie à partir de l'audit pré-lancement
(143 constats, 46 vérifiés en contradictoire) et d'une relecture des données
de production le jour même.

Convention : **[A]** = décision ou saisie du propriétaire, **[C]** = code.

---

## 0. Fait depuis l'audit

- Corrections rapides de l'audit : redirection ouverte fermée, double clic sur
  « Confirmer et payer », lien de partage (dédoublonnage + remplacement du
  panier), capacité container sur `/panier`, échéancier et FAQ de `/prix`,
  titres `/stock-24h`, `/lieux` au pied de page et au sitemap, image de partage
  par défaut, boutons « Importer collection » retirés, e-mail public passé à
  `contact@prosimport.com`, garde sur « 0 × 0 × 0 cm ».
- Les 9 vues à marque d'usine des séries BIS-043 / BIS-044 supprimées du dépôt.
- Suppression d'un produit dans l'admin : réparée (la RPC citait une table
  absente en production, elle échouait sur toutes les fiches).
- Marqueur de relecture photo dans l'admin, avec filtre et galerie par fiche.

---

## 1. Bloquant — le registre « preuve » (`/livres`)

C'est la page qui porte la crédibilité du site, et **trois containers publiés
sur quatre sont des données de démonstration présentées comme réelles.**

- **[A] Photos inventées.** Les galeries de CC-2025-003, CC-2025-004 et
  CC-2025-014 sont intégralement des photos de banque d'images Unsplash,
  légendées comme des livraisons réelles : « Tables HPL installées — Camping
  Les Pins Bleus », « Container 20' HC sur quai Marseille-Fos », « Inspection
  SGS en usine ». La photo principale de CC-2025-004 aussi. À remplacer par
  vos photos, ou à dépublier.
- **[A] Témoignages.** CC-2026-001 publie une citation **sans auteur** ;
  CC-2025-004 nomme un établissement identifiable (« Restaurant La Marina,
  Cap d'Agde »). Faire confirmer par écrit, ou dépublier.
- **[A] Compteurs incohérents.** Trois chiffres différents par fiche :

  | Référence | Affiché | `total_items` | Détail produits | Pros affichés / réels |
  |---|---|---|---|---|
  | CC-2025-003 | 198 | 790 | 58 | 6 / 8 |
  | CC-2025-014 | 287 | 270 | 287 | 8 / 3 |
  | CC-2026-001 | **0** | 350 | — | 12 / 4 |
  | CC-2025-004 | 412 | 412 | 412 | 11 / 11 ✓ |

- **[A] Slug faux.** CC-2025-014 est publié sous `cc-2025-002`. C'est aussi ce
  qui casse le seul lien réel vers ces fiches, depuis `/qualite`.
- **[A] Chronologie impossible.** CC-2025-004 est « en transit » avec une
  livraison au 30/09/2026 et une clôture au 29/07. CC-2025-003 fait arriver le
  container au Havre le 18/05 et livre les clients le 20/04 — et son champ port
  dit « Fos-sur-Mer » pendant que son récit dit « port du Havre ».
- **[C]** Retirer le repli photo Unsplash des fiches container (une fiche sans
  photo doit afficher un neutre, pas une photo de stock légendée).
- **[C]** `/livres/<slug inconnu>` répond **200** avec « Something went wrong! »
  en anglais, et les 4 containers publiés sont tous en `noindex` avec le même
  titre générique. Même défaut sur `/guides/<slug inconnu>`.

---

## 2. Bloquant — une décision produit

**[A] Un seul parcours d'achat pour l'ouverture.** Aujourd'hui `/catalogue`
(demande de rappel) et `/panier` (réservation Stripe) coexistent sans pont :
l'icône panier du Header est visible sur toutes les pages publiques et mène à
un panier **toujours vide** pour qui a composé son projet sur `/catalogue`.

- Si le parcours de lancement est la **demande de rappel** : masquer l'icône
  panier et « Réserver » du Header sur les pages publiques. Effort moyen.
- Si c'est la **réservation Stripe** : faire pointer le CTA du tiroir vers
  `/catalogue?panier=…` et la fiche produit vers l'ancre du catalogue public.
  Effort lourd.

Tout le reste de la liste est indépendant de ce choix.

---

## 3. Bloquant — prix publics faux

**[A] À corriger dans l'admin** (tous actifs et visibles aujourd'hui) :

| SKU | Nom | Prix HT | Prix de référence | Problème |
|---|---|---|---|---|
| ROP-001 | Salon CANNES | 1 659 € | 786 € | référence sous le prix HT |
| BIS-030 | Chaise DINARD | 181 € | 149 € | référence sous le prix HT |
| SKU-336 | Chaise DAMIER | 73,85 € | 0 € | référence à zéro |
| ROP-031 | Chaise ATHENES | **1 225 €** | 1 630 € | pairs à 120–189 € (seed : 99 €) |
| ROP-016 | Table SIENA | **1 043 €** | 1 900 € | pairs à 79–193 € (seed : 229 €) |

**[C]** Borner le calcul d'économie (`src/lib/order.ts`) : ne sommer la
référence que sur les lignes où elle dépasse le prix HT, et plancher l'économie
à 0. Sans cela, la fenêtre de réservation et le devis PDF affichent
« Économie réalisée −-795 € (-11 %) » au moment de confirmer.

---

## 4. Bloquant — parcours de connexion

**[C] Le lien magique est le seul mode de connexion du site**, et il n'a aucune
issue quand il échoue : lien expiré, déjà cliqué, ou demandé sur l'ordinateur
et ouvert sur le téléphone (le cas normal en CHR). La page reste indéfiniment
sur « Validation du lien magique », sans message ni bouton. Les paramètres
d'erreur renvoyés par Supabase ne sont jamais lus.

À faire : afficher un état d'erreur avec « Recevoir un nouveau lien », et
basculer le template Supabase sur `token_hash` pour le cas multi-appareil.

**[C]** Un lien e-mail vers une réservation, ouvert sans session, rend une page
vide — c'est la cible de l'e-mail de confirmation et des relances Stripe.

---

## 5. Bloquant — pages co-brandées ouvertes

**[C]** `/p/<n'importe quoi>` affiche « <Marque> vous ouvre son accès
Terrassea », sans aucun contrôle, et mémorise le contexte 120 jours. Pire :
`/p/<slug arbitraire>?selection=<uuid>` affiche la sélection publiée d'un vrai
partenaire sous un nom arbitraire. Aucune donnée partenaire n'est exposée, le
risque est réputationnel. À garder par une RPC de vérification du slug.

---

## 6. Photos — la relecture vous revient

L'admin (onglet Catalogue) porte maintenant un filtre **Photos** et un badge par
fiche. **205 fiches sont en file, dont 134 actives.**

- **À corriger (7)** : TES-015 (fiche technique en chinois affichée sur une
  fiche active), BIS-044 (quatre vues pointent vers des fichiers retirés) et
  cinq fiches de démonstration sur photo de banque d'images.
- **À relire (198)** : tout ce qui vient d'un lot fournisseur
  (`bistro-seating`, `rope-series`, `teslin-series`, `table-base-series`) plus
  les 47 fiches dont les visuels sont sur Supabase Storage — ces dernières
  n'ont **jamais** pu être inspectées, l'audit n'a pas réussi à les charger.

Le bouton « Photos » d'une ligne ouvre la galerie complète, vue par vue, avec le
nom de fichier. Retirer une vue ne supprime que son URL de la fiche : le fichier
reste dans le dépôt.

**[A] Quatre fichiers à marque, décision à prendre.** Les quatre originaux
`public/catalogue/bistro-seating/BIS-039-01.jpg`, `-02`, `-03` et `-04` portent
un chevalet « 铸梵 / CHOUVANT » parfaitement lisible. Ils ne sont référencés par
aucune fiche, mais tout ce qui vit dans `public/` est servi publiquement par URL
directe. Ils font partie des 156 originaux restaurés — je n'y touche pas sans
votre feu vert.

Réserve de l'audit à connaître : l'inspection s'est faite en planches-contact,
sans OCR. Une marque plus petite qu'environ 15 px sur la vignette a pu passer.

---

## 7. À faire avant d'ouvrir, effort faible

- **[C]** Panier : la clé héritée `__default__` double les quantités sur
  `/panier`, au catalogue et au devis, et « Retirer » sur une des deux lignes
  supprime les deux. Faire dériver `useCartLines()` de `createCartSnapshot()`.
- **[C]** Admin : remplacer ou retirer une image supprime le fichier du bucket
  **avant** l'enregistrement de la fiche. Un admin qui ferme sans enregistrer a
  déjà perdu l'ancienne. Différer la suppression après succès.
- **[A/C]** 32 fiches ont une catégorie qui ne correspond pas à leur nom. Effet
  concret : BIS-028, BIS-029, BIS-030 et BIS-059 sont des chaises classées
  « banc », donc réservables **à 1 unité, sous leur MOQ affiché** (25, 25, 25,
  10). Et la puce de filtre « Table 0 » s'affiche alors que 7 tables existent.
- **[A]** Compléter les 6 fiches squelettes SKU-321 / 324 / 336 / 368 / 369 /
  521 (dimensions, poids, volume, caractéristiques ; photo pour SKU-321). Elles
  portent 6 des 7 lignes de stock 24 h : **ne pas les désactiver**, cela viderait
  la page stock.
- **[C]** Appliquer la migration `20260917080000` (surcharges grand compte
  au-dessus de la remise promise : TES-012, TES-004, BIS-032, ROP-040). Écrite
  et testée, **pas encore appliquée**. Aucun client impacté aujourd'hui.
- **[C]** Le taux de TVA du RPC de réservation vient du payload client. Aucun
  code ne l'envoie, mais la fonction est ouverte à `anon`. Lire le taux côté
  serveur.
- **[A]** Les quatre transporteurs (Geodis, Heppner, Mauffrey, Dachser) portent
  le badge « Partenaire direct ». Confirmer les accords, sinon libeller
  « Transporteur recommandé ».

---

## 8. Mise en ligne

1. Fusionner `claude/showroom-followup` dans `main`.
2. `npm run deploy` — **pousser sur `main` ne déploie rien**, le déploiement
   Cloudflare est une commande manuelle.
3. Purger le cache CDN (les images supprimées peuvent encore y être servies).
4. Vérifier en production, avec de vrais comptes : la base est **vierge de
   transactions** (aucune société, aucune réservation, aucun partenaire). Tout
   ce qui touche aux canaux de prix, aux commissions, à Stripe et aux e-mails
   n'a jamais tourné de bout en bout. Ce n'est pas une formalité.
5. Brancher `tests/e2e/site-audit.spec.ts` en CI — la spec existe mais n'est
   exécutée par aucun workflow, et elle échoue aujourd'hui sur le slug du
   registre.

---

## 9. Après l'ouverture

- Prix canal : le catalogue public est lu en anonyme, un revendeur connecté y
  verrait le prix direct puis le prix net sur `/panier`. Sans effet tant que
  `companies` est vide ; bloquant le jour où le programme revendeur ouvre.
- Aucune notification à l'approbation d'un partenaire (envoi manuel suffisant
  pour les premiers).
- Le bucket `reservation-quotes` n'existe que dans la base de production, créé à
  la main : migration de rattrapage à écrire.
- Navigation mobile tronquée sous 760 px (atteignable par balayage, mais sans
  repère visuel).
- Déplacer `public/catalogue/bistro-seating/` hors de `public/` une fois la
  relecture photo terminée (156 fichiers, 13 Mo, servis sans être utilisés).
