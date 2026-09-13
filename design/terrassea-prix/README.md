# Terrassea — Le prix prouvé

Prototype autonome disponible sur **http://localhost:5192/prix/**, servi par :

```sh
bun design/terrassea-accueil-v3/serve.mjs
```

Source : `Nouveau design site internet (1)/Terrassea Prix.dc.html` et son brief. L’accueil et le catalogue du nouvel export sont identiques aux précédents. Les textes et l’ordre de la source HTML sont conservés, y compris le titre « On vous montre la méthode. » (la formulation courte du brief diffère). Les composants DC sont convertis en templates HTML natifs et JavaScript standard. Le design system CSS joint est copié dans `foundation.css`, sans son runtime JavaScript.

## Intégration

- Navigation entre accueil, catalogue et prix sur la même origine locale.
- Deux circuits animés à 1,6 seconde ; clic sur un nœud : pause 8 secondes, puis reprise et mise à jour du focus explicatif. Préférence de mouvement réduit respectée, timers nettoyés.
- Simulateur lié explicitement à l’identité publique **sku-785 / SKU-785**, après vérification du produit « Chaise de bistrot QUIBERON - dossier arceau ». Photo et prix via le lecteur public du catalogue existant ; aucune inférence de compatibilité, aucun prix fictif de repli.
- Prix constaté : **73,55 € HT**. Paliers du brief : 50 → 73,55 € ; 100 → 69,14 € ; 150 → 66,20 €. Arrondi au centime effectué à partir des cents pour éviter une erreur de virgule flottante. Aucun total ni économie en euros affichés.
- « Voir la fiche » ouvre directement la fiche catalogue Quiberon via son ancre publique. Aucun projet ou renseignement personnel dans cette URL.
- Paiement illustratif : 3 / 27 / 40 / 30 %, dernier segment or ; aucune modification du système de réservation ou de paiement.
- FAQ avec une seule réponse ouverte, état accessible `aria-expanded`.

## Médias et contenu à compléter

**Adrien a confirmé que la vidéo mentionnée dans la maquette avait été choisie au hasard et que deux vrais fichiers seront fournis plus tard.** Elle n’est donc ni copiée, ni chargée, ni présentée comme un chargement en usine.

`config.js` expose `video1` et `video2`, actuellement `null`. L’interface affiche deux placeholders légendés, sans élément `<video>` vide. Le contrôleur des futurs médias conserve les contrôles natifs, la lecture muette/bouclée et la pause hors écran ou en onglet caché. En mouvement réduit, la lecture automatique est suspendue ; les contrôles manuels restent disponibles. Les URLs définitives doivent correspondre aux deux scènes réelles. Pour servir des fichiers locaux futurs, ajouter uniquement leurs chemins à la liste autorisée du serveur, sans exposer le dossier Downloads.

Les quatre étapes photo restent des placeholders. Aucun média privé ou fichier pris au hasard n’est utilisé comme preuve.

Quatre réponses FAQ contiennent encore `[Réponse à reprendre du site actuel]`, exactement comme la source. Les affirmations comparatives, prix showroom, garanties, SGS, calendrier de paiement et remises restent du contenu commercial fourni, à valider avant publication. La conversion n’en constitue pas une certification. La photo de Fréjus utilisée sous le nom Quiberon dans la maquette a été remplacée par la vraie photo catalogue Quiberon.

## Formulaire

L’outil CRM/emailing n’est pas configuré. Le formulaire local conserve la saisie et affiche **« Simulation uniquement : aucune inscription envoyée. »** ; il ne simule pas une inscription réellement effectuée.

Le transport configurable accepte uniquement un endpoint same-origin, un POST JSON `{email}` et exige une réponse HTTP réussie avant d’afficher le succès. Par défaut `demo: true`, endpoint `null` : aucun envoi. Le serveur local refuse tous les POST. Aucun email dans le stockage local, l’analytics ou l’URL.

## Fichiers

- `index.html`, `foundation.css`, `source-styles.css`, `styles.css` : structure et présentation.
- `model.js` : textes, circuits, remises, paiement, FAQ.
- `app.js` : cycle de vie, API publique, contrôles et formulaire.
- `config.js` : identité Quiberon, futurs médias et raccordement newsletter.
- `page.test.mjs` : tests autonomes.
- Adaptations limitées du serveur et des navigations accueil/catalogue ; ouverture d’une fiche catalogue par ancre publique.

## Vérifications

```sh
node --test design/terrassea-prix/page.test.mjs design/terrassea-catalogue/catalogue.test.mjs design/terrassea-accueil-v3/page.test.mjs
bun run check
bun run test:security
bun run build
```

- **50 tests autonomes réussis** : 12 prix, 22 catalogue, 16 accueil.
- `check` : typecheck et lint OK ; **1069 tests réussis, 8 ignorés**, 157 fichiers réussis / 2 ignorés.
- Sécurité : **277 tests réussis**, 34 fichiers.
- Build réussi, budgets et isolation de la démo validés ; scan des 216 chunks client réussi.
- Navigateur : 1440, 1024, 768 et 360 px, aucun débordement horizontal ; grille de cinq briques puis deux sur tablette/mobile ; simulateur compact, vrai prix et vraie photo, paliers 100/150 et lien fiche vérifiés.
- Aucun score Lighthouse ou validation commerciale revendiqué.

**DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.** Lectures anonymes publiques uniquement, aucun SQL ni écriture distante.
