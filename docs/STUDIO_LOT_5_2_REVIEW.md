# Lot 5.2 — Pros Import, du projet à la matière

Base : `4a9cc212d04b9b7d9c02eb27923c7af8db8e35ae`. Branche : `codex/studio-lot-5-2-experience`.

## Trois visions explorées

| Concept                            | Point d’entrée et expérience                                                   | Direction visuelle                                                                                 | Arbitrage                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carnet d’ambiances                 | Partir du lieu, de son atmosphère, puis rapprocher une sélection de mobilier   | Grandes photos de lieux, rythme éditorial, albums de références                                    | Désirable, mais demanderait des projets clients documentés et un parcours de collecte d’images. Sans ces sources, risque de faire passer une inspiration pour une réalisation. |
| Bureau de prescription             | Partir du cahier des charges, spécifier et comparer produit/matière/quantité   | Colonnes comparatives, repères techniques, plans et fiches                                         | Pertinent pour les architectes et achats structurés, mais impose trop de vocabulaire et d’informations à un restaurateur qui cherche d’abord une direction.                    |
| **Studio de fabrication — retenu** | Une forme, une matière active, une planche, puis un projet à vérifier ensemble | Encre et bleu vif, papier gris, échantillons physiques, références discrètes, grandes respirations | Rend la personnalisation tangible sans expertise préalable. Permet de différer la complexité tout en conservant les preuves et les contraintes nécessaires.                    |

L’audit initial montrait une homepage guidée par le container, un accès Studio en cartes génériques et une longue grille de matières. Le changement porte sur la hiérarchie et la mécanique d’exploration, pas seulement sur les couleurs.

## Ce que le client peut comprendre et faire

### Homepage

La promesse « Votre lieu a du caractère. Votre mobilier aussi. » parle d’abord de l’établissement. La photo catalogue originale et l’échantillon sont présentés comme deux objets distincts sur un plan de travail : aucune texture n’est appliquée artificiellement au produit. Le CTA Studio est majeur ; le catalogue reste immédiatement accessible.

Le visiteur peut explorer trois langages de matière avant d’entrer dans son projet. Changer cette inspiration ne recolore jamais la photo et ne crée aucune sélection commerciale. Le processus est présenté ensuite : mobilier → direction → projet à vérifier. Qualité et livraison viennent en preuves d’exécution, avec liens vers les pages existantes. Aucun faux client, témoignage, atelier, test ou délai n’a été ajouté pour remplir ces sections.

Avec le flag Studio OFF, les CTA de projet conduisent au contact et aucun lien public n’ouvre le Studio. Le flag n’est pas modifié dans le dépôt ou en production.

### Studio

L’entrée distingue un projet complet des parcours assises/tables. Le projet déjà enregistré est repris en un clic vers la planche, sans perdre la reprise de la découverte. Le rail de projet, les quantités, Undo et les résumés existants sont conservés.

Le produit devient un point de départ dans un ensemble : mobilier + matières + couleurs + quantités + projet. La photographie catalogue reste le repère réel ; l’interface ne prétend pas fournir une simulation du produit personnalisé.

### Atelier

Une matière active domine le plan de travail. Précédent/suivant permet d’explorer sans parcourir 151 cartes ; zoom et ajout à la planche sont immédiats. La bibliothèque complète se déplie à la demande, par 12 entrées, avec recherche, familles et comparaison.

La bande de sélection montre les matières retenues par mobilier et permet d’y revenir. Le motif et la palette demandée restent séparés. Changer de mobilier ou de motif conserve les protections du correctif 5.1. Une annonce accessible confirme l’action sans certifier la faisabilité.

Sur mobile, la planche est repliable et placée avant la matière ; la bande de choix se parcourt horizontalement au tactile. La comparaison conserve deux matières côte à côte. Les contrôles principaux font au moins 44 px. Les options moins fréquentes et les quantités se déplient sous le travail visuel.

## Règles visuelles issues des interfaces

- Encre `#20282d`, papier `#f5f5f1`, bleu `#2549d5`, gris de lecture `#596369`, signal papier `#e1ec82`. Bleu/papier : contraste **6,42:1** ; gris/papier **5,63:1** ; encre/papier **13,70:1**.
- Archivo existante, sans nouvelle police ou dépendance distante. Titres de 34–84 px selon contexte ; hiérarchie par échelle et espace, pas par effets décoratifs.
- Bordures fines, angles presque droits, boutons pleins pour l’action principale. Les grands arrondis ne portent plus l’identité.
- Photographies catalogue conservées, sans masque, recoloration, filtre ou texture générée. Les rotations concernent les cadres de présentation, comme des échantillons sur une table.
- Bleu pour avancer ; gris/encre pour les outils. Focus visibles, textes de statut conservateurs. Le retour visuel suit l’action du client.
- Transition matière de 180 ms, désactivée avec `prefers-reduced-motion`. Aucun moteur d’animation supplémentaire chargé.

Les règles sont regroupées dans `src/styles/experience.css` et limitées à `.pi-page`. Elles ne remplacent pas brutalement le thème des écrans historiques. Le mot-symbole Pros Import et le repère « pi » sont une proposition de direction de marque, pas une refonte de l’identité légale ou du logo historique sur tous les supports.

## Revue locale reproductible

Depuis le repository, une seule commande :

```sh
bun run design:review
```

Une seule URL : **http://localhost:5190/**.

Le bandeau donne accès à l’accueil, au Studio, à l’atelier, à un projet composé et à un parcours réinitialisé. Il identifie explicitement les données de démonstration et les envois simulés. Les deux assises, les règles et les montants éventuels sont des fixtures de test ; les images de matières sont les découpes réelles du Lot 5.1.

Le lanceur est autonome, hors code applicatif, lié uniquement à loopback. Il lance Vite sur le port adjacent, configure son processus enfant avec une API locale et intercepte les formulaires, événements, appels Supabase et mutations. Les fonctions serveur sont bloquées sur cette surface. Analytics désactivés dans ce processus. Aucun fichier `.env`, secret, flag de production ou base distante n’est modifié. Ctrl+C arrête le lanceur et son serveur enfant.

La démo refuse `NODE_ENV=production`. Les endpoints `__design` n’existent pas sur Vite ordinaire. Le build exécute `check-design-review-bundle.mjs` pour refuser les marqueurs de revue dans les artefacts client **et serveur**. Le coffre reste exclu de Git et bloqué par Vite. Ce serveur de revue ne remplace pas un environnement de validation de données Supabase.

## Vérité métier et confidentialité

Aucun changement dans `src/lib/studio`, le store, le Taste Engine, le resolver de compatibilité, les règles de fulfillment ou les schémas de personnalisation. Les garanties du Lot 5.1 restent celles du moteur : capability du type + association exacte, palette libre inconnue, aucune réservation certifiée par une simple capability.

La bibliothèque, ses références publiques et ses mappings privés sont inchangés. Pas de nouveau seed commercial, migration ou rattachement. Aucun nom/SKU/image n’est utilisé pour inférer une compatibilité. Les fichiers publics des sources visuelles restent identiques.

Migrations **42/43/44/45/46 inchangées**. Aucune migration exécutée pendant ce lot.

## Captures

Les captures sont produites par `tests/e2e/studio-experience.pw.ts`, en desktop 1440×980 et mobile 390×844. Le projet composé contient plusieurs demandes, dont une palette et une couleur structure, sans certification de faisabilité. Les pages complètes déplacent seulement le bandeau de revue en pied pour éviter qu’il masque le travail ; les captures de viewport montrent le bandeau tel qu’il apparaît localement.

- Homepage : `home-desktop.png`, `home-mobile.png` ; versions `-viewport` pour le premier écran.
- Studio : `studio-desktop.png`, `studio-mobile.png`.
- Découverte en cours : `discovery-desktop.png`, `discovery-mobile.png`.
- Atelier : `atelier-desktop.png`, `atelier-mobile.png`.
- Sélection active : `selection-desktop.png`, `selection-mobile.png`.
- Comparaison : `comparison-desktop.png`, `comparison-mobile.png`.
- Projet avec plusieurs choix : `project-desktop.png`, `project-mobile.png`.

[Ouvrir la galerie complète desktop / mobile](design/lot-5-2/index.html).

Sortie reproductible : `/tmp/lot52-review/`. Une sélection finale est conservée avec ce rapport dans `docs/design/lot-5-2/`.

## Validation

| Vérification                                                             | Résultat                                                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Tests ciblés expérience / personnalisation / bibliothèque / revue locale | 42 réussis, 7 fichiers                                                                                                  |
| `bun run check`                                                          | TypeScript et ESLint OK ; 1 066 réussis, 8 ignorés ; 157 fichiers réussis, 2 ignorés                                    |
| `bun run test:security`                                                  | 277 réussis, 34 fichiers                                                                                                |
| `bun run build`                                                          | OK ; budget respecté, 216 chunks client sans marqueur interne, aucun marqueur de démo dans les artefacts client/serveur |
| E2E Lot 2                                                                | 10 réussis                                                                                                              |
| E2E Lot 3                                                                | 10 réussis                                                                                                              |
| E2E Lot 4                                                                | 12 réussis                                                                                                              |
| E2E Lot 5                                                                | 4 réussis                                                                                                               |
| E2E Lot 5.1                                                              | 4 réussis                                                                                                               |
| E2E Lot 5.2                                                              | 6 réussis                                                                                                               |
| **Total E2E**                                                            | **46 réussis**                                                                                                          |

Les scénarios commerciaux utilisent des données synthétiques et des API interceptées ; ils ne valident pas le catalogue réel. Les suites E2E ont été lancées séparément pour éviter une collision entre les ports d’inspection des serveurs Vite. Deux sélecteurs historiques ont été adaptés à la nouvelle présentation (ouverture de la bibliothèque et lien précis de reprise des assises).

Mesure locale du premier affichage mobile, sans scroll : **2 requêtes image, 64 596 octets**. Le produit hero est prioritaire, les matières complémentaires sont lazy-loadées. Ce relevé concerne uniquement les images de ce viewport, pas le poids total d’une page ni un score Core Web Vitals. Le nuancier ne charge pas 151 détails à l’ouverture. Le budget existant et le scan anti-fuite restent exécutés par le build.

## Limites et suite

- La direction est implémentée sur homepage et Studio. Le catalogue complet, les fiches historiques, l’authentification et le checkout restent fonctionnels dans leur présentation existante ; harmonisation à prévoir après revue de cette direction.
- Aucune bibliothèque de vraies photos d’usine/livraison ou de projets clients vérifiés n’a été inventée. Les emplacements éditoriaux et liens vers les preuves existantes permettent de les intégrer lorsque ces sources sont identifiées.
- La résolution inter-appareils d’une référence de composition seule n’est pas ajoutée : le dossier exporté et le mapping administratif du Lot 5.1 restent le mécanisme disponible.
- Aucune preview générée sur le mobilier. La V2 nécessite masques, échelle, palettes et modalités de validation propres à chaque produit.
- Le simulateur local ne prouve pas la disponibilité des produits, la compatibilité réelle, les prix ou les capacités de production.

**DATA READY = NON · PROD WRITE = NON · PROD MIGRATION = NON · DEPLOY = NON · MAIN MERGE = NON.**
