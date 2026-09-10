# Lot 5.1 — Atelier matières

Branche : `codex/studio-lot-5-1-visual-library`. Base : `5ac31b61cf201ce70721702745db9c530b269ab0`.

## Direction choisie

Le parcours Lot 5 sauvegardait correctement les demandes et protégeait le lead, mais présentait surtout des champs textuels. Trois approches ont été examinées : un nuancier compact (efficace mais peu contextualisé), un assistant linéaire (rassurant mais contraignant pour comparer), et un atelier avec planche projet. L’atelier a été retenu : le client explore librement, rapproche deux matières et rattache une intention à son mobilier, avec accompagnement humain explicite.

La direction associe écru `#f4f2eb`, encre verte `#23352e`, sauge `#e9ece2`, terracotta `#9a4e34`, surfaces mates et typographie existante. Les textures réelles portent la couleur. Les contours et espaces organisent le travail ; aucune mise en scène de luxe artificiel. Les styles restent limités à l’atelier afin de pouvoir valider cette direction avant de l’étendre.

## Expérience livrée

`/studio/personnalisation` propose trois familles, recherche par référence publique ou motif descriptif, pagination progressive par 12, zoom, comparaison de deux échantillons et sélection liée à une assise/variante. La planche conserve la photographie catalogue originale, clairement identifiée comme non modifiée. Sur mobile, elle est repliable et placée avant la galerie ; les options et quantités du Lot 5 sont disponibles dans un volet de détails. Un bouton permet de rejoindre directement le résumé.

Le tressage conserve séparément `weave_pattern` et `visual.weave_colors`. Les couleurs libres sont une demande à confirmer ; elles ne recolorent jamais la photo ou l’échantillon. Les choix sont sauvegardés dans le store v5 et repris dans le résumé/brief borné du formulaire existant. Aucune donnée de personnalisation n’est ajoutée aux URL ou aux événements analytiques. Les rôles plateau/piètement conservent leurs options Lot 5 ; une nouvelle famille pourra recevoir son propre éditeur sans modifier le stockage.

Les associations publiques sont contrôlées en plus des capabilities Lot 5. L’absence de rattachement, une ambiguïté ou une palette libre ne certifie rien. Une capability produit seule ne suffit pas. Même un choix vérifié ne conserve jamais `reservation_ready` sans la preuve de fulfillment qui manque encore au Lot 5.

## Sources et traitement

Les trois planches fournies ont produit **151 échantillons**, soit **302 fichiers WebP** (miniature + détail), environ **1,9 Mo** :

| Famille | Échantillons | Références publiques |
| --- | ---: | --- |
| PE / rattan | 35 | PI-TR-001 à PI-TR-035 |
| Cordons, sangles et tressages larges | 60 | PI-RP-001 à PI-RP-060 |
| Textilènes | 56 | PI-TX-001 à PI-TX-056 |

Ce sont 35 échantillons PE, pas une affirmation de 35 patrons géométriques distincts. Regrouper les variantes d’un même patron nécessitera une validation. Aucune permutation de couleurs n’a été créée.

`scripts/studio/build-visual-library.mjs` recadre les pixels sources suivant un manifeste explicite, sans légendes, sans recoloration, génération ou accentuation artificielle. Les détails gardent leur résolution de découpe ; les miniatures ont au plus 128 pixels. Sharp produit du WebP en sRGB sans EXIF/XMP/IPTC/ICC. Les trois planches de contrôle ont été inspectées visuellement. Certaines petites bandes sont peu définies : le zoom ne recrée aucun détail et un échantillon physique reste nécessaire pour juger la couleur/matière.

Le coffre **local et privé** `data/private/studio-visual-library/` contient les trois originaux, leurs empreintes SHA-256, les rectangles, le mapping usine et les ambiguïtés. Des codes répétés dans les planches textile/cordage restent des lignes séparées ; six vues de grands tressages sans code conservent une référence usine nulle. Les identités fournisseurs n’ont pas été inventées.

Ce coffre est exclu de Git et bloqué par `server.fs.deny` dans Vite. Il faut le sauvegarder dans un espace administratif privé avant de changer de poste : un clone Git contient les découpes publiques mais **ne peut pas reconstruire le mapping privé à lui seul**. Les références publiques sont attribuées une fois et conservées dans ce manifeste ; ne jamais les renuméroter pour changer un fournisseur.

Commande locale de reconstruction : `node scripts/studio/build-visual-library.mjs` (nécessite le coffre privé). Elle ne fait aucune requête réseau.

## Architecture publique et privée

Migration additive **46** : `20260911110000_studio_visual_library.sql`, sans seed commercial ni association. Migrations 42/43/44/45 inchangées. La migration 46 a été exécutée uniquement dans les tests PostgreSQL embarqués PGlite, pas dans Docker/Supabase ni en production.

| Surface | Rôle |
| --- | --- |
| `studio_visual_library` | Référence stable, famille extensible, médias locaux, activité, métadonnées de couleur |
| `studio_visual_sources` | Plusieurs sources privées par référence publique ; code usine, fournisseur, origine, notes |
| `studio_visual_associations` | Produit OU famille, référence visuelle, palettes publiques, statut, preuve et audit admin |
| `studio_visual_configurations` | Registre administratif préparé pour les dossiers complets ; aucune inscription automatique |
| `studio_visual_library_public` | Neuf colonnes publiques explicites, lignes actives uniquement |
| `studio_visual_associations_public` | Produit concret, référence publique, statut, palettes ; expansion des familles vérifiées seulement |

Les tables privées sont protégées par RLS admin. Les vues n’accordent que SELECT aux rôles publics. La publication d’une association non inconnue exige une provenance, un administrateur identifié et une date. Une famille candidate ne propage pas sa règle. Les palettes doivent référencer des éléments de famille `palette`, sans inférence depuis leur nom. Les conflits restent inconnus.

Le client utilise des projections explicites et des schémas Zod. Si les vues ne sont pas disponibles, `public/studio/materials/library.json` fournit seulement les inspirations relues et **zéro association**. Une base accessible mais vide est autoritaire : le snapshot ne la remplit pas. Publier le catalogue visuel en base restera une opération administrative distincte ; aucun import n’a été fait ici.

## Référence de composition et exploitation administrative

`PI-C-` suivi de 24 caractères hexadécimaux identifie un snapshot canonique des produits, variantes, quantités, tables et choix actifs. SHA-256 tronqué à 96 bits ; même snapshot, même référence. Ce n’est ni une signature, ni une approbation commerciale. Le dossier JSON téléchargeable contient le snapshot public complet ; les codes privés n’y figurent pas.

Pour retrouver les codes sans rouvrir les planches :

```sh
node scripts/studio/resolve-visual-configuration.mjs /chemin/PI-C-dossier.json
```

Le résolveur local vérifie la référence et joint le coffre privé. Sa sortie est réservée à l’administration, avec `NOT_APPROVED` explicite. Les codes ambigus ou absents restent à vérifier. Il ne fait ni requête réseau ni écriture DB. Le dossier complet conserve également les couleurs structure et autres options ; la sortie du résolveur met en avant les correspondances visuelles.

**Limite opérationnelle :** la référence seule ne permet pas encore une recherche inter-appareils. Le registre SQL est prêt, mais sa capture serveur et l’écran de recherche admin ne sont pas raccordés. Le client doit garder/transmettre le dossier pour cette étape. Le brief de lead reste volontairement borné et ne remplace pas le dossier pour un projet exceptionnellement volumineux. Aucun système de commande fournisseur n’est déclaré prêt.

## Suite et future homepage

Avant DATA READY : sauvegarder le coffre, confirmer les codes ambigus, identifier les fournisseurs, valider les regroupements de patrons, renseigner les capacités couleur et les associations produit/design/palette. Aucune de ces preuves ne découle de la photographie.

V2 aperçu : modèles de masques par produit/variante, zones matière, échelle et orientation validées, palette mesurée et version de moteur. Stocker séparément l’image catalogue réelle et le rendu, avec type `simulation`, version et avertissement non contractuel toujours visible. Un rendu ne modifie jamais la compatibilité ni les engagements de stock/prix/délai. Aucun rendu généré n’est livré dans ce lot.

La future homepage peut reprendre l’écru/vert et les textures réelles, une promesse centrée sur le mobilier adapté au projet, un parcours « mobilier → matières → projet accompagné », puis les preuves industrielles : échantillons, contrôle, sourcing et livraison. La logistique soutient la promesse ; elle n’est plus le point d’entrée principal. Le redesign global reste hors périmètre.

## Validation

Résultats finaux consignés ci-dessous après exécution. Les E2E utilisent des produits synthétiques et des API interceptées, sans lead réel ni donnée commerciale créée. Les screenshots prouvent le comportement responsive, pas la compatibilité des produits de production.

DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.

| Vérification | Résultat |
| --- | --- |
| Tests ciblés visual library / repository / SQL / customization / parité sécurité | **41 réussis**, 5 fichiers |
| `bun run check` (TypeScript + ESLint + Vitest) | **1057 réussis, 8 ignorés**, 155 fichiers réussis, 2 ignorés |
| `bun run test:security` | **274 réussis**, 33 fichiers |
| `bun run build` | Réussi ; budget respecté, aucune fuite de marqueur interne dans **216 chunks client** |
| E2E Lot 5.1 | **4 réussis** : 1440, 1280, Pixel 5, iPad Mini |
| E2E Lot 5 | **4 réussis** |
| E2E Lot 4 | **12 réussis** |
| E2E Lot 3 | **10 réussis** |
| E2E Lot 2 | **10 réussis** |
| Résolveur privé sur dossier exporté E2E | Référence vérifiée, mapping retrouvé, `NOT_APPROVED` |

Total E2E : **40 réussis**. Les tests ciblés/sécurité sont également inclus dans `check` ; ces chiffres ne doivent pas être additionnés comme des tests distincts. Les huit tests ignorés préexistants ne sont pas déclarés réussis.

Les contrôles couvrent notamment les colonnes publiques exactes, RLS/ACL, refus d’écritures acheteur/anonyme, absence de métadonnées privées dans les 302 WebP, repli sans association, conflit, palette non prouvée, référence stable, zoom/focus Escape, comparaison côte à côte mobile, reload, absence de débordement horizontal, coffre non servi par Vite et lead intercepté. Le script de sondes `security:studio` a été étendu, mais **n’a pas été exécuté contre un serveur distant**.

Captures locales, issues du scénario E2E synthétique : `/tmp/studio-lot51-{1440,1280,Pixel5,iPadMini}-{viewport,atelier,compare,summary}.png`. `viewport` montre l’écran initial, `atelier` et `summary` la page complète. Les originaux ne sont pas incorporés à ces captures.

### Fichiers

- Atelier : `src/components/studio/MaterialAtelier.tsx`, `src/routes/studio.personnalisation.tsx`.
- Contrats / lecture / référence : `src/lib/studio/visual-library.ts`, `visual-library-repository.ts`, `visual-configuration.ts`, `customization.ts`, `repository.ts`.
- Hooks : `src/hooks/useStudioVisualLibrary.ts`, `useStudioProjectSummary.ts`.
- Assets publics : `public/studio/materials/library.json` et 302 WebP.
- Outils privés locaux : `scripts/studio/build-visual-library.mjs`, `resolve-visual-configuration.mjs`.
- SQL : uniquement la nouvelle migration `20260911110000_studio_visual_library.sql`.
- Protection / sondes : `.gitignore`, `vite.config.ts`, `scripts/security/check-studio-access.mjs`, `studio-write-probes.mjs`.
- Tests : `src/lib/studio/visual-library.test.ts`, `visual-library-repository.test.ts`, `tests/security/studio-visual-library-sql.test.ts`, `studio-access-script.test.ts`, `tests/e2e/studio-visual-library.config.ts`, `studio-visual-library.pw.ts`.
- Documentation : ce rapport et `docs/RUNBOOK_STUDIO.md`.

## Revue corrective de 73c2452

- Pour une sélection visuelle, la capability contrôle le type, son statut, les quantités et la revue nécessaire. L’association contrôle la référence exacte ; `capability.values` n’a plus à recopier cette référence. Les sélections classiques conservent leur contrôle de valeurs. Une capability vérifiée avec `values=[]` et une association vérifiée peut atteindre `auto_quote_ready`, jamais certifier un fulfillment. Absence, ambiguïté ou palette libre restent inconnues.
- La saisie de palette est identifiée par le couple cible/public_ref. Changer de mobilier ou de motif écarte la saisie non enregistrée et restitue seulement la palette sauvegardée de la sélection active. Resélectionner le même motif ne détruit pas sa palette.
- Le mapping éditeur est explicite : weave, rope, textilene. Une famille future reste valide dans la bibliothèque mais ne peut pas devenir implicitement textilène dans cet éditeur.

Validation corrective : **43 tests ciblés réussis**, `check` **1059 réussis / 8 ignorés**, sécurité **274 réussis**, build et scan des **216 chunks client** OK. E2E : Lot 5.1 **4**, Lot 5 **4**, Lot 4 **12**, Lot 3 **10**, Lot 2 **10**, soit **40 réussis**. Le scénario visuel couvre deux assises, palette sauvegardée et non sauvegardée, retour à l’assise précédente et changement de motif. Les tests moteur évaluent **250 références** sans aucune valeur dans la capability et conservent les contrôles de quantité/statut/revue.

Aucun champ/code usine ou fournisseur dans le JSON public ; le coffre est toujours ignoré par Git et les accès Vite aux sources/manifeste sont refusés dans les quatre viewports E2E. Aucune migration modifiée ou appliquée pendant cette correction.

DATA READY = NON. PROD WRITE = NON. PROD MIGRATION = NON. DEPLOY = NON. MAIN MERGE = NON.
