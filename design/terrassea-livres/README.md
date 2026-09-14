# Terrassea — Containers livrés

Preview : **http://localhost:5192/livres/**. Lancement depuis le dépôt :

```sh
bun design/terrassea-accueil-v3/serve.mjs
```

Source visuelle : `Nouveau design site internet (3)/Terrassea Livres.dc.html` et brief joint. Les pages précédentes de cet export sont identiques.

## Réutilisation du code existant

Aucun nouveau modèle métier ni table. La page réutilise :

- `src/lib/delivered-containers/repository.ts` : modèle `DeliveredContainer`, mapper canonique `toDeliveredContainer`, statistiques `computeStats`. Une fonction `listPublishedRegistryContainers` ajoute une projection publique pour les statuts du registre, sans fallback.
- `src/components/DeliveredContainerCard.tsx` : option de présentation `registry`, rendue en HTML natif par `react-dom/server` sur le serveur local. Le rendu historique par défaut et ses usages existants restent inchangés. Aucune copie indépendante de carte ni runtime React client dans la preview.
- `src/lib/leads/repository.ts` : `subscribeContainerNotification`, contrat RPC existant.

Les exports utiles `computeStats` et `subscribeContainerNotification` sont regroupés par Bun dans le petit module client `/livres/shared.js` ; le code de données fictives n’est pas inclus. Le footer applicatif existant n’est pas remplacé ; la preview conserve le footer de la maquette.

## Correspondance des champs

| Maquette        | Champ existant / traitement                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| code            | `reference` ; `id` identifie le dépliage                                                                |
| titre / zone    | `port`, sans inventer un nom de tournée                                                                 |
| transit         | `status !== delivered`, parmi `open`, `locked`, `shipping`, `delivered` publiés ; annulations exclues   |
| étape           | `open`/`locked` → Usine ; `shipping` → En mer ; `delivered` → Dépôt                                     |
| date livré      | `deliveredAt`                                                                                           |
| ETA             | `deliveredAt` pour le transit, conformément au contrat shipping existant                                |
| départ          | absent : non affiché, l’ETA n’est jamais présentée comme une date de départ                             |
| villes livrées  | absent : non affiché ; le port n’est pas transformé en liste de villes clientes                         |
| pros / articles | `professionalsServed`, `totalItems`, seulement après livraison                                          |
| économie        | `savingsPercent`, jamais les économies en euros                                                         |
| contenu         | `productBreakdown[].modelLabel`, seulement après livraison                                              |
| photos          | `gallery[].url`, puis `photoUrl`, dédupliquées, 4 maximum ; placeholders pour les autres                |
| témoignage      | `testimonial.quote` et auteur s’il existe ; aucun témoignage généré                                     |
| SGS             | rapport public actif SGS, de type inspection avant expédition, avec fichier et association au container |

Le schéma ne distingue pas des statuts « Chargé » ou « Douane FR ». Ces jalons restent visibles dans le suivi, sans inventer une progression à partir d’un nom libre ou d’une date. `locked` ne constitue pas une preuve de chargement.

Tri : date réelle de livraison décroissante pour les livrés, date de publication pour le transit faute de départ structuré ; l’ETA future ne détermine pas l’ancienneté du registre. Le dernier livré reçoit l’accent or.

La règle publique existante qui masque les volumes et le manifeste avant livraison est conservée. Les chiffres de transit de la maquette ne sont pas repris. Pas de délais annoncé/constaté, coûts ou économies en euros dans les cartes ; les colonnes financières ne sont pas sélectionnées.

## Données observées et affichage prudent

Lecture anonyme publique lors de la validation : **3 livrés, 1 shipping**. Totaux des seuls livrés : **15 pros, 1 410 articles**. Moyenne des deux pourcentages renseignés : **35 %** ; le troisième pourcentage est absent et n’est pas remplacé par zéro dans la moyenne.

Aucun rapport public SGS associé répondant aux critères n’a été trouvé : aucun badge ni « 100 % contrôlés » affiché. Lorsque des rapports existent, le pourcentage est calculé sur les seuls containers livrés documentés. Le contenu commercial fixe n’est pas certifié par cette conversion.

Les photos et témoignages proviennent tels quels de la base publique. Leur présence en base ne constitue pas une nouvelle validation éditoriale de la scène photographiée. Les dates et noms atypiques ne sont pas corrigés silencieusement.

Base vide : compteurs à zéro, aucune carte fictive, aucun `NaN` ; transit seul : aucun volume livré comptabilisé. Erreur API : message indisponible et compteurs masqués, sans prétendre qu’aucun historique n’existe. Prix/metrics absents sur une carte : lignes masquées. Images manquantes ou en erreur : « Photo à venir », jamais de photo générique inventée.

## Alerte et limites locales

Le formulaire appelle la fonction de repository existante avec un transport **volontairement désactivé en preview**. Il conserve l’email et indique « Simulation uniquement : aucune inscription envoyée. ». Aucune inscription distante, pas d’email dans l’URL, le stockage local ou l’analytics. Un client réel approuvé pourra être raccordé ultérieurement sans changer le contrat RPC `subscribe_container_notification` (`p_email`, `p_source`). Aucun succès réel n’est simulé.

Le serveur écoute sur `127.0.0.1`, refuse tous les POST et sert une liste limitée de fichiers. Lectures GET Supabase anonymes uniquement, sans service role, session utilisateur, SQL ou modification de configuration. Les chemins des fichiers privés SGS ne sont ni sélectionnés ni transmis : seule l’existence du fichier est filtrée côté requête.

## Fichiers

`index.html`, `source-styles.css`, `styles.css` : page et habillage de la variante carte ; `app.js` : filtres, statistiques, dépliage, images et alerte ; `api.tsx` : lecture publique et rendu du composant existant ; `shared.ts` : exports existants regroupés ; `page.test.tsx` : tests de preview.

Adaptations du repository et du composant existants avec tests ciblés ; serveur local et liens des quatre pages précédentes. Aucune migration, aucun secret/flag ni déploiement.

## Validation

```sh
bunx vitest run src/components/DeliveredContainerCard.test.tsx src/lib/delivered-containers/repository.test.ts
bun test design/terrassea-livres/page.test.tsx
node --test design/terrassea-partenaires/page.test.mjs design/terrassea-prix/page.test.mjs design/terrassea-catalogue/catalogue.test.mjs design/terrassea-accueil-v3/page.test.mjs
bun run check
bun run test:security
bun run build
```

- Ciblés composant/repository : **15 tests** (également couverts par `check`).
- Preview registre : **7 tests réussis**, 23 assertions ; précédentes pages : **71 tests réussis**.
- `check` : typecheck/lint OK, **1076 tests réussis, 8 ignorés**, 158 fichiers réussis / 2 ignorés.
- Sécurité : **277 tests réussis**, 34 fichiers.
- Build réussi, budgets et isolation démo validés, scan des 216 chunks client réussi.
- Navigateur : 1440 / 1024 / 768 / 360 px sans débordement horizontal ; filtre transit → une carte, une fiche ouverte, ETA et jalon En mer ; données réelles et placeholders vérifiés.

**DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.**
