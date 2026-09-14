# Publication des pages Terrassea — septembre 2026

Demande explicite d’Adrien : publier les cinq nouvelles pages et conserver le pied de page complet du site public.

## Intégration

Routes `/`, `/catalogue`, `/prix`, `/partenaires`, `/livres` : versions validées depuis les previews `design/terrassea-*`, intégrées dans `src/components/public-design/`. Les templates HTML sont des sources statiques versionnées, jamais du HTML fourni par un visiteur. Les contrôleurs DOM sont montés et nettoyés par React ; leurs styles sont limités à `.public-design` pour ne pas modifier les autres routes, les cookies ou le footer.

Le composant `Footer.tsx` existant est conservé intégralement sur les cinq pages : marque, société, contact, guides, documents légaux, logistique, gestion des cookies et alerte container.

Les formulaires de démonstration sont remplacés par `ContactForm`, `PartnerForm` et `ContainerNotifyForm`, avec leurs validations, contrats de soumission et confirmations existants. La sélection catalogue est revalidée avant son inclusion dans un brief borné, sans prix repris depuis le stockage navigateur. Un projet reste une demande à étudier, pas une réservation ni une compatibilité vérifiée. Les liens historiques `?panier=` conservent le parcours catalogue précédent.

Les nouvelles lectures GET `/api/public-catalogue` et `/api/public-registry` utilisent uniquement la configuration anonyme publique. Projections fixes, aucune écriture, aucun service role. Le registre réutilise le repository et `DeliveredContainerCard` existants. Les chiffres de transit restent masqués. Un rapport SGS n’est indiqué que lorsqu’il existe réellement dans les métadonnées publiées.

## Éditorial et accès

- Témoignages d’exemple de l’accueil supprimés.
- Les deux vidéos attendues ne sont pas annoncées comme disponibles. La section vidéo du prix sera réintroduite avec les fichiers réels.
- Pas de pourcentage universel SGS non documenté sur la page prix.
- Le logo plaque Terrassea est conservé.
- Les cinq pages sont publiques et indexables ; `VITE_STUDIO_ENABLED` reste OFF. `/studio` et `/studio/assises` restent 404 sans preview privée valide.
- Aucun secret, aucune migration et aucune configuration de base modifiés. Pas de fusion dans `main`.
- Le serveur de preview 5192 reste un outil local et n’est pas déployé.

## Validation et publication

Commandes : `bun run check`, `bun run test:security`, `bun run build`, `bunx playwright test -c playwright.public-pages.config.ts` (serveur local 5193). Les tests de soumission interceptent les requêtes : aucun lead de test ni candidature de test n’est envoyé en production.

Les vérifications couvrent les cinq pages, le footer, l’absence de débordement mobile, les filtres du registre, les liens produit, les formulaires réels et le refus d’accès public au Studio. Le déploiement utilise le Worker existant `container-club` / `prosimport.com`, avec les secrets distants conservés.

Version production précédente vérifiée avant publication : `9418ec86-8ba1-4102-8f82-109541dcafe5`. Elle constitue la référence de retour arrière si les vérifications après publication échouent.

**DATA READY Studio = NON. Aucune migration Studio appliquée par cette publication.**

Validation avant déploiement : **1 083 tests projet réussis, 8 ignorés ; 277 tests sécurité ; 20 tests E2E desktop/mobile ; build et scan des 215 chunks client réussis**. Source Serif 4 et footer sombre contrôlés dans le navigateur. Les lectures publiques locales retournent 129 produits et 4 containers ; Studio sans cookie : 404 sur les deux routes testées.
