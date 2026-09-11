# Accueil — diversité du catalogue et scène de regroupement

Révision du 11 septembre 2026, suite au retour client sur le manque de profondeur et de diversité.

## Direction

Deux intentions explicites : trouver un modèle photographié dans le catalogue ou créer une direction personnalisée. [Kundesign](https://www.kundesign.com/products) expose les familles de mobilier et ses collections ; [Apple](https://www.apple.com/) sépare les mises en avant de produits avec des actions directes. Ces références guident la hiérarchie ; aucune donnée de conversion de ces sites n’est revendiquée.

Le hero montre cinq plans photographiques et permet de parcourir neuf références. Les quatre familles sont accessibles par boutons, sans modifier le projet Studio. La photographie reste inchangée. Les informations de prix, disponibilité et capacité ne sont pas déduites des noms ou images.

## Références retenues et limites de données

Correspondances issues des fichiers catalogue du dépôt, puis inspection des photographies :

- `rope-products.ts` : Amalfi ROP-015, Deauville ROP-007, Ravenna ROP-019, Patmos ROP-040.
- `bistro-products.ts` : Montmartre BIS-009, Siena BIS-036, Ravenna BIS-039.
- Deux photographies déjà utilisées, BIS-057 et BIS-006, conservées sous leurs descriptions visuelles.

Plusieurs noms existent dans plusieurs gammes. Ternes, Quiberon, Collioure et Nice n’ont pas été identifiés de manière suffisamment précise dans ce relevé ; aucune correspondance inventée. Siena BIS-036 montre une table en situation avec des assises, sans promesse que l’ensemble est vendu comme un lot. ROP-016 n’a pas été retenu pour la table : son image montre un ensemble lounge malgré le nom de sa fiche.

## Container

Séquence illustrative vectorielle, automatique une fois à l’entrée dans le viewport : trois groupes de commandes rejoignent un même container. Durée maximale 4,6 s avec décalages, sans boucle ; replay explicite. Reduced motion affiche le résultat statique. Le texte reste disponible indépendamment du mouvement. Aucun taux de remplissage réel ni économie chiffrée.

## Brief Higgsfield prêt à produire

Aucun appel Higgsfield ni achat de génération effectué. Ce brief prépare une illustration, jamais une fausse vidéo de notre usine ou d’une livraison réelle.

**Intention :** comprendre le regroupement sans lire. Trois projets distincts, un même moyen de transport. Un seul geste visuel ; pas de voyage usine/port/restaurant condensé en quelques secondes.

**Storyboard, 5 secondes :**

1. 0–1 s : plan trois-quarts fixe, trois petits groupes de colis sur palettes, teintes bleu grisé, laiton et sauge ; container ouvert au second plan.
2. 1–3,8 s : les groupes glissent successivement à l’intérieur. Conserver la trajectoire, la taille et le nombre des palettes.
3. 3,8–5 s : caméra avance légèrement ; transport regroupé visible, arrêt propre. Aucun chiffre de tarif, délai ou chargement.

**Prompt de production :**

> A premium architectural motion study illustrating consolidated furniture shipping, not documentary footage. One unbranded open shipping container in a softly lit neutral studio, three distinct groups of realistically wrapped furniture cartons on pallets, muted slate blue, warm brass and sage identification bands. Locked three-quarter camera, gentle final dolly. Over five seconds the three groups glide sequentially into the same container, maintaining consistent geometry and scale. Tangible corrugated metal, cardboard and timber, restrained industrial realism, soft directional daylight. No people, no text, no logos, no price graphics, no impossible morphing, no extra pallets appearing, no fake factory background. Clear unobstructed silhouettes, centered action safe for both landscape and portrait crops. Finish on the grouped cargo. No looping motion.

**Livraison prévue :** version paysage et portrait, poster statique vérifié, lecture muette inline une seule fois, pause/replay, reduced motion sur le poster. Différer le chargement jusqu’à proximité de la section. Vérifier chaque frame avant intégration : stabilité des colis, pas de déformation ou de marque inventée. Légende « Illustration du regroupement ».

**Médias réels à recevoir depuis le téléphone :** un plan large de déchargement, un détail de manutention et un plan lisible du stock, de préférence fichiers originaux. Identifier le contexte avant publication ; vérifier personnes identifiables, plaques et coordonnées client. Aucun envoi vers un service tiers sans instruction de production explicite.

DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.

## Validation de la passe

Tests ciblés homepage : 7 réussis. Sécurité : 277 réussis (284 tests groupés, 35 fichiers). E2E expérience : 12 réussis. Build, budget et isolation : OK. La suite complète, TypeScript et ESLint sont rejoués par le hook de commit. Captures homepage et container actualisées dans `docs/design/lot-5-2/`.
