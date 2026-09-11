# Homepage — rythme visuel, confiance et mobile

Revue du 11 septembre 2026. Révision après le commit `2b2fbf7` sur `codex/studio-lot-5-2-experience`.

## Références consultées

Il s’agit d’un benchmark qualitatif de sites internationaux du mobilier, pas d’un classement mesuré des « meilleurs sites ». Leurs données de rétention et de conversion ne sont pas publiques dans les pages consultées. Les effets attendus ci-dessous sont des hypothèses de conception, à vérifier ensuite avec des utilisateurs.

| Référence                                                                           | Structure observée                                                                                                                                           | Application à Terrassea                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Muuto](https://www.muuto.com/)                                                     | Campagne fortement photographique, typographie très présente, récits de lieux et personnes, accès séparés aux outils de configuration et aux professionnels. | Donner une place aux lieux et aux images entre les explications. Garder une action simple vers le Studio.                                |
| [Vondom](https://www.vondom.com/us/) et [projets](https://www.vondom.com/projects/) | Alternance collections, projets nommés/localisés, catalogues et informations sur la marque.                                                                  | Passer de l’envie à des informations concrètes, puis aux pages de preuves disponibles. Ne pas inventer une réalisation ou un témoignage. |
| [Kettal Workplace](https://workplace.kettal.com/)                                   | Catégories, collections, projets nommés puis matériaux/services.                                                                                             | Structurer le défilement par questions du client : quel univers, quelle matière, comment composer, comment acheminer.                    |

Les pages ont été consultées par leur contenu web. La capture Muuto a permis de lire visuellement le premier écran ; les captures automatisées Kettal et Vondom étaient partiellement chargées et ne permettent pas de conclure sur leur animation ou leurs performances. Aucun média tiers n’a été réutilisé.

## Réalisation

- Grande séquence photographique asymétrique après le hero : salon outdoor et fauteuils colorés issus des visuels déjà présents dans le dépôt. Légende explicite « images d’inspiration ». Aucune attribution à un client ni promesse de disponibilité.
- Étapes du Studio illustrées par une photographie catalogue, trois échantillons et une représentation schématique de dossier. Aucun faux devis ni montant.
- Container dessiné en SVG léger, avec trois étapes interactives : sélection, regroupement des volumes, devis. Le regroupement se lit graphiquement. Aucun taux de remplissage réel, gain de prix ou délai inventé.
- Liens distincts vers prix, qualité, livraisons documentées et contact. Le container explique le modèle économique, la personnalisation reste la promesse d’entrée.
- Mobile : cadrages dédiés, rythme vertical resserré, seconde photo décalée, étapes illustrées en lignes compactes, commandes container tactiles sans glissement obligatoire. Aucun débordement à 390 px ; contrôle supplémentaire à 320 px.
- Photographies en lazy loading avec dimensions déclarées. Pas de nouvelle dépendance ni de moteur 3D chargé pour le schéma. Animations existantes conservées avec reduced motion.

## Limites et mesure future

Les photographies d’ambiance ne constituent pas des preuves de projets livrés. Des reportages de production, livraison et terrasses clientes identifiés et autorisés permettraient de renforcer davantage la confiance. Ils ne sont pas inventés pour remplir la page.

Pour valider l’effet, observer sur desktop/mobile : compréhension spontanée de l’offre, découverte du Studio, compréhension du container partagé, démarrage d’un projet et abandon. Aucun nouveau tracking n’est ajouté dans cette passe ; ne pas confondre temps passé et réussite du visiteur.

Aucune modification des moteurs Studio, de la base, des flags ou des secrets. DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.

## Validation et captures

Tests ciblés homepage : 6 réussis. Sécurité : 277 réussis (exécution groupée : 283 tests, 35 fichiers). E2E expérience : 10 réussis. Build, budget et scans de confidentialité : OK. TypeScript, ESLint et suite complète sont rejoués au commit.

- [Ambiances desktop](design/lot-5-2/pi-atmosphere-desktop.png) · [mobile](design/lot-5-2/pi-atmosphere-mobile.png)
- [Studio illustré desktop](design/lot-5-2/pi-project-invitation-desktop.png) · [mobile](design/lot-5-2/pi-project-invitation-mobile.png)
- [Container desktop](design/lot-5-2/pi-container-story-desktop.png) · [mobile](design/lot-5-2/pi-container-story-mobile.png)
