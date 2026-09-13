# Terrassea Accueil V3 — prototype autonome

Conversion de `Terrassea Accueil v3.dc.html` fourni par Adrien, en HTML, CSS et JavaScript standards. Cette version est séparée de l’accueil React existant et n’entre pas dans le build de production.

Source locale : `/Users/adrien/Downloads/Terrassea Accueil v3.dc.html`.
SHA-256 source : `c809a1e2902d644843267ff2a5209165b8a97c80372d5b8a8ed589a7b53deeb4`.
Le lien Claude partagé demande une connexion ; la conversion utilise le fichier local complet, sans accès au compte Claude.

## Voir la page

Depuis la racine du repository :

```sh
bun design/terrassea-accueil-v3/serve.mjs
```

Ouvrir **http://localhost:5192/**. Le serveur écoute uniquement sur `127.0.0.1`, accepte uniquement GET/HEAD et sert une liste limitée de fichiers. Les images catalogue et le logo proviennent de `public/` ; les URLs publiques Supabase présentes dans la source restent des URLs d’images, sans client DB.

Pour que les liens vers le catalogue ouvrent aussi sa démo locale, lancer dans un second terminal :

```sh
bun run design:review
```

Le catalogue s’ouvre alors sur `http://localhost:5190/catalogue`. Le serveur V3 n’importe ni Vite, ni les variables d’environnement applicatives, ni les fixtures commerciales. Il ne modifie aucun flag, secret ou paramètre de l’application.

## Fichiers

- `index.html` : sections et textes, avec templates HTML natifs pour les listes.
- `source-styles.css` : styles du prototype et états de survol convertis en CSS.
- `styles.css` : tokens, fondations manquantes, responsive et accessibilité.
- `model.js` : sélections éditoriales de la source et calcul des états visuels.
- `bindings.js` : mises à jour DOM à partir de chemins de propriétés, sans eval, sans framework et sans remplacer les champs de formulaire.
- `app.js` : interactions, observateurs, timers, cycle de vie et transport configurable.
- `config.js` : médias à fournir et paramètres de raccordement.
- `serve.mjs` : serveur local de démonstration, jamais déployé.
- `page.test.mjs` : régressions exécutables avec `node --test`.

Aucune dépendance à `support.js`, au runtime DC, aux balises personnalisées du prototype ou à un framework CSS. La police Google Fonts et les icônes Phosphor utilisent les liens prévus dans le brief. Aucun fichier image n’a été créé ou téléchargé dans le repository.

## Médias à raccorder

Modifier uniquement les entrées correspondantes de `config.js` :

- `univers` : 2 emplacements `{ url, name, href }`.
- `parcours` : 2 emplacements `{ url, name, href }`.
- `band` : 9 photos d’ambiance `{ url, name, href }`, dupliquées uniquement pour l’animation.
- `reels` : 4 vidéos `{ url, name, href }` ; `name` remplace la légende lorsqu’il est fourni. `null` garde le placeholder. La vidéo ne reçoit son `src` qu’à proximité du viewport.
- `compares` : paires exactes avant/après pour Fréjus, Denia, Médaillon. Aucune autre chaise n’est présentée comme une variante personnalisée du même modèle. Seul le chemin BIS-012-01, explicitement présent dans la source et disponible localement, est raccordé pour le premier visuel Médaillon. Les autres variantes attendent leur correspondance vérifiée.
- `textures` : PI-TR-007 et PI-TX-021 utilisent les vrais échantillons publics existants. PI-CO-014 n’existe pas dans la bibliothèque publique : aucun rapprochement automatique avec PI-RP n’est effectué.
- `productPhotos` : surcharge d’un chemin de photo de la source par sa correspondance catalogue vérifiée, sans changer les données catalogue.

Les blancs/hachures sont volontaires pour les médias non fournis. Les associations photo/nom provenant de la maquette restent éditoriales et doivent être rapprochées du catalogue avant une intégration publique. Exemples de divergences internes à la source : BIS-027 sert à « Deauville » et « Hossegor » ; BIS-026 à « Biarritz » et « Deauville » ; « Louvres » et « Provence » partagent une photo de plateau, « Avignon » et « Azur » une photo de piètement ; « Ravenna » figure aussi dans une sélection Lounge. Ces libellés n’ont pas été silencieusement renommés pour conserver les textes demandés.

## Différences explicites avec la source

Les textes éditoriaux et l’ordre des sections sont conservés. Les dimensions fixes ajoutées par l’éditeur et les espaces insécables d’indentation sont retirés pour éviter les chevauchements mobiles.

Le fichier source référence `--color-process-yellow` sans définir sa valeur ; son fichier de design system n’est pas fourni. **`#806000` est une valeur provisoire configurable, pas une couleur prétendument récupérée de la maquette.** Elle doit être approuvée/remplacée par le token exact.

Les motifs CSS dessinés dans la source ne sont pas présentés comme des échantillons réels. Deux sont remplacés par les fichiers publics correspondants ; le troisième porte « référence à raccorder ». C’est la seule adaptation du libellé des échantillons.

Un bandeau explicite identifie la démonstration locale et permet de suspendre toutes les animations. Les formulaires affichent aussi leur caractère simulé. Les citations conservent la mention « Témoignage à remplacer » de la source. Les affirmations de prix, délais, normes, seuils et programme partenaire sont du contenu éditorial à valider, pas des données commerciales certifiées par cette conversion.

## Formulaires

Par défaut `demo: true`, endpoints `null` : aucun fetch, aucune inscription, aucun lead envoyé. Les libellés de succès du prototype sont montrés uniquement comme simulation, avec une mention explicite sous le formulaire.

Le transport est prêt à être adapté à un endpoint **same-origin** approuvé : JSON POST avec `email`, `quantity`, `delivery`, `message`, `profile`, `needs` pour le projet ; `email` pour la newsletter. Une réponse HTTP réussie est nécessaire à l’affichage du succès hors démonstration. Une erreur ou un endpoint absent conserve la saisie et ne confirme pas l’envoi. Les entrées obligatoires utilisent la validation native.

Le serveur local refuse tous les POST, même si quelqu’un change la configuration. Le contrat CRM réel et ses protections serveur restent à préciser avant toute mise en ligne. Aucune donnée de formulaire n’est placée dans une URL, le stockage local ou l’analytics.

## Vérification

```sh
node --test design/terrassea-accueil-v3/page.test.mjs
bun run check
bun run test:security
bun run build
```

Résultats de cette passe :

- Tests V3 : **16 réussis, 0 échec** (rotation sans doublon, mises à jour répétées, 3 sliders liés, catégories, profil partenaire, besoins multiples, timers/replay, reduced motion, nettoyage, lazy vidéo/reprise, médias configurables, formulaires et chemins catalogue locaux).
- `bun run check` : typecheck et lint réussis ; **1069 tests réussis, 8 ignorés**, 157 fichiers réussis et 2 ignorés.
- Sécurité : **277 tests réussis**, 34 fichiers.
- Build : réussi ; budgets de bundles et contrôles d’isolation de la démo réussis. L’accueil applicatif n’a pas été remplacé.
- Navigateur local : 360, 768, 1024 et 1440 px, pas de débordement des sections/formulaires/titres ; correction du chevauchement titre/paragraphe Studio à 360 px. Vérification des sliders liés (51/51/51), du profil partenaire préselectionné et du formulaire simulé sur mobile.
- Serveur local : `/data/private/test` → **404**, `POST /lead` → **403** ; catalogue local → **200**.
- Images hors hero en lazy loading avec dimensions réservées, vidéos différées. **Aucun score Lighthouse chiffré revendiqué** : les médias d’ambiance et vidéos définitifs ne sont pas encore fournis.

**DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.**
