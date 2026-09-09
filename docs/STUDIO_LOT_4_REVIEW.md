# Studio Projet — Lot 4 : tables et espace projet

Revue locale du 9 septembre 2026. Branche `codex/studio-lot-4-bring`, départ `b5014aa8e478c5bed903b51aad9305b19dc09e9d`, arbre propre vérifié avant modification. Aucun changement de branche ni merge.

| Statut                     | Résultat                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| CODE READY                 | OUI — typage, lint, tests, build et parcours locaux validés       |
| UX REVIEW READY            | OUI — revue locale effectuée, validation humaine encore requise   |
| DATA / COMPATIBILITY READY | NON — aucune règle commerciale réelle validée pendant ce chantier |
| PRODUCTION READY           | NON — migration 42 non appliquée, aucune livraison en production  |

## Architecture et parcours

`/studio` présente « Créez votre projet », trois entrées visuelles et une reprise avec les références réellement conservées. Les photographies viennent du catalogue ; les absences restent explicites. `StudioSectionHeader` harmonise les trois routes ; `StudioChoiceCard` mutualise les sélections de plateaux et de piètements. Palette, polices et composants généraux existants conservés.

Projet complet : choix explicite d'une assise → quantité → « Continuer avec les tables ». Le lien ne navigue jamais automatiquement. L'entrée Assises reste autonome. L'entrée Tables ouvre `/studio/tables?entry=tables`.

Tables : forme → dimensions disponibles → toutes les variantes correspondantes → quantité libre → piètement autorisé. Les références sur demande restent accessibles avec un prix à confirmer. Aucun moteur de goût n'intervient. Une nouvelle configuration commence à `max(1, ceil(total des quantités d'assises / 2))` ; modifier les assises ou le plateau ne remplace pas une quantité déjà saisie. Les MOQ restent informatifs, sans arrondi automatique.

Le callback facultatif de `CustomTableTopDialog` conserve seulement le besoin local (forme, dimensions, finition). Il s'arrête avant la construction ou l'envoi d'un contact. L'usage catalogue conserve son chemin historique. Escape ferme le dialogue et restitue le focus à son déclencheur Studio, ou au titre si ce déclencheur a disparu.

Le projet représente chaque table par une configuration, pas par deux produits visuellement indépendants. `evaluateTable` utilise les helpers existants de readiness, fulfillment et état de projet. `projectOverview` calcule les mêmes quantités, montant et état pour le rail et la barre mobile. 60 assises + 30 tables = 90 éléments, sans compter deux fois plateau/piètement. Aucun total complet n'est affiché lorsqu'une référence ou une information nécessaire reste non confirmée.

## Compatibilité exacte

Le résolveur utilise exclusivement les champs structurés et les projections vérifiées :

1. Produit absent : `requires_confirmation`. Produit inactif, mauvaise catégorie ou mauvais rôle : `denied`.
2. Lecture des règles/profils indisponible ou malformée : `requires_confirmation`. Une panne ne doit pas masquer une exception négative et autoriser un repli.
3. Exception vérifiée pour le couple exact plateau/piètement : son verdict prévaut. Des verdicts contradictoires restent non confirmés.
4. Sans exception : forme et dimensions positives finies obligatoires. Un type explicitement rattaché et vérifié permet la règle générale de forme/dimensions maximales. Seule une règle correspondant au type et à la forme est applicable ; dépasser ses dimensions maximales est refusé. Une forme sans règle ne constitue pas une preuve d’incompatibilité. Les dimensions sont comparées grand côté/petit côté ; la rotation d'un rectangle est admise.
5. En l'absence de règle générale applicable au type et à la forme, `compatibleTopShapes` peut être utilisé **seulement si la liste est non vide**. La fonction catalogue existante n'est appelée qu'après ces garde-fous.
6. Liste vide, type ambigu ou informations insuffisantes : `requires_confirmation`.

Seuls les `allowed` apparaissent comme piètements sélectionnables. Le nom, le SKU, le prix et les embeddings ne participent jamais à la compatibilité. Le comportement historique de `src/lib/table-composer.ts` est inchangé.

Changer le plateau réévalue et retire une base devenue invalide, avec explication. Recharger une ancienne combinaison la réévalue avec les données actuelles : un `allowed` n'est jamais persisté comme preuve. En cas d'incertitude, « Demander une vérification » conserve le besoin local et la raison `compatibility_unconfirmed`. Aucune demande n'est envoyée à ce stade.

## Migration 42 et administration

`supabase/migrations/20260909100000_studio_table_compatibility.sql` est additive, postérieure à 41 et **NON APPLIQUÉE EN PRODUCTION**.

- `studio_table_base_types` : vocabulaire explicite des types de piètement, sans inférence depuis le nom.
- `studio_table_base_profiles` : rattachement d'un piètement réel à un type, avec validation et provenance.
- `studio_tabletop_base_rules` : exception par couple ou règle par type/forme/dimensions maximales, avec verdict et provenance.
- FK produits/types/utilisateurs, unicité des couples et des règles type/forme, contraintes de portée et d'audit, contrôle des rôles produit par trigger.
- Tables internes sous RLS admin ; aucune lecture anon, aucune lecture de lignes ni écriture buyer. Deux vues publiques minimales ne projettent que les règles/rattachements vérifiés, sans auteur, provenance ni coûts. Les produits inactifs ou dont le rôle a changé sont exclus.
- Le trigger fixe l'auteur depuis `auth.uid()` et la date côté base. Une provenance non vide est requise pour valider. L'archivage retire immédiatement la projection.
- Aucun seed de compatibilité. Les migrations 39/40/41 restent inchangées.

`AdminStudioCompatibility` est intégré dans `AdminStudioTab`. L'admin peut consulter un couple et les configurations non confirmées, créer des types, valider un rattachement, déclarer une règle positive/négative avec provenance, puis l'archiver. Chargement indépendant de la section visuelle Lot 3 ; migration absente annoncée clairement. Client Supabase navigateur existant et RLS uniquement, aucun client privilégié ajouté.

Les six événements Lot 4 étendent le contrat, sans PII ni nouveaux champs libres. `LOT_3_EVENT_TYPES` conserve le contrat historique pour tester la migration 41 ; la migration 42 est testée contre la liste complète actuelle.

## Store et préservation Lot 3

Version locale **4**, clé `terrassea-studio-v1` conservée. `project.tables` contient des références plateau/variante, piètement/variante, quantité, indicateur de saisie utilisateur et éventuel besoin sur mesure. Ajout, modification et retrait utilisent le journal existant (50 actions).

Migration défensive des projets et des snapshots Undo : conservation des lignes, session, interactions, favoris, finalistes et attribution V0/V1. Aucun appel à `composeCartLines`, qui arrondirait les quantités. Aucun changement des moteurs V0/V1, du resolver, de la convergence, des Decision Images ou de l'authentification.

## Validation locale

Commandes exécutées à la racine du dépôt, avec données factices pour les E2E :

| Commande                                                                            | Résultat                                                                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Tests ciblés compatibilité, store, repository, composants, admin, sur mesure et SQL | Réussis                                                                                                             |
| `bun run check`                                                                     | Typage/lint OK ; **946 tests réussis, 8 ignorés** (intégrations sans environnement réseau de test)                  |
| `bun run test:security`                                                             | **247 tests réussis** : PostgreSQL PGlite local, RLS/ACL/FK/contraintes/vues/audit/parité événements et scan client |
| `bun run build`                                                                     | Réussi, budgets respectés et aucun marqueur interne détecté dans **214 chunks client**                              |
| `bunx playwright test --config tests/e2e/studio-lot2.config.ts`                     | 10 réussis                                                                                                          |
| `bunx playwright test --config tests/e2e/studio-v1.config.ts`                       | 8 réussis, preview incluant désormais `/studio/tables`                                                              |
| `bunx playwright test --config tests/e2e/studio-review.config.ts`                   | 10 réussis                                                                                                          |
| `bunx playwright test --config tests/e2e/studio-tables.config.ts`                   | 12 réussis sur 1440×900, 1280×900, Pixel 5 et iPad Mini                                                             |

Le nouveau parcours vérifie la suggestion 60→30, la quantité libre 17, le changement de plateau invalidant la base, l'absence de faux compatible, la conservation après refresh, le résumé mobile et sa quantité, le sur mesure sans contact, Escape/focus, les cibles de 44 px et l'absence de débordement horizontal. Les tests existants restent présents ; leur titre d'entrée a été adapté à « Créez votre projet ».

Deux défauts détectés pendant les premiers E2E ont été corrigés puis rejoués : sélection de plateau réouverte après refresh et focus perdu à la fermeture du sur mesure.

Les scripts `security:studio` et les sondes sont étendus aux surfaces Lot 4 mais **n'ont pas été exécutés contre une base distante**. La preuve d'écriture refusée repose ici sur PostgreSQL local, pas sur une erreur de validation REST.

## Revue visuelle et limites

Captures locales hors dépôt : `/tmp/studio-lot4-visual/{1440,1280,Pixel5,iPadMini}-{entry,assises,tables,unconfirmed}.png`. Inspection des trois routes aux quatre formats : hiérarchie et palette cohérentes, espace principal large, rail desktop, barre mobile et sheet partagés, pas de débordement détecté.

Les fixtures emploient des photographies locales existantes pour les assises et piètements. L'absence volontaire de photo plateau teste le fallback ; elle ne remplace pas une future revue du vrai catalogue. Les captures et les compatibilités de test ne prouvent donc aucune préparation commerciale de la production. iPad Mini est simulé dans Chromium, pas testé sur un appareil Safari réel. Validation humaine, qualité des photos plateaux, complétude des profils et règles fabricant restent ouvertes.

Aucun déploiement, push, merge main, SQL distant, migration production, secret ni flag de production modifié. Aucun contact réel, appel Stripe ou API IA payante. Prix, panier historique, `TableComposerDialog` et auth Supabase inchangés. L'état production fourni reste flag OFF, Lots 1/2 vérifiés, migrations 39/40 appliquées ; le Lot 4 ne revendique pas une validation production.

## Inventaire des fichiers

### Créés

- `docs/STUDIO_LOT_4_REVIEW.md`
- `src/components/AdminStudioCompatibility.test.tsx`
- `src/components/AdminStudioCompatibility.tsx`
- `src/components/CustomTableTopDialog.studio.test.tsx`
- `src/components/studio/BasePicker.tsx`
- `src/components/studio/StudioChoices.tsx`
- `src/components/studio/TableProjectSummary.tsx`
- `src/components/studio/TableQuantityField.tsx`
- `src/components/studio/Tables.test.tsx`
- `src/components/studio/TabletopPicker.tsx`
- `src/hooks/useStudioCompatibility.ts`
- `src/hooks/useStudioProjectSummary.ts`
- `src/lib/studio/compatibility.test.ts`
- `src/lib/studio/compatibility.ts`
- `src/lib/studio/table-project.test.ts`
- `src/lib/studio/table-project.ts`
- `src/lib/studio/table-repository.test.ts`
- `src/lib/studio/table-repository.ts`
- `src/lib/studio/table-suggestion.ts`
- `src/lib/studio/table.test-helpers.ts`
- `src/routes/studio.tables.tsx`
- `supabase/migrations/20260909100000_studio_table_compatibility.sql`
- `tests/e2e/studio-tables.config.ts`
- `tests/e2e/studio-tables.pw.ts`
- `tests/security/studio-tables-sql.test.ts`

### Modifiés

- `docs/RUNBOOK_STUDIO.md`
- `scripts/security/check-studio-access.mjs`
- `scripts/security/studio-write-probes.mjs`
- `src/components/AdminStudioTab.tsx`
- `src/components/CustomTableTopDialog.tsx`
- `src/components/studio/ProjectBottomBar.tsx`
- `src/components/studio/ProjectSummary.tsx`
- `src/components/studio/StudioShell.tsx`
- `src/lib/studio/events.test.ts`
- `src/lib/studio/events.ts`
- `src/lib/studio/repository.ts`
- `src/routeTree.gen.ts`
- `src/routes/studio.assises.tsx`
- `src/routes/studio.index.tsx`
- `src/stores/studio.store.test.ts`
- `src/stores/studio.store.ts`
- `tests/e2e/studio-preview.pw.ts`
- `tests/e2e/studio.spec.ts`
- `tests/security/studio-access-script.test.ts`
- `tests/security/studio-client-no-service-role.test.ts`
- `tests/security/studio-visual-sql.test.ts`
- `tests/security/studio-write-probes.test.ts`

## Commits

- `230d333 feat(studio): add deterministic table compatibility and reviewed rules`
- `4738fe9 feat(studio): build table configurations and shared project workspace`
- `f3b84e2 feat(admin): review studio table compatibility with provenance`
- Le commit documentaire suivant livre ce rapport et le runbook. Le SHA final est fourni dans le compte rendu de livraison.
