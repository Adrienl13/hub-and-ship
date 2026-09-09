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
liste catalogue `compatibleTopShapes` explicite non vide, puis confirmation.
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

## Décisions métier encore nécessaires

- Standards 50–80 : représentables, mais `rectangular` couvre actuellement carrés
  ET rectangles. Une règle « carré uniquement » ne doit pas être saisie comme
  une autorisation de tous les rectangles. La distinction nécessite une décision
  catalogue et éventuellement une migration séparée ; aucune forme n'est changée.
- ESTEREL : une règle de forme rectangulaire sans borne est représentable. Il
  reste à valider explicitement sa portée avant de saisir une règle autorisant
  cette forme, sans inventer de limites.
- CAMARGUE : minimum 80 sans maximum représentable ; formes et côté/diamètre
  auquel s'applique le minimum restent à préciser.
- MARAIS : maximum 70 sans minimum représentable ; formes et portée restent à
  préciser. « Mange-debout » n'est pas une contrainte de hauteur ajoutée par ce
  patch et nécessite une validation métier distincte.
- Les rattachements aux types ou exceptions exactes doivent être vérifiés avec
  les identifiants catalogue. Aucune règle commerciale n'est créée ici.

La validation réelle des 10 piètements et 8 plateaux reste un chantier distinct.
Les fixtures de tests sont synthétiques et ne sont jamais des seeds catalogue.
