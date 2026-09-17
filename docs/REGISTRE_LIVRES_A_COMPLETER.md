# Registre `/livres` — ce qu'il reste à saisir

Les quatre containers publiés sont de vraies livraisons, mais trois d'entre
eux portent encore des visuels et des compteurs d'exemple. Cette fiche liste,
container par container, **ce qu'il faut remplacer** pour que le contrôle de
publication passe au vert.

Où : espace admin → onglet **Containers** → « Éditer ». Le contrôle s'affiche
en haut du formulaire et se met à jour à chaque frappe. Il n'empêche jamais
d'enregistrer — on corrige par étapes. Il bloque seulement le bouton
« Publier », et jamais « Dépublier ».

Ce que le site refuse désormais de servir, quoi qu'il y ait en base :

- une photo dont l'URL vient d'une banque d'images (Unsplash, Pexels…) ;
- une citation sans auteur.

Ces trois fiches s'affichent donc **sans galerie** en attendant vos photos, et
CC-2025-004 sans aucune photo.

---

## CC-2026-001 — presque bon

La seule fiche qui tient debout : photos réelles, récit de votre main, slug
correct, chronologie cohérente.

| Champ                | Problème                                                                                            | À faire                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `testimonial_author` | vide → la citation n'est pas affichée                                                               | Nommer qui signe (« Direction », un établissement, un prénom) — ou retirer la citation    |
| `testimonial_quote`  | contient des guillemets en double et une coquille : `"Très bonne qualité produit, nos avons reçu…"` | Retirer les guillemets (le gabarit les ajoute) et corriger « nos avons » → « nous avons » |
| `product_breakdown`  | vide                                                                                                | Facultatif. Si vous le remplissez, le total des lignes doit faire **350**                 |
| `savings_percent`    | vide                                                                                                | Facultatif                                                                                |

---

## CC-2025-003 — compteurs et galerie

| Champ               | Valeur actuelle                                                                      | Problème                                                                     | À faire                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `total_items`       | 790                                                                                  | le détail par famille n'en totalise que **58**                               | Mettre le vrai total, **ou** compléter le détail jusqu'à ce qu'il y corresponde                                    |
| `product_breakdown` | 24 « Tables Marseille rectangulaires » rangées en **chaise**, 22 fauteuils, 12 bancs | catégorie ≠ libellé                                                          | Ranger les tables en `table`, et ajouter les familles manquantes                                                   |
| `gallery`           | 3 vues sur 3 en banque d'images                                                      | non servies                                                                  | 3 photos à vous (les légendes actuelles nomment « Camping Les Pins Bleus » — à garder seulement si c'est bien eux) |
| `story`             | « Première rotation **port du Havre** — 6 campings »                                 | le port de la fiche est **Fos-sur-Mer**, et `professionals_served` dit **8** | Accorder récit, port et nombre de pros                                                                             |
| `timeline`          | « Arrivée Le Havre » 18/05 **puis** « Livraisons finales » 20/04                     | étapes dans le désordre, et port contradictoire                              | Remettre dans l'ordre, corriger le port                                                                            |
| `timeline`          | « contract LEVEL », « Chargement de le marchandise »                                 | coquilles visibles publiquement                                              | Relire les descriptions                                                                                            |

`photo_url` est bonne (photo hébergée chez vous), `delivered_at` et la
clôture sont cohérents, le témoignage est signé.

---

## CC-2025-004 — photos, et la question du témoignage

Fiche **en transit** (`shipping`) : compteurs et détail concordent (412), pros
cohérents (11). Deux choses seulement.

| Champ                | Valeur actuelle                                                 | Problème                                 | À faire                                                                                          |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `photo_url`          | banque d'images                                                 | la fiche s'affiche sans aucune photo     | Une photo à vous                                                                                 |
| `gallery`            | 3 vues sur 3 en banque d'images                                 | non servies                              | Vos photos (légendes actuelles : terrasse La Marina, chaises Cannes, quai Marseille-Fos)         |
| `testimonial_author` | « Restaurant La Marina », `testimonial_location` « Cap d'Agde » | **nomme un établissement identifiable**  | Faire confirmer par écrit avant de laisser en ligne, ou anonymiser en « Restaurant, Cap d'Agde » |
| `timeline`           | étapes datées en **2025**                                       | `delivered_at` annonce le 30/09/**2026** | Accorder les années                                                                              |

---

## CC-2025-014 — l'URL, d'abord

| Champ                  | Valeur actuelle                 | Problème                                                                                   | À faire                                                                                                                 |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `slug`                 | `cc-2025-002`                   | **l'URL publique annonce une autre référence** : `/livres/cc-2025-002` affiche CC-2025-014 | Passer à `cc-2025-014`. Si le lien a déjà été partagé, prévenez-moi : je pose une redirection 301 depuis l'ancienne URL |
| `total_items`          | 270                             | le détail totalise **287** (180 + 42 + 38 + 27)                                            | Trancher entre les deux                                                                                                 |
| `professionals_served` | 3                               | le récit dit « **8** hôteliers du Var et des Bouches-du-Rhône »                            | Accorder les deux                                                                                                       |
| `gallery`              | 3 vues sur 3 en banque d'images | non servies                                                                                | Vos photos (légendes : inspection SGS, chargement Ningbo, Hôtel Le Lavandou)                                            |
| `timeline`             | vide                            | la fiche n'a aucune chronologie                                                            | Facultatif, mais c'est ce qui rend la preuve lisible                                                                    |

`photo_url` est bonne, le témoignage est signé.

---

## Après la saisie

1. Le contrôle en haut du formulaire doit afficher « rien à signaler ».
2. Republier n'est pas nécessaire : les fiches sont déjà publiées, la
   correction est visible dès l'enregistrement.
3. Ces quatre URL sont maintenant annoncées dans
   `https://prosimport.com/sitemap-livres.xml` et indexables — elles ne
   l'étaient pas, elles partaient toutes en `noindex`.
