# Terrassea — Programme partenaires V2

Preview : **http://localhost:5192/partenaires/**. Depuis la racine du dépôt :

```sh
bun design/terrassea-accueil-v3/serve.mjs
```

Source : `Nouveau design site internet (2)/Terrassea Partenaires v2.dc.html`, version explicitement désignée par le brief joint. La V1 n’est pas mélangée à la V2. Les autres pages de cet export sont identiques aux versions précédentes.

## Réalisation

HTML/CSS/JS standards et templates natifs ; aucun runtime DC, `support.js` ou framework supplémentaire. Textes et ordre de la V2 conservés. Icônes Phosphor duotone et logo existant uniquement, aucune image générée ou donnée commerciale ajoutée.

- Hero sombre, accents or, quatre chiffres, bandeau défilant et animations d’apparition.
- Sept profils : recommandations Apporteur / Revendeur / Grand compte / Distributeur, reliées à l’explorateur, au comparatif et aux deux champs de présélection du formulaire.
- Désélection du profil actif : bandeau refermé et choix de formulaire vidés.
- Quatre onglets accessibles au clavier (flèches, Début/Fin), panneau associé, sélection et contraste selon le statut. Un changement d’onglet présélectionne également le statut visé.
- CTA par statut et CTA corner démo vers la candidature avec statut conservé.
- Tableau à huit lignes, colonne active surlignée ; défilement horizontal limité au tableau sur mobile.
- Candidature avec champs nommés, contrôles natifs, SIRET exactement 14 chiffres, formulaire et newsletter indépendants.
- FAQ : une seule réponse ouverte ; bouton mobile après 700 px, inert quand masqué.
- Préférence de mouvement réduit, nettoyage des événements et observateurs, bandeau sans saut (espacement final identique à l’espacement des éléments).

## Formulaires et données personnelles

`config.js` garde `demo: true`, endpoints `null`. Une candidature ou inscription valide affiche une mention explicite de **simulation**, jamais une fausse confirmation d’envoi réel. Aucune candidature ni email envoyé, aucun stockage local ou analytics, aucune donnée de formulaire dans les URLs.

Le transport préparé accepte uniquement des endpoints same-origin, en JSON POST. Le payload candidature contient `company`, `siret`, `contact`, `phone`, `email`, `profile`, `status`, `zone`, `volume`, `context` ; newsletter : `email`. Réponse HTTP réussie obligatoire avant affichage du succès ; échec ou configuration absente : saisie préservée. Le serveur de preview refuse tous les POST. Le contrat CRM et ses validations/protections serveur doivent être raccordés séparément.

Le format SIRET est vérifié côté interface, **pas l’existence ni l’activité légale de l’entreprise**. Les grilles partenaires et statuts réels restent sous validation de l’équipe ; aucune attribution automatique de droits, commission, contrat ou tarif.

Le `tel:+33` incomplet de la source est remplacé par un accès au contact tant qu’un numéro réel n’est pas configuré. Aucun numéro inventé.

## Adaptations de mise en page

Le titre et le chiffre-clé du panneau peuvent se répartir sur plusieurs lignes pour éviter les superpositions à 1024 px. À 360 px, les chiffres du hero passent à 24 px afin que « −30 à 40 % » reste dans sa cellule. Les textes sont conservés. Le tableau garde ses 640 px minimum dans sa propre zone défilante.

Les liens Partenaires sont ajoutés aux navigations locales Accueil, Catalogue et Prix. La nouvelle page partage le design system CSS de la page Prix et le binder natif de l’accueil. Aucun fichier de l’application React, migration, secret ou flag n’est modifié.

## Fichiers

- `index.html`, `source-styles.css`, `styles.css` : présentation et responsive.
- `model.js` : textes source, profils et statuts, comparatif, FAQ.
- `app.js` : interactions, accessibilité, cycle de vie et transport configurable.
- `config.js` : endpoints et numéro à compléter.
- `page.test.mjs` : régressions du parcours partenaire.
- Serveur local et liens de navigation des trois pages précédentes.

## Vérification

```sh
node --test design/terrassea-partenaires/page.test.mjs design/terrassea-prix/page.test.mjs design/terrassea-catalogue/catalogue.test.mjs design/terrassea-accueil-v3/page.test.mjs
bun run check
bun run test:security
bun run build
```

- **71 tests autonomes réussis** : 21 Partenaires, 12 Prix, 22 Catalogue, 16 Accueil.
- `check` : typecheck/lint OK, **1069 tests réussis, 8 ignorés**, 157 fichiers réussis / 2 ignorés.
- Sécurité : **277 tests réussis**, 34 fichiers.
- Build réussi, budgets, scan des 216 chunks client et isolation démo validés.
- Navigateur : 1440 / 1024 / 768 / 360 px ; aucun débordement de page. Explorateur lisible à 1024, formulaire 305 px sans débordement à 360, tableau 640 px dans sa zone de 305 px.
- Parcours Pisciniste → Revendeur, Importateur étranger → Distributeur → candidature : sélections confirmées dans le navigateur.

Les chiffres, zones ouvertes, commissions, RFA et engagements reproduisent le brief fourni ; ils ne constituent pas une validation commerciale supplémentaire. Le raccordement CRM et le numéro de téléphone restent à finaliser.

**DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.**
