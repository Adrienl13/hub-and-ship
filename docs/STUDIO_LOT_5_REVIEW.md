# Studio Projet — Lot 5 Personnalisation

Branche : `codex/studio-lot-5-customization`, issue du moteur Lot 4 validé
`b952eee3baac5571628bc88d29dfe20230438180`.

CODE READY / UX READY : validation locale, avec fixtures uniquement.
DATA READY = NON. PRODUCTION READY = NON.

## Audit et périmètre

Audit de `src/stores/studio.store.ts`, `src/routes/studio*.tsx`,
`src/hooks/useStudioProjectSummary.ts`, `src/lib/studio/readiness.ts`,
`project-state.ts`, `table-project.ts`, `types.ts`, des résumés
`ProjectSummary.tsx` / `TableProjectSummary.tsx`, des composants Lot 4,
des migrations Studio 39–44 et de `docs/RUNBOOK_STUDIO.md`.
Le projet est un brouillon local, les tables Studio existantes décrivent les
produits/règles et la découverte ; aucun projet commercial serveur n'est créé.
Le formulaire `ContactForm` / `/api/contact` existant transmet les demandes par
notification et ne crée pas de réservation ni de devis.

## Modèle et décisions

- Capacité produit : portée seat/tabletop/base avec identifiant catalogue
  obligatoire. Capacités line_item/project globales, sans produit. Aucune
  inférence nom/SKU/image, ni aucun seed commercial.
- Statuts : verified, on_request, unavailable, unknown. Liste facultative de
  valeurs, texte libre autorisé ou non, revue et bornes de quantité facultatives.
- Choix client : valeur, note (600 caractères), demande explicite. Aucun statut,
  prix ou délai n'est persisté comme preuve. Les références produit font partie
  de la clé des options : un changement de composant ne transfère pas ses choix.
- Impact opérationnel recalculé : verified sans revue reste compatible avec
  l'état commercial standard ; on_request, texte libre ou demande spéciale
  impose une revue manuelle ; unknown, unavailable persisté, quantité hors
  borne, valeur absente de la liste ou conflit impose une étude de faisabilité.
  Les états commerciaux plus contraignants existants ne sont jamais relevés.
- Logo, RAL et dimensions spéciales exigent toujours une revue. Les quantités
  restent libres ; la fenêtre de livraison est un souhait, jamais une promesse.
- Une lecture des capacités absente ou malformée passe en mode conservateur.
  Une ligne standard sans demande ne devient pas non confirmée uniquement parce
  que la table des capacités est vide.
- Les bornes de quantité globales projet portent sur le total des unités
  demandées ; celles d'une ligne sur sa quantité. Cette convention devra être
  confirmée lors de la saisie des premières capacités commerciales.

Migration additive 45 :
`20260911100000_studio_customization_capabilities.sql`.
Table interne `studio_customization_capabilities`, CRUD admin sous RLS ; auteur
et date fournis par le serveur. Les statuts autres que unknown nécessitent une
provenance de revue. Les rôles produit, kinds, listes et quantités sont validés.
La vue publique ne contient que les dix colonnes métier nécessaires : aucune
provenance, identité, date de validation ou coût. Les migrations 42/43/44 ne sont
pas modifiées. La migration 45 est testée en PostgreSQL embarqué uniquement,
NON APPLIQUÉE EN PRODUCTION et non appliquée à Supabase local par ce chantier.

## Parcours et capture du lead

`/studio/personnalisation` hérite du contrôle d'accès du Studio. Le résumé
existant propose « Personnaliser et envoyer le projet ». Les assises proposent
Apparence / Personnalisation spéciale et besoin ; les tables Plateau /
Piètement / Besoins spécifiques ; les besoins projet restent indépendants.
Les options inconnues sont présentées comme des souhaits à confirmer ; une
option unavailable est désactivée. Un ancien choix devenu indisponible reste
visible dans le résumé et peut être effacé ; aucune certification silencieuse.

Le store passe de v4 à v5, conserve les lignes et Undo ; il assainit aussi les
snapshots relus à version identique. Les demandes restent sur l'appareil.
La page résumé affiche les choix et leurs statuts recalculés. La base tarifaire
catalogue ne change pas et est explicitement hors personnalisation.

L'envoi reste accessible indépendamment de la readiness, y compris sans ligne.
Un champ facultatif `studioBrief` (200 000 caractères maximum) transporte le
récapitulatif texte au formulaire de contact existant ; il n'est pas placé dans
l'URL ou les événements analytics. Le serveur le valide et l'étiquette comme
**déclaration client à revalider**, jamais comme devis ferme ou preuve de
capacité vérifiée. Le message libre conserve sa limite historique de 3 000
caractères. Aucun email réel n'a été envoyé pendant les tests : endpoint et
notification sont simulés. Le brouillon n'est pas effacé après envoi.

Pas de pricing final, supplément calculé, date promise, PDF, checkout,
réservation ou intégration IA. Pas d'interface admin supplémentaire dans ce lot :
les capacités devront être renseignées par une procédure de validation admin
contrôlée, hors de ce chantier.

## Validation

Résultats locaux de cette livraison :

| Commande / suite                         | Résultat                                                        |
| ---------------------------------------- | --------------------------------------------------------------- |
| Tests ciblés Lot 5 et contrats concernés | 49 réussis, 8 fichiers                                          |
| `bun run check`                          | Typage/lint OK ; 1 029 tests réussis, 8 ignorés                 |
| `bun run test:security`                  | 262 réussis, 32 fichiers                                        |
| `bun run build`                          | OK ; budget bundle OK ; 216 chunks client sans marqueur interne |
| E2E Lot 5                                | 4 réussis (1440, 1280, Pixel 5, iPad Mini)                      |
| E2E Lot 4                                | 12 réussis                                                      |
| E2E Lot 2                                | 10 réussis                                                      |
| E2E revue Lot 3                          | 10 réussis                                                      |

Une régression de réhydratation des sessions neuves détectée par les E2E Lot 3
(affectation V0 prématurée) a été corrigée et couverte par un test dédié avant
la validation finale. Les envois sont intégralement simulés.
La couverture comprend capacités vérifiées et sur demande, trois demandes
spéciales, données inconnues/indisponibles, absence d'inférence et de prix,
statuts du résumé, persistance/reload/Undo, transfert de composants interdit,
lecture publique minimale, contraintes SQL et RLS, notification simulée.
E2E dédiés : desktop 1440/1280, Pixel 5 et iPad Mini simulés Chromium ; vérification
du rechargement, de l'envoi simulé et de l'absence de débordement horizontal.
Les captures locales ont été examinées. Les parcours Lots 2–4 sont rejoués.

## À compléter côté métier

Capacités réelles par produit, noms de choix, preuves, quantités et modalités de
revue restent à fournir. Aucun matériau ne déclenche automatiquement des options.
La correspondance entre cerclage, chant et banding est volontairement un seul
kind `cerclage` à qualifier par les données vérifiées. Les délais et suppléments
éventuels seront établis dans un devis séparé. La validation des données réelles
n'est pas remplacée par ces fixtures.

PROD WRITE = NON · PROD MIGRATION = NON · DEPLOY = NON · MAIN MERGE = NON.

## Fichiers de la livraison

- `docs/RUNBOOK_STUDIO.md`
- `scripts/security/check-studio-access.mjs`
- `scripts/security/studio-write-probes.mjs`
- `src/components/ContactForm.tsx`
- `src/components/studio/ProjectSummary.test.tsx`
- `src/components/studio/ProjectSummary.tsx`
- `src/components/studio/TableProjectSummary.tsx`
- `src/hooks/useStudioProjectSummary.ts`
- `src/lib/contact.ts`
- `src/routeTree.gen.ts`
- `src/routes/api/-contact.test.ts`
- `src/stores/studio.store.test.ts`
- `src/stores/studio.store.ts`
- `tests/security/studio-access-script.test.ts`
- `docs/STUDIO_LOT_5_REVIEW.md`
- `src/components/studio/CustomizationEditor.test.tsx`
- `src/components/studio/CustomizationEditor.tsx`
- `src/components/studio/CustomizationSummary.tsx`
- `src/hooks/useStudioCustomization.ts`
- `src/lib/studio/customization-brief.ts`
- `src/lib/studio/customization-repository.test.ts`
- `src/lib/studio/customization-repository.ts`
- `src/lib/studio/customization.test.ts`
- `src/lib/studio/customization.ts`
- `src/routes/studio.personnalisation.tsx`
- `src/stores/studio-customization.test.ts`
- `supabase/migrations/20260911100000_studio_customization_capabilities.sql`
- `tests/e2e/studio-customization.config.ts`
- `tests/e2e/studio-customization.pw.ts`
- `tests/security/studio-customization-sql.test.ts`
