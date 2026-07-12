# Visuels d'ambiance générés (upgrade optionnel du Sprint 4)

Le Sprint 4 a fait le choix des **vrais packshots produit** pour le hero et
les univers de collections (le produit réel est la meilleure preuve). En
complément, 6 visuels d'ambiance photo-réalistes ont été générés (Higgsfield,
modèle gpt_image_2, 2688×1520, 12/07/2026) pour un éventuel hero
photographique plein écran — l'option « visuel généré en attendant le premier
container livré » proposée dans l'audit (D1).

⚠️ Ce sont des images de synthèse : ne JAMAIS les présenter comme des photos
de nos produits ou de containers livrés (cohérence avec l'audit C8 « zéro
preuve fictive »). Usage acceptable : décor de hero/bandeau, clairement
non-preuve. Dès les premières vraies photos terrain, les remplacer.

## Les fichiers (compte Higgsfield d'Adrien, aussi téléchargeables depuis l'app)

| Usage | Génération (id) | URL |
|---|---|---|
| Hero A — terrasse golden hour | 2b4a2207 | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260712_123016_2b4a2207-1337-462d-bfd3-60235e9f81be.png |
| Hero B — variante | 304cc549 | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260712_123016_304cc549-d09a-41c9-997c-88a036b6c337.png |
| Univers Bistrot | f801e367 | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260712_123050_f801e367-dc78-49ae-991f-a41f580ab294.png |
| Univers Cordage (rooftop dusk) | 059683ad | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260712_124050_059683ad-0b00-48f1-8bc3-a8ebc04a1b4c.png |
| Univers Piètements (marbre/fonte) | 118c13bd | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260712_124447_118c13bd-cf4e-489b-89b3-a5be878c5968.png |
| Univers Textilène (brasserie) | 5708cfc3 | https://d8j0ntlcm91z4.cloudfront.net/user_3DisRTQcUs0PB9kwurVdVznkRWT/hf_20260712_124614_5708cfc3-c660-4bf2-83cd-3efeaf2b7762.png |

## Pour les activer plus tard

1. Télécharger les PNG (le proxy de la session Claude bloquait cloudfront —
   depuis ton poste ça passe).
2. Les convertir/redimensionner en WebP ≤ 300 Ko (sharp est déjà dans
   node_modules) :
   `node -e "require('sharp')('hero-a.png').resize(1920).webp({quality:78}).toFile('public/images/ambiance/hero.webp')"`
3. Les déposer dans `public/images/ambiance/` puis me demander de brancher le
   hero photographique (fond `absolute inset-0` + voile sable, le point
   d'insertion est documenté dans Hero.tsx).
