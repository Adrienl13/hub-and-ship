# Lot 4 — plages dimensionnelles vérifiées

Migration additive 43 : `20260910100000_studio_table_dimension_ranges.sql`.
Migration 42 inchangée. MIGRATION 42 PROD = NON APPLIQUÉE.
MIGRATION 43 PROD = NON APPLIQUÉE. DATA READY = NON.

Les quatre bornes `min_length_cm`, `min_width_cm`, `max_length_cm`,
`max_width_cm` sont facultatives indépendamment. Une valeur renseignée doit être
strictement positive et inférieure à 10 000 cm. Les limites sont inclusives.
Une borne NULL n'ajoute aucune limite ; elle ne constitue pas une mesure connue.
Une règle sans aucune borne représente un verdict de forme explicitement vérifié
par un humain, sans inventer de plage dimensionnelle.

Le plateau est normalisé grand côté / petit côté. Lorsque les deux minima (ou
les deux maxima) sont connus, cette paire de bornes est normalisée de même.
Lorsqu'une seule borne est connue, longueur porte sur le grand côté et largeur
sur le petit côté. Pour un rond, les deux bornes d'un même extrême, si présentes,
doivent être égales. SQL et le schéma client refusent aussi les plages sans
solution, y compris un minimum de petit côté supérieur au maximum de grand côté.

La hiérarchie reste : exception exacte vérifiée, règle vérifiée type + forme,
puis confirmation. Depuis le patch de forme effective (migration 44), aucune
liste `compatibleTopShapes` ne remplace une règle Studio vérifiée.
Sous un minimum vérifié : `denied / minimum_dimensions_not_reached` ; au-dessus
d'un maximum : `denied / maximum_dimensions_exceeded`. Dans la plage : verdict
explicite de la règle. Données absentes ou incohérentes et conflits restent non
confirmés. Aucune déduction à partir du nom, SKU, prix ou image.

La vue publique ajoute uniquement les deux minima après les colonnes existantes.
Les politiques RLS, le contrôle admin et l'audit serveur restent ceux de la
migration 42. Provenance, auteur, date de vérification et coûts ne sont pas
exposés. Le repository utilise la constante des colonnes publiques et le schéma
mis à jour ; une DB sans migration 43 échoue de manière conservatrice (lecture
indisponible). Appliquer 43 avant d'utiliser ce code dans un environnement cible.
Ce chantier n'applique aucune migration en production.

## Formes effectives — migration additive 44

`20260910110000_studio_effective_table_shape.sql` ajoute `square` aux règles
Studio, sans toucher aux migrations 42/43 ni aux produits. MIGRATION 44 PROD =
NON APPLIQUÉE. La migration 43 est appliquée uniquement en local (contexte validé).

`effectiveTableShape(product)` examine seulement la forme et les dimensions :
`round` reste rond ; `rectangular` avec longueur strictement égale à largeur
est `square`, sinon `rectangular`. Aucune tolérance implicite ni mutation du
catalogue. Dimensions absentes, nulles, négatives ou non finies : confirmation,
sauf exception exacte vérifiée prioritaire. Une forme non couverte reste non
confirmée même si une liste catalogue explicite existe.

Les trois choix admin sont Carré, Rectangle et Rond. Les règles existantes
`rectangular` couvrent désormais seulement les rectangles effectifs dans Studio,
pas les carrés. Aucune règle n'est convertie automatiquement. Le contexte de ce
patch indique zéro règle enregistrée ; aucun rattachement ni règle n'est créé.
Les projections publiques, leur accès et les informations privées sont inchangés.
Les bornes d'une règle square doivent permettre au moins une dimension égale
sur les deux côtés ; SQL refuse les contraintes contradictoires.

Les exemples propriétaire sont représentables par type + forme :

| Type     | Carré             | Rond              | Rectangle          |
| -------- | ----------------- | ----------------- | ------------------ |
| Standard | allowed 50–80     | allowed 50–80     | denied sans borne  |
| ESTEREL  | denied sans borne | denied sans borne | allowed sans borne |
| CAMARGUE | allowed min 80    | allowed min 80    | denied sans borne  |
| MARAIS   | allowed max 70    | allowed max 70    | denied sans borne  |

La préférence commerciale pour les ronds CAMARGUE ne participe pas au verdict.
Le caractère mange-debout ne crée aucune nouvelle contrainte de hauteur.
Ces exemples sont exclusivement des fixtures synthétiques de tests, jamais des
seeds ou une matrice catalogue. Les futurs plateaux sont évalués automatiquement
par leur forme effective et leurs dimensions, une fois le type du piètement et
ses règles vérifiés. Seules les exceptions nécessitent un couple exact.

DATA READY = NON. La validation des 10 piètements / 8 plateaux, des identifiants,
des rattachements et l'enregistrement réel des règles restent une étape séparée.
