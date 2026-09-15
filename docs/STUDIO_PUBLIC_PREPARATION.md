# Studio public — préparation de projet

Ouverture autorisée par Adrien le 15 septembre 2026 : outil public de préparation de projet, avec vérification humaine avant commande. Il ne s’agit pas d’une validation DATA READY des lots avancés.

## Périmètre

- Parcours existants : `/studio`, `/studio/assises`, `/studio/tables`, `/studio/personnalisation`.
- Sélection et conservation locale du projet, inspirations matières, préparation du brief et formulaire de contact existant.
- Bandeau : les personnalisations, compatibilités, prix et délais seront confirmés avant commande.
- Moteurs conservateurs inchangés : une information absente ne devient pas vérifiée ; une personnalisation effective ne sur-certifie pas la réservation.
- Pied de page complet du site conservé ; liens de lancement de l’accueil, du catalogue et de la page prix reliés au Studio lorsque le flag est ON. Le contact et les ancres éditoriales restent disponibles.

## Données observées avant ouverture

Lecture anonyme seule : 129 produits dans `studio_products`. Les vues des médias avancés, règles plateau/piètement, capacités de personnalisation, bibliothèque et associations visuelles renvoient `PGRST205` en production. Les repositories existants conservent leurs replis prudents ; le snapshot visuel public est uniquement une source d’inspiration, jamais une preuve de compatibilité.

Aucune migration 41–46 appliquée pour cette ouverture. Aucune règle, association, donnée catalogue ou secret créé/modifié. **DATA READY = NON.**

## Activation reproductible

Le build de publication utilise explicitement `VITE_STUDIO_ENABLED=true`. La valeur est également conservée dans `.env.production` local (gitignoré). Sur un autre poste ou en CI, fournir cette variable de build : les valeurs des variables Cloudflare seules ne reconstruisent pas un bundle Vite. Aucun secret ne doit être ajouté sous le préfixe `VITE_`.

Commande de publication : `VITE_STUDIO_ENABLED=true bun run deploy`.

Retour à l’accès privé : reconstruire et déployer avec `VITE_STUDIO_ENABLED=false` (et corriger la valeur locale pour les builds suivants). La vérification HMAC des cookies de preview, leur TTL, l’auth Supabase et les gardes admin sont inchangés.

## Validation

`bun run check`, `bun run test:security`, `bun run build`, tests ciblés flags/compatibilité/personnalisation et E2E `playwright.studio-opening.config.ts` (serveur 5194, mode production), puis `playwright.public-pages.config.ts` (serveur 5193, mode production). Les E2E bloquent les écritures réseau : aucun formulaire de test ni événement Studio de test n’est inséré en production.

La validation de l’ouverture vérifie l’accès sans cookie, la navigation depuis l’accueil vers les assises, le chargement réel du parcours assises, les routes Tables/Personnalisation avec données avancées absentes et la présence du footer légal. Les assertions historiques du flag OFF restent couvertes par les tests unitaires.

Version précédente du site public : `939e5890-a826-4cb7-a5c4-d1192ec0effe`. Pas de fusion dans `main`.

Résultats avant publication : **1 085 tests projet réussis, 8 ignorés ; 277 tests sécurité ; 4 E2E d’ouverture avec lectures réelles et écritures bloquées ; 20 E2E des pages publiques.** Les tests d’ouverture confirment que le parcours Assises charge ses produits actuels, au-delà du simple statut HTTP.
