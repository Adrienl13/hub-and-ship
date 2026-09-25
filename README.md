# Handoff : Page « Le prix prouvé » — Prosimport.com (Container Club)

## Prompt à donner à Claude Code

> Implémente la page « Le prix prouvé » de prosimport.com en te basant sur ce dossier de handoff. Le fichier `Le Prix Prouve.dc.html` est une **référence de design HTML** (prototype haute-fidélité), pas du code de production : recrée-la dans l'environnement existant du site (framework, composants, conventions du repo, même nav/footer que la page d'accueil déjà implémentée). Exigences non négociables :
> 1. **Photos administrables** — le fond du hero et les 4 photos de la frise « trajet du container » doivent être remplaçables par l'admin depuis le back-office (upload + recadrage cover), avec fallback placeholder.
> 2. **Tout fonctionnel au clic / tap** — aucun lien mort ni bouton décoratif. Le graphique de prix est interactif (survol desktop + tap mobile sur chaque segment → encart explicatif), le simulateur de remise recalcule en direct, la FAQ s'ouvre/ferme au clic et au clavier, les ancres du sommaire sticky défilent vers leurs sections.
> 3. **Chiffres réels, jamais codés en dur** — les données marquées « dynamiques » ci-dessous viennent du back. Les montants du graphique (42/78/119 €) restent un exemple illustratif assumé, libellé comme tel.
> 4. **Responsive** — reproduis les comportements ≤1024px et ≤640px décrits plus bas.
> 5. Termine par une **passe de vérification** : parcours mobile/tablette/desktop, clique chaque segment, chip, ancre, accordéon et CTA, corrige tout ce qui ne répond pas.

---

## Structure de la page (ordre)

1. **Nav sticky** — identique à l'accueil ; « Le prix prouvé » actif (souligné orange).
2. **Hero sombre** (#332E27) — photo admin en fond + voile brun dégradé. Gauche : label orange, H1 56px (« On ne vous demande pas de nous croire. On vous montre la méthode. »), paragraphe, 2 CTA (Vérifier au catalogue → /catalogue ; Rapports SGS → page/PDF rapports). Droite : **graphique interactif** — 2 barres empilées (circuit showroom 119 € en 5 segments vs Container Club 78 € en 4 segments, base usine 42 € identique), animation scaleY à l'apparition, chaque segment cliquable/survolable → encart titre + explication (9 contenus fournis dans le prototype, objet `segs` du logic), lien « Vérifier sur une vraie fiche produit → » (pointer vers une fiche réelle du catalogue), badge −34 %.
3. **Sommaire sticky** (sous la nav, chips d'ancres) : La méthode `#methode`, Remises & paiement `#remises`, Le trajet `#trajet`, Les preuves `#preuves`, FAQ `#faq`. Scroll-margin ~130px. Pas de scrollIntoView custom : ancres natives.
4. **La méthode `#methode`** — 5 cartes numérotées 01→05 (la 05 en brun #332E27, texte crème).
5. **Remises & paiement `#remises`** — grille 2 colonnes : (a) simulateur — 3 boutons 50/100/150 pièces, base 78 € HT, paliers −6 % ≥100 pièces / −10 % ≥150 pièces, prix unitaire + total recalculés, badge « palier atteint/non atteint » ; (b) panneau brun « paiement 3 % / 27 % / 70 % » avec explications.
6. **Le trajet `#trajet`** — 4 cartes photo (admin) : contrôle SGS usine, chargement, arrivée port, terrasse équipée.
7. **Les preuves `#preuves`** — 3 cartes avec gros chiffre orange : « 100 % des containers contrôlés SGS » (statique), « X/5 d'avis d'achat vérifié » et « N containers livrés » (**dynamiques** — le prototype montre 4,8/5 et 14 en exemple, à brancher sur les vraies données ; ne jamais publier de faux chiffres). Liens : rapports, avis, historique.
8. **FAQ `#faq`** — accordéon 5 questions, une ouverte à la fois, +/− orange. Format des réponses : **une phrase de réponse directe en gras** puis puces détaillées (contenu final dans le HTML, à reprendre tel quel). Balisage schema.org FAQPage bienvenu.
9. **Bloc fondateur** — carte brune, avatar « AL », citation, 2 CTA.
10. **Footer** compact — reprendre le footer réel du site.

## Interactions — checklist

- [ ] 9 segments du graphique : hover (desktop) + tap (mobile) → encart mis à jour, outline blanc sur le segment actif.
- [ ] Simulateur : 3 boutons, état actif, recalcul unitaire/total/badge.
- [ ] 5 chips d'ancres → scroll natif vers la bonne section (nav + sommaire restent lisibles).
- [ ] FAQ : 5 accordéons clic + clavier (Enter/Espace), aria-expanded.
- [ ] Tous les CTA/liens pointent vers de vraies routes (catalogue, rapports SGS, avis, historique, fiche produit exemple).

## Données dynamiques (back-office)

Note moyenne d'avis, nombre de containers livrés, liens rapports SGS. Photos : hero (1 slot) + trajet (4 slots), upload admin avec alt éditable.

## Responsive

- **≤1024px** : hero 1 colonne (texte puis graphique) ; grilles méthode/simulateur/preuves 1 colonne ; trajet 2 colonnes ; H1 44px, H2 33px.
- **≤640px** : tout 1 colonne ; liens nav masqués (burger du site) ; chart-box padding réduit ; bloc fondateur empilé ; H1 34px, H2 26px ; paddings latéraux 18px ; sommaire chips scrollable horizontalement.
- `text-wrap: balance` sur les titres.

## Design tokens

Identiques à l'accueil : crème #F4EFE7, blanc, brun sombre **#332E27** (remplace le noir sur cette page — décision volontaire, moins agressif), texte noir #1A1815, orange #D97A34 (clair #E8963F sur fond sombre), vert #8FC96F/#3f8f2a, secondaires #5f584d/#6b6357/#8a8073, bordures #e4dccd/#d8cfbf. Typo Archivo 400–900. Rayons 9–22px.
