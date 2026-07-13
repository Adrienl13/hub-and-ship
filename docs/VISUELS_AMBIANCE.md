# Mises en scène produit — « une chaise, une photo »

Direction validée par Adrien (12/07) : chaque modèle du catalogue reçoit UNE
photo de mise en scène dans un décor qui lui est propre — pour montrer la
diversité de la gamme et se différencier des packshots usine que tout le
monde a. Méthode : la vraie photo produit (prosimport.com/catalogue/…) est
importée comme référence dans Higgsfield, puis gpt_image_2 place le produit
IDENTIQUE (tressage, coloris, structure inchangés) dans un environnement.

⚠️ Ce sont des compositions : le produit est le vrai, le décor est généré.
Usage : hero, bandeaux, cartes d'univers, réseaux sociaux. Ne jamais les
présenter comme des photos de containers livrés ou d'installations clients
(audit C8 : zéro preuve fictive).

## Validé

| Produit | Décor | Génération (id Higgsfield) | Statut |
|---|---|---|---|
| Chaise bistrot AMALFI (BIS-035, 3 coloris) | Terrasse parisienne, tables marbre, matin | 90a29e09-86d0-42b4-a938-216586d7f8aa | ✅ retenue par Adrien |

Alternates AMALFI générées : cc1d3bd5 (golden hour, coloris jaune/vert seul),
47012a03 (gros plan méditerranéen 3:2).

## Vague 1 — générée le 13/07, en attente de validation d'Adrien

| Produit | Décor (tous différents) | URL (PNG 2k) |
|---|---|---|
| Chaise bistrot vert/crème (BIS-011) | Cour d'hôtel parisienne sous verrière, matin | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260713_080646_bb4c7b41-5baf-4fe5-a6d7-cdd62ec4bd17.png |
| Chaise bistrot (BIS-001) | Brasserie classique, store rayé rouge, midi | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260713_080703_5b0d7531-6395-492d-9ef2-9e03e0ba59e9.png |
| Salon cordage (ROP-013) | Rooftop au crépuscule, guirlandes, skyline | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260713_080722_80344fb3-3356-4420-918a-65bb5816fa6e.png |
| Fauteuil textilène crème (TES-001) | Bord de piscine méditerranéen, pergola | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260713_081029_077f996c-9b60-48ef-89f6-0c261d894bef.png |
| Piètement fonte (TBA-005) | Café haussmannien, plateau marbre, croissant (3:2) | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260713_081055_255a80d5-357a-444e-8816-7a03bacaf9f7.png |

## Intégration dans le site

1. Adrien télécharge les images retenues depuis son compte Higgsfield (le
   proxy de la session Claude ne peut pas télécharger cloudfront).
2. Convention de nommage : `public/images/scenes/{SKU}.webp` (ex.
   `BIS-035.webp`), WebP ≤ 350 Ko, 1920 px de large max — conversion :
   `node -e "require('sharp')('in.png').resize(1920).webp({quality:78}).toFile('public/images/scenes/BIS-035.webp')"`
3. Me demander de brancher : fiche produit `/catalogue/p/{slug}` (visuel
   d'ambiance sous la galerie), cartes d'univers, et hero si souhaité.

## Références importées dans Higgsfield (réutilisables)

| Fichier source | media_id |
|---|---|
| BIS-035-03 (AMALFI jaune/vert) | 1f617e10-d28a-4535-a7e3-900edba44646 |
| BIS-035-01 (AMALFI 3 coloris) | fb069b4c-46bb-4e87-92e8-c9f6015b14e4 |
| BIS-011-03 | 8314cade-4968-4708-b297-a6b75ff9eadb |
| BIS-001-01 | d5cb665f-2611-49ee-81d2-014eb0748c41 |
| ROP-013-02 | 1544b4b6-1c4f-4679-a8ec-773e0d91c6ae |
| TES-001-01 | 4fa01b75-640b-4018-aa7f-86ffa76db5ee |
| TBA-005-01 | 8edd008a-2691-4682-9048-43a0fda5f3ee |

Suite (vague 2) : étendre aux autres modèles phares (un décor inédit par
modèle : camping haut de gamme, beach club, jardin d'hiver, guinguette,
véranda, place de village…) — même méthode, ~7 crédits par visuel.
