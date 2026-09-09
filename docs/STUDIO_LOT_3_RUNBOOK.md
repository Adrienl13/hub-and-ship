# Studio Lot 3 — exploitation et validation

Checkout : `/Users/adrien/hub-and-ship`, branche `codex/studio-lot-3`, départ `2ee0174a2a33bd40b323b3b9d6f8817deaaa3e5e`.

Statut : **CODE READY**, **DATA READY non établi**, jamais PRODUCTION VERIFIED. La migration 41 `20260908090000_studio_visual_intelligence.sql` est **NON APPLIQUÉE EN PRODUCTION**. Aucun déploiement, secret, flag ou donnée de production modifié. Les migrations 39/40 et le hotfix preview restent inchangés.

Revue corrective : branche `codex/studio-lot-3-review`, base `112eff81f1f04cd15dd742c146afdc99fba4c2b0`. Voir [le compte rendu de revue](STUDIO_LOT_3_REVIEW.md) pour les corrections et validations locales les plus récentes. Le statut DATA/production ci-dessus reste inchangé.

## Audit et décisions

- La migration 40 impose `source = manual | pipeline`. Le plan historique proposait `pipeline:vX` : le code conserve le contrat réel et ajoute `pipeline_version` aux paires.
- Les deux adaptateurs existants, canvas et sharp, partagent désormais les primitives de mesure et de cadrage. Le mode catalogue reste disponible ; le mode Decision écrit dans un dossier séparé, sous `studio/`.
- `studio_product_profiles.visual_traits` était projeté sans filtre JSON. La nouvelle migration borne les traits numériques publics et masque les métadonnées, couleurs et notes internes. Les traits publics doivent correspondre au hash/version d’une Decision Image validée.
- Les familles candidates sont des paires à comparer. L’acceptation admin crée une famille vérifiée et rattache les deux profils atomiquement, avec verrouillage. Une famille déjà rattachée exige une revue manuelle ; aucune fusion implicite.
- Le store devient v3 pour épingler la version de session. Les projets, découvertes et snapshots Undo v2 sont conservés et attribués à V0. Il ne s’agit pas d’une réinitialisation des projets.
- Le plan historique vise 90 % de couverture et un pilote de 30–50 assises : ces critères **DATA READY** attendent le traitement du catalogue réel. Les fixtures ne les valident pas.

## Architecture et surfaces

`Sources locales → normaliseur existant → WebP + manifeste pending → upload admin → import SQL revu → validation humaine → export admin → DINOv2 local → features/voisins/candidats/pilote → import SQL revu → preview V1`.

Six tables internes, RLS admin, aucun SELECT anon :

- `studio_product_media` : images, qualité technique, origine/hash, validation.
- `studio_product_visual_features` : embeddings 384D bornés, source et modèle.
- `studio_product_neighbors` : graphe k≤12, sans auto-voisin, rang unique par produit/modèle.
- `studio_model_family_candidates` : propositions et revue humaine.
- `studio_algorithm_versions` : V0 actif par défaut, V1 preview, désactivation possible.
- `studio_visual_jobs` : demandes de relance et erreurs du traitement hors ligne.

Vues publiques à colonnes explicites :

| Vue                                | Colonnes                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `studio_product_media_public`      | product_id, role, url                                            |
| `studio_product_neighbors_public`  | product_id, neighbor_product_id, rank, similarity, model_version |
| `studio_algorithm_versions_public` | version, engine, model_version, status                           |

Les médias doivent être validés, les deux extrémités d’un voisin actives et leur image source encore validée **et courante**. Une nouvelle image validée invalide la publication des anciens voisins jusqu’au recalcul. Rejeter une image masque aussi ses voisins. Aucune identité admin, embedding, coût, note ou candidature dans ces vues. Le lecteur pagine par 500 lignes et demande seulement le modèle V1 connu.

Les objets utilisent le bucket public existant `catalogue-images`, avec écritures admin seulement. Une URL d’objet déjà connue reste lisible indépendamment du statut de validation : la validation contrôle son utilisation dans le Studio, pas la confidentialité du fichier Storage. Aucun bucket ni droit Storage n’a été modifié.

## Decision Images

Préparer un manifeste local :

```json
{
  "products": [
    {
      "product_id": "ID_BASE",
      "path": "/chemin/source.png",
      "source_url": "https://origine/source.png"
    }
  ]
}
```

```sh
# Calcul et rapport uniquement : aucune écriture, même locale.
node scripts/normalize-packshots.mjs --role decision --manifest /tmp/sources.json

# Écriture LOCALE explicite, jamais de connexion Supabase.
node scripts/normalize-packshots.mjs --role decision --manifest /tmp/sources.json \
  --output .cache/studio-decision --write
```

Sortie : 1200×1200 et 600×600, WebP q85, marge cible 7 %, fond blanc et proportions conservées à l’arrondi pixel près. Préfixe `studio/decision-v1/<product_id>/<sha256_source>/`. Trim conservateur, canevas et redimensionnement seulement ; aucune retouche locale, génération ou correction du produit. `main_image_url` n’est jamais écrit. Un fond non neutre est refusé, avec erreur par produit.

Qualité technique 0–1 : 30 % fond blanc aux coins, 20 % centrage, 20 % couverture du cadre relativement à 86 %, 30 % variation locale comme proxy de netteté. La marge est également mesurée. Le score n’est pas une appréciation esthétique et n’est pas affiché au client.

Traits calculés sur grille 128×128 : ratio de silhouette, densité de contours, contraste, cinq couleurs quantifiées dominantes, vide apparent et variation locale (`pattern_score`). Les deux derniers sont des **proxies**, pas des affirmations sur une structure ou un tressage. Version, date, provenance et hash source sont conservés. Le CLI sharp est l’adaptateur canonique pour les batches ; le canvas utilise les mêmes règles mais l’encodeur WebP du navigateur peut produire des octets différents. Une même source dans le même environnement CLI produit les mêmes fichiers. Aucun retraitement de la source n’est effectué en place.

Inspecter impérativement les parties fines, produits blancs et ombres avant validation. La détection du fond ne prouve pas qu’un packshot ambigu est exploitable.

Après autorisation distincte d’une opération sur une base cible : uploader les deux fichiers avec les chemins exacts du manifeste, puis préparer l’artefact SQL local :

```sh
python3 pipeline/studio/prepare-import.py --kind decision \
  --report .cache/studio-decision/decision-manifest.json \
  --storage-base https://PROJET.supabase.co/storage/v1/object/public/catalogue-images \
  --output /tmp/studio-decision-review.sql
```

Ce script **n’exécute jamais** le SQL et n’accepte aucun credential. L’import ajoute des médias `pending` sans réinitialiser une revue précédente. Les traits restent non publics avant validation. L’admin `/admin?tab=studio` montre source et résultat, score, validation/rejet de l’image et de sa vignette, et relance hors ligne.

## Embeddings, reprise et import

Modèle : [facebook/dinov2-small](https://huggingface.co/facebook/dinov2-small), Apache-2.0, environ 22,1 M paramètres. Révision pinée `ed25f3a31f01632728cabb09d1542f84ab7b0056`, vecteur CLS L2 normalisé, 384 dimensions. [Documentation Transformers](https://huggingface.co/docs/transformers/model_doc/dinov2).

`model_version = dinov2-small:ed25f3a31f01632728cabb09d1542f84ab7b0056:cls-l2-v1`.

Choix : modèle d’image local de taille raisonnable, sans API payante. CPU, un thread, seed 0, opérations déterministes, modèle en eval, image carrée complète sans center crop. Aucun modèle ML dans le navigateur ou le Worker. Le premier calcul télécharge les poids publics ; les suivants utilisent le cache local. Prévoir un Python avec OpenSSL actuel ; le Python système Apple/LibreSSL a émis un avertissement urllib3 durant le test, sans empêcher le calcul.

```sh
python3 -m venv .cache/studio-python
.cache/studio-python/bin/pip install -r pipeline/studio/requirements.txt

# Exporter le manifeste depuis l’onglet admin : données réelles et images validées.
.cache/studio-python/bin/python pipeline/studio/pipeline.py --manifest /tmp/studio-offline-manifest.json
.cache/studio-python/bin/python pipeline/studio/pipeline.py --manifest /tmp/studio-offline-manifest.json \
  --output .cache/studio-visual --compute
```

Par défaut dry-run sans calcul ni écriture. `--compute` écrit uniquement des artefacts locaux ; `--dry-run` l’emporte si les deux sont présents. Le cache est indexé par hash de l’image + modèle/version. Une erreur de produit n’arrête pas le batch. `visual-report.json` contient couverture, erreurs, features internes, voisins, familles candidates, paires candidates et curation draft. Ne jamais publier ce rapport dans le site ou le dépôt.

Le manifeste utilise `is_active`, `media_status`, `media_id`, `media_url` (ou `local_path`), `discovery_ready`, `quality_score`, `material`, `seat_kind`, `visual_traits`, et, si disponibles, `dimensions.{l,w,h}`, `weightKg`, `basePriceHt`, `sku`. L’export admin réutilise exactement la qualification discovery du Studio. Aucun nom de produit n’est un signal.

```sh
.cache/studio-python/bin/python pipeline/studio/prepare-import.py --kind visual \
  --report .cache/studio-visual/visual-report.json \
  --include-pilot-draft --output /tmp/studio-visual-review.sql
```

L’artefact SQL remplace transactionnellement le graphe de **ce modèle**, upsert les features, rafraîchit les candidats non revus sans écraser une décision humaine et, seulement sur demande, prépare `pilot` en **draft**. Il refuse un batch vide, des features d’un autre modèle ou un rapport contenant des erreurs : les résoudre, puis revoir la couverture avant import. Utiliser un batch complet de la base cible, pas un sous-ensemble accidentel qui supprimerait les voisins absents du rapport. Un artefact généré ne constitue pas une autorisation d’exécution en production.

Règles de rafraîchissement (transaction + verrouillage des trois tables pour sérialiser avec les revues humaines) :

- Familles candidates : mise à jour de `similarity/evidence` uniquement si `candidate`, sans reviewer/date/famille rattachée. Nettoyage des anciens candidats absents du rapport lorsque **les deux produits** appartiennent au batch. Une décision accepted/rejected ou une trace de revue bloque aussi la reproposition du même couple sous un nouveau modèle.
- Paires : conflit sur le couple canonique + axe ; seuls `notes/pipeline_version` des candidates `source=pipeline`, sans vérificateur, sont recalculés. Les candidates pipeline disparues sont retirées dans le même périmètre. Les paires verified/rejected et les paires manuelles restent intactes.
- `pilot` : sur demande explicite `--include-pilot-draft`, seuls `product_ids/criteria` du draft sont régénérés ; label, notes et auteur conservés. Active/archived ne changent jamais.
- Un second import est idempotent pour le contenu objectif et les décisions ; les timestamps techniques de rafraîchissement peuvent évoluer. Les autres produits sont conservés pour les candidats ; le graphe du modèle reste un snapshot complet, d’où l’exigence de batch complet ci-dessus.


Les relances admin créent une demande `pending`. L’opérateur relance le normaliseur ou le calcul, réimporte les résultats revus et clôture manuellement les demandes dans `studio_visual_jobs` (`done` ou `error`). Aucun daemon ni cron n’est installé.

## Voisins, familles, paires et pilote

- Voisins : cosinus réel des embeddings, borné à [0,1] ; k=12 au maximum, actifs seulement, ordre décroissant puis ID stable. Une similarité n’est jamais une preuve de modèle commercial identique.
- Familles candidates : similarité ≥0,94 **et** trois dimensions à ±2 %, plus poids à ±5 % **ou** préfixe SKU identique corroboré par prix public à ±10 %. Le nom n’est jamais lu. Le prix est autorisé ici comme corroboration commerciale interne, jamais dans le score de goût. L’acceptation humaine exige un libellé et deux profils actifs sans famille existante.
- Paires : différence mesurée ≥0,25 sur un trait objectif disponible entre voisins. Source `pipeline`, version séparée, statut `candidate`. Vérification humaine avant publication. L’interface V1 ne propose une comparaison que si une paire **vérifiée** relie deux finalistes présents ; elle permet de consulter les détails ou d’ignorer. Aucun duel inventé ni préférence supposée.
- Pilote : actifs/discovery_ready, image validée, qualité ≥0,45, diversité matière/sous-type/bins de traits, exclusion des quasi-doublons de similarité ≥0,97. Sélection gloutonne déterministe, cible 40, plafond 50 ; pas de remplissage artificiel si données insuffisantes.

```sh
.cache/studio-python/bin/python pipeline/studio/build-pilot-curation.py \
  --manifest /tmp/studio-offline-manifest.json \
  --neighbors .cache/studio-visual/visual-report.json --count 40 > /tmp/pilot-review.json
```

Le rapport donne candidats, raisons, exclusions, couverture et diversité. Toujours dry-run. Le passage du jeu draft à active est une action humaine ultérieure. `?set=pilot` reste exclusivement preview.

## V1, convergence et attribution

Ouvrir une **nouvelle session navigateur privée**, obtenir la preview par le mécanisme existant, puis `/studio/assises?engine=v1`. `engine=v0` conserve V0, `engine=compare` attribue V0/V1 par hash déterministe de session. Hors preview ces paramètres n’activent jamais V1. Une session déjà commencée garde sa version même si l’URL change ; le changement d’URL n’est pas un reset de projet.

`studio_algorithm_versions` doit publier la version/model_version reconnue avec statut preview ou active. V0 reste le défaut. Sans migration, sans voisins ou avec couverture <50 %, repli V0 sans disparition des produits. L’exploration prend ses candidats parmi **tous** les produits restants, même sans voisins. La session garde l’attribution V1 lors d’un repli, ce qui permet de mesurer l’expérience assignée.

`resolveStudioEngine` distingue `v1Assigned` de `v1Operational`. La couverture est celle du graphe reconnu **dans le pool effectivement exploré** (y compris `?set=pilot`), calculée avec la même règle que V1. V1 opérationnel exige une preview autorisée, `v1.0` publiée pour `engine=v1`, le modèle exact et au moins 50 % de couverture. Sinon **toutes** les nouvelles décisions comportementales utilisent V0 : cartes, sélection et substitution des finalistes ; aucun prompt de convergence ni duel V1. Les sélections déjà enregistrées restent conservées. L’interface expose le moteur réellement utilisé via `data-studio-engine`, sans texte technique pour le client. `algorithmVersion=v1.0` reste immuable pour l’attribution des événements. L’API n’accepte que `v0.1` et `v1.0` ; `v42.7` est refusé avant écriture. Aucune FK ajoutée aux sessions historiques.

`V1_POLICY` dans `engine/v1.ts` centralise les paramètres :

| Paramètre                                         | Valeur                                                    |
| ------------------------------------------------- | --------------------------------------------------------- |
| Couverture minimale                               | 0,50                                                      |
| Similarité minimale pour affinité                 | 0,55                                                      |
| Seuil de regroupement des likes                   | 0,78                                                      |
| Directions maximum                                | 3                                                         |
| Exploration déterministe                          | 0,20                                                      |
| Poids du rejet                                    | 1,10                                                      |
| Pénalité de répétition sur les 5 dernières cartes | 0,35                                                      |
| Signaux informatifs / likes minimaux              | 4 / 2 références distinctes                               |
| Stabilité                                         | recouvrement minimal 2/3 du top 3 aux 3 états précédents  |
| Séparation                                        | moyenne d’affinité top 3 − moyenne du reste ≥0,08         |
| Cohérence                                         | similarité moyenne des groupes de ≥2 likes ≥0,70          |
| Nouveauté restante maximale                       | 0,55 sur les 5 prochaines cartes classées                 |
| Exploration conséquente pour stalled              | 14 observations avec <25 % de signal ou couverture faible |
| Ambiguïté persistante pour stalled                | ≥20 observations et cohérence ou séparation insuffisante  |

Affinité : meilleure moyenne par direction des proximités dépassant 0,55, moins le plus fort signal négatif pondéré ; les goûts distincts ne sont pas moyennés ensemble. Le score de découverte retranche ensuite la proximité aux dernières cartes. Aucun prix, stock, dimension ou autre fait commercial dans ce classement. Passer est neutre ; la dernière décision par produit détermine son signal.

`ready` exige **toutes** les conditions de quantité, stabilité, séparation, cohérence, couverture et faible nouveauté restante. `stalled` exprime une incertitude persistante ; sinon `insufficient_signal`. Aucun arrêt à un nombre fixe de cartes. Undo recalcule l’ensemble depuis l’historique.

Le prompt est facultatif, ne remplace pas la carte et ne force aucune transition. « Continuer à explorer » le masque pour quatre nouvelles observations avant réévaluation, ce délai étant seulement un garde-fou UX, pas un critère de convergence. Sans aucun favori, aucune fausse recommandation : invitation prudente à continuer/revoir. Les finalistes viennent des favoris, maximum trois ; une troisième place exige une affinité positive. « Voir plus » reste explicite.

Les cinq nouveaux événements utilisent l’API existante et son payload strict borné : `convergence_ready`, `convergence_stalled`, `convergence_prompt_viewed`, `convergence_accepted`, `exploration_continued`. Aucun profil marketing ni pourcentage de compatibilité. Un trigger SQL interdit la modification de l’algorithm_version d’une session existante.

## Désactivation et rollback

Une opération humaine autorisée peut mettre `studio_algorithm_versions.status = disabled` pour V1. Au prochain chargement du catalogue, la preview utilise le repli V0 sans supprimer les médias ou features ; les sessions restent attribuées à leur version initiale. Le cache navigateur est celui de la page : recharger pour prendre en compte la désactivation. Pour une comparaison V0 propre, commencer une nouvelle session preview `engine=v0`.

Aucune activation publique n’est implémentée, `VITE_STUDIO_ENABLED` reste OFF en production. Ne pas supprimer les tables pour rollback : retirer la disponibilité V1 suffit. Aucun impact sur checkout, réservation, devis, Stripe ou Supabase Auth.

## Vérification locale et limites

Commandes :

```sh
bunx vitest run src/lib/studio src/stores/studio.store.test.ts tests/unit/studio-decision-images.test.ts tests/security
.cache/studio-python/bin/python -m unittest discover -s pipeline/studio -p 'test_*.py'
bun run check
bun run test:security
bun run build
bunx playwright test -c tests/e2e/studio-v1.config.ts
bunx playwright test -c tests/e2e/studio-lot2.config.ts
```

Les tests SQL PGlite exécutent les DDL et droits des trois tables internes de la migration 39, la migration 40 puis la migration 41, sur un socle minimal produits/auth local, avec rôles anon/buyer/admin. Ce n’est pas une validation du déploiement complet Supabase. Les intégrations réseau sont ignorées sans variables de test. `security:studio` envoie désormais des payloads construits avec des produits publics et exige SQLSTATE `42501` : HTTP 400, erreur de contrainte ou JWT invalide ne prouvent plus un refus d’écriture. Exécuter ses sondes uniquement sur une base de TEST : une cible vulnérable pourrait insérer la ligne. Aucune exécution distante pendant cette revue.

Limites distantes explicites (`SKIP WRITE`, jamais comptées comme réussite) : `studio_events` nécessite une session privée ; `studio_product_visual_features` nécessite un ID média interne lié au produit ; `studio_product_neighbors` nécessite deux features du même modèle. Sans ces fixtures, le script vérifie les lectures/restreints publics ; la preuve INSERT valide + refus anon/buyer est exécutée dans PostgreSQL local pour les 13 tables. Un même payload réussit comme admin (ou propriétaire pour sessions/events réservés au serveur), puis échoue avec `42501` pour anon/buyer. Les relations privées sont ainsi réellement présentes au test ; aucune règle n’est assouplie.

Essai réel du modèle sur 13 fixtures géométriques locales, sans références commerciales : 13/13 embeddings, 13/13 avec 12 voisins, zéro erreur. Curation de ces fixtures : 2 représentants et 11 quasi-doublons exclus ; ce n’est **pas** un pilote commercial. Répéter une même image a produit le même vecteur de 384 valeurs. Sur une paire différente du smoke test, cosinus 0,69961 contre 1,0 pour l’image identique. Ces mesures vérifient le calcul, pas la qualité de recommandation réelle.

Poids mesuré des modules moteur, compilation minifiée identique : V0 4040 octets / 1790 gzip ; V0+V1+convergence 9965 / 3755, soit **+5925 octets / +1965 gzip**. C’est une mesure différentielle des modules, pas une comparaison de deux builds Vite historiques. Le build Vite conserve `studio.assises` en chunk lazy (60,88 kB brut / 16,42 kB gzip), le lecteur visuel séparé (1,69 / 0,84 kB) et l’admin séparé (8,01 / 2,88 kB). Budgets existants et recherche de fuites contrôlés au build.

Seuils V1 non calibrés sur des utilisateurs réels : les fixtures testent notamment la convergence sur 80 références, les deux directions, le manque de signal, les passes, la continuation et Undo. La calibration et la revue des packshots réels restent obligatoires avant DATA READY.

## Revue adversariale

Contrôles et corrections effectués :

- Métadonnées de traits masquées ; nouveaux médias pending non utilisés ; anciens voisins masqués lors du changement d’image source.
- RLS et colonnes publiques testées localement ; familles créées verified uniquement par action admin, deux profils verrouillés, aucune famille déduite d’un nom.
- Import SQL réellement exécuté et rejoué en base locale ; UUID des paires, tableau PostgreSQL de curation, source historique et statut draft vérifiés.
- Session V2 conservée, version épinglée, Undo exact, répétition d’un like incapable de créer du signal distinct.
- Pagination des voisins au-delà de 1000 ; valeurs non finies exclues ; produits sans données toujours découvrables.
- Prix absent du goût, aucune altération des faits commerciaux, maximum trois finalistes, prompt non contraignant et langage prudent.
- Aucun ML dans le runtime ; aucune écriture distante dans les outils du pipeline offline ; aucun secret de production dans les E2E.

Actions humaines restantes : autoriser puis appliquer la migration sur la cible choisie ; préparer/uploader et valider les Decision Images réelles ; calculer et revoir le batch complet ; importer les artefacts ; vérifier familles/paires ; valider puis activer éventuellement le pilote ; calibrer V1 en preview. Le déploiement et toute écriture production nécessitent une instruction distincte.


## Résultats finaux du 8 septembre 2026

| Contrôle | Résultat |
| --- | --- |
| Tests ciblés Studio / images / admin / SQL / sécurité | 407 réussis, 47 fichiers |
| `bun run check` | TypeScript et lint OK ; 885 réussis, 8 intégrations ignorées faute de configuration |
| `bun run test:security` | 220 réussis, 28 fichiers |
| PostgreSQL local (inclus ci-dessus) | 14 réussis, dont import/reprise et retrait des voisins obsolètes |
| Pipeline Python | 8 réussis |
| E2E preview privée et V1 | 8 réussis, desktop et mobile |
| E2E régression Lot 2 | 10 réussis, desktop et mobile |
| Build | OK, budget existant respecté, aucun marqueur interne détecté dans 210 chunks client |

Les nombres de tests ciblés/sécurité/SQL sont des sous-ensembles du check : ne pas les additionner comme tests distincts. Aucun test réseau n’a écrit en production.
