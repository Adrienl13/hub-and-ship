# Revue corrective Studio Projet — Lot 2

Branche : `codex/studio-lot-2-review`.
SHA de départ vérifié avant modification : `0e8eda71cd5c35bd3e332d6dfd6b9ed9ed122fae`.
Le dépôt initial était sur `main` : arrêt, puis récupération et suivi de la branche distante attendue après autorisation explicite. Working tree propre au départ de la revue.

## Problèmes vérifiés et corrections

Les sept défauts ont été confirmés dans le code du SHA de départ.

| Point | Constat initial | Correction et preuve |
| --- | --- | --- |
| 1. Familles | `buildDiscoveryPool`, `discovery.ts:46`, construisait un ensemble vide, neutralisant tous les `familyId`. | Option A : les IDs publics non vides alimentent l'ensemble vérifié. Migration 39, ligne 296 : `CASE WHEN f.status = 'verified'` ; lignes 374–378 : `studio_products` hérite de cette projection publique. Candidate/rejected/absente donnent null. Aucun ID déduit d'un nom ni d'attributs, aucun nouvel appel DB. Tests de projection, affinité, répétition et prix ; garde SQL existante conservée. |
| 2. Jeu pilote | La route transmettait `set` sans vérifier la source d'accès. | La route transmet `studioAccess` issu du layout ; `buildDiscoveryPool` n'utilise `set` qu'en preview. Flag/none/source absente et identifiant invalide : découverte complète. Jeu absent ou sans assise admissible : repli complet. Tests unitaires preview et E2E flag avec jeu actif. Preview signée inchangée. |
| 3. Accessibilité | Résumé : boutons de 40 px et champ quantité de 36 px ; suppression favori de 28 px ; lien Reprendre inline ; fermetures de dialogues et navigation galerie trop petites. | Résumé ≥44 px, suppression favori 80×44 sous la vignette pour éviter le chevauchement, reprise ≥44×44. Styles limités aux fenêtres Studio pour leurs boutons internes, dont galerie et fermeture, sans modifier les composants catalogue partagés. En-têtes dégagés, retour à la ligne des favoris/candidats, gestion clavier/focus et réduction du mouvement conservées. E2E mesurent largeur ET hauteur dans découverte, favoris, finalistes, candidats, résumé, détails et projet mobile ; contrôle d'overflow. |
| 4. Troisième finaliste | `selectFinalists` était correct ; le callback de remplacement de la route appelait `addFinalist` sans vérifier le score. | `finalistCandidateAction` dans le moteur décide add/replace/compare à partir de l'affinité. À deux, score ≤0 : détails comparables sans mutation ; score >0 : ajout permis. À trois : remplacement explicite conservé, plafond inchangé. Tests -1/0/+1, remplacement, identifiant inconnu et E2E deux finalistes conservés. |
| 5. Favoris connectés | Les appels add/remove du hook démarraient indépendamment. | File Promise par compte ET productId, conservée hors du hook pendant son remontage. Chaque écriture attend la précédente ; autres produits/comptes indépendants, échecs silencieux ne bloquant pas la suite. Tests avec promesses différées add/remove et add/remove/add dont les réponses suivantes sont disponibles avant la première. Tests d'isolation et de reprise après erreur. Gardes anonymes conservées et `useFavorites` inchangé. |
| 6. Événements | Le Promise `work` démarrait avant son chaînage dans `inFlight`. | Travail différé avec `inFlight.then(work, work)`, capture des lots dans l'ordre, attente du travail déjà en vol même si queue vide. Keepalive conservé, lot réseau échoué abandonné comme auparavant, suivants envoyés. Test premier sender pending, second flush sans démarrage anticipé, ordre et keepalive conservés après rejet du premier. |
| 7. Projet incomplet | `ProjectSummary` supprimait visuellement une référence inconnue et `projectStateFor` l'ignorait. | Ligne « Référence à vérifier » persistée et retirable, quantité locale conservée, aucun prix/stock fabriqué. État `manual_quote_required`, total affiché « Montant à vérifier » dans rail et barre mobile. Le même traitement couvre un design disparu. Test deux lignes/un produit, retrait réel du store, catalogue entièrement absent, design absent et E2E desktop/mobile. |

## Non-régression

- Moteur : `ALGORITHM_VERSION = v0.1` inchangé ; EngineSeat limité à id/material/seatKind/familyId, prix et pass sans poids, déterminisme et exploration seedée testés, aucun appel `Math.random()` dans le moteur. Aucun duel automatique ajouté.
- Quantité : entier ≥1, aucun arrondi au MOQ, 6 accepté pour MOQ 50 ; stock évalué avant below_moq. Résolution commerciale inchangée, aucune donnée commerciale créée.
- Projet : favoris distincts de la sélection explicite, Undo par snapshot exact, plafond de trois finalistes, store unique `terrassea-studio-v1` inchangé ; rail et barre alimentés par le même projet.
- Sécurité : accès/preview signée inchangés ; tests flag OFF et cookies passent ; origin check, rate limit, Zod strict existants vérifiés. Aucun service_role client, aucune clé preview ajoutée au bundle, colonnes publiques explicites. RLS et grants des migrations inchangés ; aucun nouveau grant anon sur tables internes.
- Terminologie : la formulation « rend la réservation d'assises possible » n'a pas été trouvée dans les fichiers suivis. Le runbook précise le rôle serveur de `SUPABASE_SERVICE_ROLE_KEY` pour les événements et l'absence de réservation au Lot 2. Sa table de statut erronée pour la migration 39 a été corrigée : APPLIQUÉE, Lot 1 production verified (état fourni par Adrien).

## Validation locale

| Commande | Résultat final |
| --- | --- |
| `bun run check` | Code 0 ; TypeScript et ESLint sans erreur ; 130 fichiers passés, 2 ignorés ; 838 tests passés, 8 ignorés. |
| `bun run test:security` | Code 0 ; 27 fichiers, 201 tests passés. |
| `bunx vitest run src/lib/studio src/stores/studio.store.test.ts src/components/studio src/routes/api/studio` | Code 0 ; 18 fichiers, 182 tests passés. |
| `bun run build` | Code 0 ; build client/serveur ; budget ContainerScene 848,9 kB brut ≤875 et 225,9 kB gzip ≤245 ; scan sans marqueur interne dans 205 chunks client. |
| E2E Studio | Code 0 ; 10 tests passés (5 scénarios × Chromium desktop/mobile), 11,8 s. Flag local ON, URL Supabase factice, surfaces et événements interceptés. Aucun backend de production utilisé pour ces scénarios. |

Les huit tests ignorés sont les intégrations DB dont les variables de configuration sont absentes, sans désactivation de test. Les premiers essais ont révélé des prérequis locaux manquants : dépendance `qrcode-generator`, puis Chromium Playwright. Résolus par `bun install --frozen-lockfile` (lockfile inchangé) et `bunx playwright install chromium`. Les suites ont ensuite été exécutées avec succès. Les hooks Git restent activés.

Commande E2E :

```sh
VITE_STUDIO_ENABLED=true VITE_SUPABASE_URL=https://fake-supabase.test VITE_SUPABASE_ANON_KEY=fake bunx playwright test tests/e2e/studio.spec.ts --reporter=line
```

## Fichiers de code et tests modifiés ou ajoutés

- `src/lib/studio/discovery.ts`, `discovery.test.ts`
- `src/lib/studio/engine/index.ts`, `scoring.ts`, `finalist-action.test.ts`
- `src/lib/studio/events-client.ts`, `events.test.ts`
- `src/lib/studio/favorites-sync.ts`, `favorites-sync.test.ts`
- `src/hooks/useStudioFavoritesSync.ts`
- `src/routes/studio.assises.tsx`, `studio.index.tsx`
- `src/components/studio/FavoritesTray.tsx`, `Finalists.tsx`, `ProjectBottomBar.tsx`, `ProjectSummary.tsx`, `ProjectSummary.test.tsx`, `StudioProductDetails.tsx`, `StudioShell.tsx`
- `tests/e2e/studio.spec.ts`
- Documentation : `docs/RUNBOOK_STUDIO.md` et ce rapport.

## Production

Migration 40 NON modifiée et NON appliquée en production. Aucun déploiement, aucune migration distante, aucun changement de secret, aucun merge main. La revue utilise l'état de production déclaré par Adrien ; elle ne l'a pas modifié. La publication Git vise exclusivement `origin/codex/studio-lot-2-review` ; les SHA de commits et la vérification du push sont fournis dans le compte rendu final.
