# Studio Lot 3 — revue corrective et UX

Revue locale du 8 septembre 2026. Checkout vérifié propre avant modification : `/Users/adrien/hub-and-ship`, branche `codex/studio-lot-3-review`, départ `112eff81f1f04cd15dd742c146afdc99fba4c2b0`.

## Corrections

- V1 assigné distinct de V1 opérationnel. Preview, publication, modèle et couverture du pool conditionnent ensemble cartes, convergence, finalistes et duels. Le fallback reste entièrement V0 ; attribution V1 conservée. Les E2E comparent chaque carte et les finalistes aux sorties V0, avec graphe absent puis partiel, même en présence de paires diagnostiques.
- Imports : candidats recalculés, candidats obsolètes retirés dans le batch, décisions humaines préservées, y compris au changement de modèle. Pilot draft régénérable, active/archived immuables. SQL réellement exécuté deux fois et comparé dans PostgreSQL local. [Règles détaillées](STUDIO_LOT_3_RUNBOOK.md).
- Events : liste applicative commune `v0.1` / `v1.0` ; API `v42.7` → 400 sans aucune écriture. Aucune FK ajoutée.
- Sécurité : sondes renseignées, preuve attendue SQLSTATE `42501`, limites relationnelles distantes explicites. INSERTs valides testés avec les droits PostgreSQL réels des 13 tables internes. Le script distant n’a pas été lancé.

## Passe UX et inspection

Parcours Playwright local sur Chrome desktop 1280×720 et viewport iPhone 13 (Chromium), avec backend synthétique et cookie de preview de test. Ce n’est pas une validation de production ni de Safari natif.

- Carte de découverte à hauteur bornée, informations plus compactes, actions tactiles conservées, aucun total catalogue visible ou accessible : seulement « Choix N ».
- « Vos préférences », « Vos meilleures pistes », projet professionnel et fabrication directe. Aucun contrôle de personnalisation futur inventé, aucun prix modifié.
- Prompt ready distinct, CTA principal « Voir mes meilleures pistes », continuation secondaire. Stalled reste prudent ; aucun prompt lorsque le signal est insuffisant ou en fallback V0.
- Finalistes : explication différente entre classement visuel et favoris V0, deux pistes occupent deux colonnes, trois restent le maximum, sans remplissage artificiel. Comparaison diagnostique secondaire après les pistes, images compactes.
- Favoris moins encadrés, rail discret, barre mobile avec safe area. Retour du focus au titre lors d’un changement d’étape.
- Quantité prioritaire sur mobile : petite vignette et champ adjacent. Codes internes de résolution retirés du texte, retour métier conservé.
- Chargement borné, erreur avec réessai, épuisement orienté bilan du projet, favoris préservés lors d’une nouvelle exploration.
- Footer remplacé uniquement dans le layout Studio : projet, fabricants, contact et liens légaux. Aucun marketing conteneur ajouté.

Captures locales reproductibles : `.cache/studio-review/after/{desktop,mobile}-{discovery,convergence,finalists,details,quantity,loading,error,empty,exhausted}.png`. `STUDIO_CAPTURE_DIR` permet de choisir le dossier. Fichiers locaux ignorés, non livrés comme assets du site. Images de catalogue existantes utilisées sans modification : les premières captures utilisaient une vue annotée, les finales la vue produit `BIS-002-01.webp`. Noms et relations visuelles restent des fixtures : les captures valident le layout, pas la pertinence du moteur sur les données réelles.

Inspection finale : le parcours donne la priorité aux préférences, aux pistes proposées et à la quantité du projet. Les détails réutilisent la galerie existante, avec zoom et navigation accessibles ; le projet mobile reste consultable. Les grands composants publics (header, galerie, identité générale), le repositionnement commercial global et les Lots 4/5 restent pour une passe dédiée.

## Validation

- Tests ciblés runtime/API/carte/SQL : réussis.
- `bun run check` : typage et lint OK ; **895 tests réussis, 8 ignorés** (intégrations sans environnement réseau de test).
- `bun run test:security` : **226 tests réussis**, dont les preuves PostgreSQL locales.
- `python3 -m unittest discover -s pipeline/studio -p 'test_*.py'` : **9 tests réussis**.
- `bun run build` : réussi ; budgets bundles respectés et scan de fuite sans marqueur interne dans les 211 chunks client.
- E2E `studio-review.config.ts` : **10 réussis** ; `studio-v1.config.ts` : **8 réussis** ; `studio-lot2.config.ts` : **10 réussis**. Total : **28 scénarios** desktop/mobile. Les deux parcours de capture ont été rejoués avec attente du décodage des images visibles : **2 réussis**.
- Les assertions Lot 2 ont été adaptées au nouveau titre et à « Choix N ». Le test du pilote ignoré en accès public vérifie toujours les six références distinctes de sa fixture, sans dépendre d’un compteur affiché.
- Aucune sonde réseau de sécurité lancée contre une base distante.

Aucun déploiement, aucune migration production, aucune écriture production, aucun merge main, aucun secret ni flag modifié. Les migrations 39/40/41 sont inchangées ; la migration 41 n’est toujours pas appliquée en production. DATA READY et PRODUCTION VERIFIED du Lot 3 ne sont pas revendiqués.
