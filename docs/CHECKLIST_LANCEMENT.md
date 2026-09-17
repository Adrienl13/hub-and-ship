# Checklist de lancement — Terrassea / prosimport.com

État au 18 septembre 2026. Établie à partir de l'audit pré-lancement
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
- Lien magique : sorties de secours sur tous les échecs, et écran de connexion
  sur un lien de réservation ouvert sans session (§ 4).
- Tunnel de commande en mode devis, e-mails refaits, et pont du catalogue
  public vers le panier (§ 2).
- Registre `/livres` : indexation réparée, règle de preuve appliquée et
  contrôle de publication dans l'admin (§ 1).
- Économie négative fermée sur les deux dernières surfaces — récap de
  réservation et devis PDF (§ 3).

---

## 1. Registre « preuve » (`/livres`) — code fait, saisie à faire

Le code est livré. Les fiches sont enfin **indexables** : la résolution passe
par un loader, un slug inconnu répond 404 au lieu de 200 avec l'écran
d'erreur anglais, et `sitemap-livres.xml` les annonce. Le site refuse
désormais de servir une photo de banque d'images ou une citation sans
auteur, et l'admin contrôle la fiche avant publication — slug qui désigne
une autre référence, total qui contredit le détail par famille, compteurs à
zéro, chronologie impossible, photos de stock. `/qualite` n'expose plus de
lien vers une fiche inexistante.

**[A] Il reste la saisie**, fiche par fiche : photos réelles, compteurs
accordés, et la question du témoignage nominatif de CC-2025-004. Tout est
détaillé champ par champ dans `docs/REGISTRE_LIVRES_A_COMPLETER.md`. En
attendant, trois fiches sur quatre s'affichent sans galerie.

Le plus urgent des quatre : **CC-2025-014 est servi sous l'URL
`/livres/cc-2025-002`**, qui annonce une autre référence.

---

## 2. Parcours d'achat — tranché, et livré

**Décision du 18 septembre : le tunnel s'arrête au devis.** Le client va
jusqu'au bout — panier, coordonnées, livraison — et reçoit son devis. Rien
n'est encaissé sur le site. Terrassea reçoit le même devis, rappelle sous
24 h ouvrées et transmet ses coordonnées bancaires pour engager la commande.

Livré : bouton « Recevoir mon devis », étape 4 qui annonce l'appel au lieu
d'une redirection carte, écran de confirmation refait, badges de réassurance
qui ne promettent plus un paiement sécurisé là où il n'y en a pas, et dans
l'espace compte un rappel de la suite à la place de « Retenter le paiement »
— ce bouton menait à un tunnel fermé.

Côté e-mails : le client reçoit « Votre devis Terrassea » ; Terrassea reçoit
le même devis avec de quoi rappeler utilement — société, SIRET, contact
cliquable, mode de livraison en clair, note du client, volume et code
apporteur. Le mode de livraison et la note n'étaient pas transmis jusqu'ici.

Et le catalogue public mène enfin quelque part : son tiroir porte « Obtenir
mon devis → », qui encode la sélection et atterrit directement sur `/panier`.
« Préférez-vous être rappelé ? » reste en second.

**[A] Pour ouvrir le paiement plus tard** : une constante à basculer
(`RESERVATION_MODE`), et une recette à passer d'abord — Stripe n'a jamais
tourné de bout en bout en production. Tout est dans
`docs/RUNBOOK_PAIEMENT.md`.

Reste un point mineur : sur les pages React, l'icône panier du Header est
visible même pour qui vient du catalogue public sans avoir encore cliqué
« Obtenir mon devis » — son panier y paraît vide. Le pont existe désormais,
l'incohérence est réduite à ce cas.

---

## 3. Prix — aucun prix n'est faux, deux fiches vendent autre chose

**Correction d'une erreur d'analyse de ma part.** J'avais classé cinq prix
comme « faux ». Une contre-expertise contradictoire (quatre enquêtes,
dix-huit réfuteurs) les a réfutés, 3 voix sur 3, confiance forte.

Le catalogue applique `prix HT = coût rendu × 1,90`, avec
`coût rendu = FOB × 0,92 × 1,02 + 4800/qty_par_conteneur + 2`. Appliquée aux
deux prix que j'avais dits aberrants : ROP-031 → 1 225,58 € (réel 1 225,00),
ROP-016 → 1 043,71 € (réel 1 043,00). Au centime. Ce sont des sorties du
moteur de prix, pas des saisies.

**Le vrai défaut est ailleurs, et il est plus grave.** ROP-031 « Chaise de
terrasse ATHENES » et ROP-016 « Table de terrasse SIENA » vendent en réalité
un **salon 4 pièces** — confirmé par le propriétaire le 18/09, et visible sur
leurs propres photos, où l'objet décrit par la fiche est absent. Le 6
septembre, en 70 secondes, les deux ont été retarifés _comme des salons_
(catégorie `lounge`, MOQ 10, FOB de salon) entre deux vrais salons. N'ont pas
suivi : le nom, la description, les dimensions, le poids et le volume.

Conséquence dans le tunnel de devis : au MOQ, un devis annonce
**« 10 × Chaise ATHENES — 12 250 € HT — 1,00 m³ »** pour dix salons. Le prix
est bon ; le volume conteneur est faux d'un facteur ~45. Baisser le prix
ferait vendre à perte — c'est l'identité de la fiche qu'il faut corriger.

**[A] À saisir** sur ROP-031 et ROP-016 : nom, description, dimensions réelles
du salon, poids, `cbm_per_unit`. Vérifier aussi le MOQ. La base les avait déjà
signalées : `studio_role = 'catalog_only'`, note « Catégorie signalée
incohérente par l'audit du 07/09/2026 » — écartées du Studio, mais toujours
actives et commandables.

**Prix de référence.** Trois fiches ont un `retail_price_ref` périmé ou nul :
ROP-001 (786 € figé au seed de juin quand le prix est passé à 1 659 €),
BIS-030 (149 €), SKU-336 (0 €, valeur par défaut du formulaire jamais
remplie). Ce champ n'entre dans **aucun** calcul de prix — il sert seulement à
afficher l'économie barrée. Les trois sont à corriger dans l'admin, mais plus
rien ne les rend visibles : la garde manquante a été posée (commit `ab37f9a`).

## 4. Parcours de connexion — code fait, une manip reste

Le code est livré : la page de retour lit les erreurs renvoyées par Supabase
(en query **et** en fragment), pose un délai de garde de 10 s pour le cas
« ouvert sur un autre appareil » — qui ne renvoie aucune erreur, il reste
simplement en suspens — et propose « Recevoir un nouveau lien » en conservant
la destination. Un lien d'e-mail vers une réservation ouvert sans session
affiche maintenant un écran de connexion au lieu d'une page vide.

**[A] Il reste une modification dans le tableau de bord Supabase**, qui ne peut
pas être versionnée : passer le modèle d'e-mail « Magic Link » sur
`{{ .TokenHash }}`, sans quoi un lien demandé sur l'ordinateur et ouvert sur le
téléphone ne peut toujours pas ouvrir la session — il affichera seulement un
message clair. Marche à suivre et recette : `docs/RUNBOOK_MAGIC_LINK.md`.

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
