# Import du catalogue — mode d'emploi

Deux fichiers à remplir, puis renvoie-les moi : je génère une migration qui
insère tout d'un coup (produits + designs). Tu peux aussi tout saisir
manuellement dans **Admin → Catalogue → Ajouter un produit**.

## 1) `import-produits.csv` — un produit par ligne

| Colonne | Obligatoire | Détail |
|---|---|---|
| `sku` | ✅ | Référence unique (ex. `FAU-MAL-002`). Sert d'identifiant. |
| `nom` | ✅ | Nom commercial affiché. |
| `categorie` | ✅ | Une valeur parmi : `chair`, `armchair`, `table`, `bench`. |
| `description` | | Texte fiche produit. |
| `moq_units` | ✅ | Minimum de commande par design (ex. `50`). |
| `prix_ht` | ✅ | Prix groupé HT (€). |
| `prix_retail` | | Prix retail de référence (€) pour afficher l'économie. |
| `eco_contribution` | | Éco-participation par unité (€). |
| `longueur_cm` / `largeur_cm` / `hauteur_cm` | | Dimensions. |
| `cbm_unite` | ✅ | Volume en m³ par unité (ex. `0.35`). Sert au remplissage container. |
| `poids_kg` | | Poids unitaire. |
| `classement_feu` | | `M1`, `M2`, ou vide. |
| `image_principale` | | URL de la photo hero (ou vide → à ajouter ensuite dans l'admin). |
| `galerie` | | URLs séparées par `\|`. |
| `points_forts` | | Arguments séparés par `\|`. |
| `actif` | | `true` (visible) ou `false` (masqué). |
| `ordre` | | Ordre d'affichage (entier). |

## 2) `import-designs.csv` — un design (coloris/finition) par ligne

⚠️ **Un produit sans design est masqué au public.** Chaque produit doit avoir
au moins un design.

| Colonne | Obligatoire | Détail |
|---|---|---|
| `sku_produit` | ✅ | Doit correspondre au `sku` du produit. |
| `nom_design` | ✅ | Ex. « Corde naturelle / alu anthracite ». |
| `image_principale` | | Vignette du sélecteur de design. |
| `galerie` | | URLs séparées par `\|`. |
| `ordre` | | Ordre d'affichage. |

## Images

- Si tu as des **URLs**, mets-les directement.
- Si tu as des **fichiers**, laisse les colonnes image vides et ajoute-les
  ensuite produit par produit dans l'admin (l'éditeur a un uploader). Ou
  envoie-moi les fichiers et je les héberge.

Une fois rempli, renvoie les deux CSV (ou colle le contenu) — je m'occupe de
l'insertion.
