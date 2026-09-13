# Terrassea Catalogue — prototype autonome raccordé à l’API publique

Conversion du fichier `Nouveau design site internet/Terrassea Catalogue.dc.html` fourni par Adrien. HTML, CSS et JavaScript standards ; aucun runtime DC, framework ou image générée. L’ordre des sections et les textes éditoriaux de la maquette sont conservés. Les exemples de produits/prix de la maquette sont remplacés par les données catalogue publiques.

## Accès local

Depuis la racine du dépôt :

```sh
bun design/terrassea-accueil-v3/serve.mjs
```

- Accueil : http://localhost:5192/
- Catalogue : http://localhost:5192/catalogue/

Le serveur écoute uniquement sur `127.0.0.1`. Bun charge les variables publiques existantes `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Aucun secret ou flag n’est modifié. Il refuse tous les POST et ne sert que des fichiers explicitement autorisés. Les fichiers API serveur, `.env.local` et `data/private` sont inaccessibles par HTTP.

Cette version reste dans `design/`, séparée du catalogue React et du build de production. Aucun déploiement n’a été effectué.

## Données et limites

`api.mjs` effectue exclusivement des GET anonymes prédéfinis :

- `products_public` : identité, catégorie, prix public, MOQ, photos, caractéristiques, visibilité, ordre ; produits actifs.
- `product_variants` : identité liée au produit, nom, photos, MOQ, ordre.
- `stock_lines` : produit, variante, unités disponibles ; lignes actives avec disponibilité positive.
- `rpc/get_catalogue_prices` : prix publics résolus, comme dans le catalogue existant.

Pagination des lectures de tables, cache serveur de 60 secondes et regroupement des lectures simultanées. Aucun service role, session utilisateur, SQL, écriture DB ou proxy d’URL arbitraire. En cas d’échec de lecture produit/variante, un message remplace la grille ; aucun catalogue fictif n’est injecté. Stock indisponible : aucun badge. Prix résolu absent : prix public de base, ou « À confirmer » s’il manque lui aussi.

Lors de la validation : **129 produits, 247 variantes, 5 lignes de stock disponibles, 129 prix résolus**. Ces nombres sont un constat, pas des constantes de l’interface.

Les familles/structures/usages sont lus uniquement dans les caractéristiques explicites. Pas d’inférence depuis nom, SKU, photo ou prix. Les noms « A faire » et catégories atypiques existants sont conservés. Les métadonnées absentes restent « À préciser ». Aucun badge best-seller/nouveauté n’est inventé : le tri Nouveautés conserve donc l’ordre catalogue en l’absence de ce signal. Le badge stock concerne le design sélectionné, sans garantir une quantité disponible suffisante pour le projet. Les galeries de variante sont prioritaires sur la galerie produit dans la fiche.

Les affirmations éditoriales (SGS, garantie, personnalisation sans surcoût, délais, dépôt) ainsi que les remises 6 % / 10 % reproduisent le brief ; elles restent à valider commercialement. Les calculs sont des **estimations locales**, pas une modification du moteur de prix ou une réservation. Aucune compatibilité Studio n’est créée ou certifiée.

## Interactions

- Catégorie ET stock, tris, introduction adaptée à la catégorie, état vide et remise à zéro.
- Design actif sur chaque carte, fiche avec galerie limitée à cinq vues, ajout au MOQ réel du design.
- Projet séparé par référence/design, badge total des pièces, compteur carte agrégé, pas de 10 ; suppression sous le MOQ depuis la carte, plancher MOQ dans le tiroir.
- Remises sur le total des pièces : 99 → 0 %, 100 → 6 %, 150 → 10 %. Prix inconnu : ligne et estimation « À confirmer », jamais zéro par défaut.
- Persistance `terrassea-projet` au format du brief ; identités de variantes conservées séparément pour refuser un index devenu différent après modification catalogue.
- Passage vers `/#contact` via stockage local : références, IDs et noms des designs, quantités, réception. La page d’accueil revalide ces identités contre l’API, affiche le résumé et prépare `selection` dans son payload configurable. Aucune donnée projet dans l’URL, aucun prix accepté depuis le stockage, aucun envoi CRM réel. Une modification du panier invalide le résumé transféré précédent.
- Échap, fermeture extérieure, focus contenu dans les dialogues, arrière-plan inert, réduction des animations selon la préférence système.

## Adaptations explicites

Le titre reste sur une ligne en desktop. À 360 px, il passe sur deux lignes, en conservant **22 px minimum**, pour éviter un texte minuscule ou un débordement. Les noms catalogue longs se replient naturellement. Les actions principales gardent des cibles de 44 px.

Le fichier de design system joint a permis de remplacer le jaune provisoire de l’accueil par son token exact `#edbb00`. Aucun média fournisseur privé n’est copié dans le site.

## Fichiers

- `index.html`, `source-styles.css`, `styles.css` : présentation native et responsive.
- `model.js`, `app.js` : états, interactions et persistance.
- `data.js` : adaptation publique, validation du panier, calcul d’estimation.
- `api.mjs` : lectures serveur publiques fixes.
- `catalogue.test.mjs` : tests avec fixtures synthétiques limitées au fichier de test.
- `../terrassea-accueil-v3/project.js` : validation du transfert vers le formulaire.
- Le serveur, la configuration et le contrôleur de l’accueil sont adaptés pour partager l’origine et le projet.

## Validation de cette passe

```sh
node --test design/terrassea-accueil-v3/page.test.mjs design/terrassea-catalogue/catalogue.test.mjs
bun run check
bun run test:security
bun run build
```

- Tests autonomes : **38 réussis, 0 échec** (16 accueil, 22 catalogue).
- `bun run check` : typecheck et lint OK ; **1069 tests réussis, 8 ignorés**, 157 fichiers réussis / 2 ignorés.
- Sécurité : **277 tests réussis**, 34 fichiers.
- Build : réussi ; budgets de bundles, scan des 216 chunks client et isolation de la démo réussis. Les derniers changements de persistance, exclus du build applicatif, sont vérifiés par les tests autonomes et un lint ciblé supplémentaire.
- Navigateur : grilles **4 / 4 / 3 / 2 colonnes** à **1440 / 1024 / 768 / 360 px**, sans débordement horizontal. Fiche et tiroir vérifiés à 360 px.
- Parcours réel : filtre Table + stock → état vide ; ajout ARCACHON, seuil 100 → 6 % ; ajout ARLES Bois clair depuis la fiche → 150 / 10 % ; rechargement avec bon design ; transfert du résumé vers l’accueil sans paramètres d’URL. Les deux lignes de test ont été retirées ensuite.
- HTTP local : catalogue 200 ; `api.mjs`, `.env.local`, `data/private/test` → 404 ; `POST /lead` → 403.
- Aucun score Lighthouse ni validation commerciale des données revendiqué.

**DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.**
