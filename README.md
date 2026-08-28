# Handoff : Refonte page d'accueil Prosimport.com (Container Club)

## Prompt à donner à Claude Code

> Implémente la refonte de la page d'accueil de prosimport.com en te basant sur ce dossier de handoff. Le fichier `Accueil Prosimport.dc.html` est une **référence de design HTML** (prototype haute-fidélité), pas du code de production : recrée-le dans l'environnement existant du site (framework, composants, conventions actuelles du repo). Exigences non négociables :
> 1. **Photos administrables** — chaque emplacement d'image (slides du hero, image de la section gammes, bandeau clientèle, vignettes catalogue) doit être remplaçable par l'admin depuis le back-office existant (upload + recadrage cover), sans toucher au code. Prévois un fallback placeholder si aucune image n'est définie.
> 2. **Tout doit être fonctionnel au clic / swipe** — aucun lien mort, aucun bouton décoratif. Vérifie chaque lien et chaque handler (liste complète section « Interactions »). Le carrousel du hero doit supporter le **swipe tactile** en plus des flèches/pastilles.
> 3. **Responsive** — reproduis exactement les comportements décrits aux breakpoints ≤1024px et ≤640px.
> 4. Termine par une **passe de vérification** : parcours la page en mobile/tablette/desktop, clique chaque lien/CTA/accordéon/flèche, et corrige tout ce qui ne répond pas.

---

## Vue d'ensemble

Refonte de la page d'accueil de Container Club (Pros Import EURL) — club d'achat groupé de mobilier outdoor direct usine par container, pour les pros de la terrasse (restaurants, hôtels, campings). Le parti pris : **le métier est montré en photo dès le hero** (mobilier en situation), texte par-dessus, carrousel d'images.

## À propos des fichiers
- `Accueil Prosimport.dc.html` — la référence de design complète (structure, styles inline, textes définitifs). **Fidélité : haute (hifi)** — couleurs, typos, espacements et copies sont finaux ; recréer au pixel près avec les patterns du codebase.
- `image-slot.js` — composant de placeholder d'image du prototype. **Ne pas reprendre** : le remplacer par le système de médias administrable du site.
- `assets/` — les 3 photos actuellement utilisées (hero, gammes, bandeau). À charger dans la médiathèque admin comme valeurs par défaut.

## Sections (ordre de la page)

1. **Nav sticky** — fond crème translucide + blur, bordure basse. Logo « C » + Container Club, liens : Catalogue, Stock, Partenaires, Le prix prouvé, Ressources (dropdown), CTA « Réserver → » (noir). Mobile ≤640 : liens masqués → prévoir menu burger fonctionnel (le prototype ne l'implémente pas ; à créer avec le pattern du site).
2. **Hero (carrousel)** — carte arrondie 22px, h 660px desktop. Image à droite (56%) avec fondu crème vers le texte ; colonne texte à gauche : badge statut container (données live), H1 66px avec « direct usine » en orange, sous-titre, 2 CTA (« Voir le catalogue → » noir, « Comment ça marche » blanc bordé), 3 badges confiance. Carte « Container en cours » en overlay bas-droite (verre dépoli) : n° container, remplissage % + barre avec seuil 80%, séries, pros engagés — **données temps réel du back**. Carrousel : 4 slides, auto-avance 5,5s, flèches ‹ ›, pastilles (active = 22px orange), interaction manuelle stoppe l'auto-play, fondu 0,55s. **Ajouter le swipe tactile.**
3. **Gammes** — label orange, H2 44px, lien « Ouvrir le catalogue → ». Grille 1.35fr/1fr : grande photo (dégradé noir bas + titre/légende) + 3 cartes (Bistrot, Textilène, Piètements — la 3e en fond noir). Chaque carte cliquable → `/catalogue?collection=…`.
4. **Bandeau clientèle** — pleine largeur 420px, photo collage + dégradé noir gauche→droite, texte blanc.
5. **3 piliers** — Direct usine / Groupé entre pros / Tout est géré, pastilles numérotées.
6. **Double parcours** — 2 cartes : « J'équipe mon établissement » (blanche → /catalogue) et « Je revends à mon réseau » (noire → /partenaires).
7. **Comment ça marche** — 5 cartes numérotées 01→05 (la 05 en noir/orange). Lien politique de remboursement → FAQ.
8. **Catalogue (aperçu)** — filtres chips (Tous actif), 3 fiches produit (photo admin, prix HT, barre MOQ, compteur réservés — **données réelles**), panneau container sticky (mêmes données live que le hero) avec CTA « Confirmer ma réservation » et « Télécharger le devis PDF ».
9. **Livraison** — « Notre prix s'arrête au port d'arrivée », 2 cartes, lien transporteurs → /transport-partenaires.
10. **FAQ** — accordéon 6 questions (une ouverte à la fois, +/− orange). Contenu final dans le HTML.
11. **CTA final** — carte noire, bouton orange « Confirmer ma réservation → ».
12. **Newsletter** — email + bouton « M'avertir » (brancher sur le système d'emailing existant, avec validation email + état succès/erreur).
13. **Footer** — 4 colonnes (marque, Guides pros, Logistique, Contact) + ligne légale. Reprendre les URLs existantes du site.

## Interactions — checklist de vérification (tout doit répondre)

- [ ] Nav : 5 liens + dropdown Ressources + Réserver ; burger mobile.
- [ ] Hero : flèches prev/next, 4 pastilles, swipe tactile, pause auto-play après interaction, 2 CTA, 3 badges (non cliquables, ok).
- [ ] Gammes : lien catalogue + 4 zones cliquables vers les collections.
- [ ] Double parcours : 2 cartes cliquables.
- [ ] Catalogue : chips filtres fonctionnels, fiches cliquables, CTA réservation, devis PDF.
- [ ] FAQ : 6 accordéons ouverture/fermeture au clic (et au clavier).
- [ ] CTA final + newsletter (submit fonctionnel).
- [ ] Footer : tous les liens vers les pages existantes (aucun `#` mort).

## Photos administrables

| Emplacement | Défaut fourni | Format conseillé |
|---|---|---|
| Hero slides 1–4 | `assets/hero-salon-vue-mer.webp`, `assets/fauteuils-tresses-dessus.webp`, `assets/collage-terrasses.webp`, (vide) | ~1600×1400, cover |
| Section gammes | `assets/fauteuils-tresses-dessus.webp` | ~1200×1000, cover |
| Bandeau clientèle | `assets/collage-terrasses.webp` | ≥2400 de large, cover |
| 3 vignettes catalogue | vides (placeholder) | ~800×600, cover |

Admin : upload, réordonner/ajouter/supprimer des slides du hero (le carrousel s'adapte au nombre), alt text éditable.

## Responsive

- **≤1024px (tablette)** : hero empilé (carrousel h 400px au-dessus, texte puis carte container en dessous, fondu crème passe en bas de l'image) ; `<br>` du H1 ignorés ; gammes/catalogue 1 colonne ; étapes 3 colonnes ; fiches produit 2 colonnes ; panneau container non-sticky ; footer 2 colonnes ; H1 50px, H2 33px, h3 21px, corps 18→17px.
- **≤640px (mobile)** : tout 1 colonne ; nav réduite ; carrousel h 300px ; bandeau h 560px ; H1 38px, H2 26px, h3 19px ; échelle texte : 34→26, 26→20, 24→20, 22→19, 20→17, 18→16, 17→15, 16,5→15, 16→15, 15,5→14,5px ; paddings latéraux 18–20px ; CTA/newsletter compactés.
- `text-wrap: balance` sur tous les titres.

## Design tokens

- Fond crème `#F4EFE7` · surfaces blanches `#FFFFFF` · noir `#1A1815` · orange `#D97A34` (variante claire sur fond noir `#E8963F`) · vert statut `#3f8f2a` / `#7BB661` · textes secondaires `#5f584d` / `#6b6357` / `#8a8073` · bordures `#e4dccd` / `#d8cfbf` · fond ligne mise en avant `#faf5ec`.
- Typo : **Archivo** (Google Fonts), poids 400–900. H1 66/800/-0.03em, H2 40–44/800/-0.025em, h3 22–26/800, corps 15–18/400–500, labels uppercase 12–13/700/+0.1em.
- Rayons : cartes 14–22px, boutons 9–11px, pills 100px. Ombres : hero `0 30px 80px -34px rgba(26,24,21,.4)`, carte flottante `0 20px 40px -18px rgba(26,24,21,.45)`.

## Données dynamiques (ne pas coder en dur)

N° container, statut, destination, % remplissage, seuil, séries, pros engagés, date de clôture, prix et compteurs MOQ des produits. Le prototype montre des valeurs d'exemple (62%, 3/5, 12).
