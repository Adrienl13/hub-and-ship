# Pros Import / Container Club — Brief stratégique IA

> Document de pilotage pour toute IA, tout prestataire ou tout futur contributeur.
> Objectif : comprendre rapidement ce que nous construisons, pourquoi cela doit être différent d'un site CHR classique, et quels chantiers mener sans trahir la stratégie.

## 1. Résumé directif

Pros Import / Container Club ne doit pas devenir un simple site de mobilier CHR avec panier, prix barrés et quelques visuels. Ce marché existe déjà, il demande beaucoup de stock, de cash, de logistique et de notoriété. Nous n'avons pas vocation à immobiliser 300 000 euros de stock pour copier les distributeurs existants.

La plateforme doit devenir une centrale d'import digitale pour mobilier professionnel : elle mutualise les volumes, rend le container compréhensible, sécurise les revendeurs, donne aux restaurateurs et hôteliers une alternative directe sous conditions, et transforme la contrainte de stock limité en avantage de transparence.

La thèse produit est simple :

- Les revendeurs veulent protéger leur relation client, acheter net, marger librement et ne pas se faire court-circuiter.
- Les restaurateurs et hôtels veulent du mobilier solide, lisible, moins cher, avec une preuve qualité et un délai clair.
- Pros Import veut garantir sa marge minimale, remplir des containers, réduire le risque stock, obtenir du cash plus tôt et créer un réseau qui parle du service.
- La plateforme doit être utile même avant d'avoir un gros catalogue en stock : simulation, devis, co-branding, réservation, suivi container, preuve qualité, stock 24h, documents et protection partenaire.

La promesse stratégique à garder :

> Pros Import est le partenaire d'import volume des revendeurs CHR et des pros qui veulent acheter intelligemment, sans payer la marge complète d'un distributeur stockiste.

## 2. Ce que nous construisons

### 2.1 Positionnement

Pros Import doit être perçu comme :

- Une infrastructure d'import B2B, pas une boutique décorative.
- Un partenaire de marge pour revendeurs, agenceurs, prescripteurs, installateurs et réseaux CHR.
- Une solution d'achat direct encadrée pour restaurants, hôtels, cafés et établissements qui acceptent le volume, le délai et les conditions container.
- Un outil de confiance : qualité, conformité, traçabilité, documents, vrais volumes, vraie logistique.

La plateforme doit faire comprendre en moins de 10 secondes :

- On achète du mobilier professionnel en volume.
- Le prix baisse parce que le container est mutualisé, pas parce que le produit est bas de gamme.
- Les revendeurs peuvent utiliser la plateforme sans perdre leurs clients.
- Les petites urgences sont traitées via un espace stock disponible sous 24h.
- La qualité et la conformité sont visibles, pas seulement promises.

### 2.2 Ce que nous ne construisons pas

Nous ne construisons pas :

- Une marketplace ouverte où tout fournisseur peut publier.
- Un site B2C.
- Un catalogue de 10 000 références sans profondeur opérationnelle.
- Un modèle qui oblige à acheter énormément de stock avant de vendre.
- Une interface "jeu" qui amuse mais ne convertit pas.
- Un outil qui expose les marges internes aux clients.
- Un système qui impose un prix de revente aux revendeurs.

La plateforme peut être ludique, mais le ludique doit servir la décision d'achat : comprendre le volume, la marge, le risque, le délai, la qualité et l'opportunité.

## 3. La tension centrale : direct pro et revendeurs

Le point le plus sensible est le suivant : si Pros Import vend directement aux restaurateurs et hôtels, les revendeurs peuvent craindre de partager le site, car leur client pourrait contourner le revendeur.

Il faut donc une doctrine de canal claire.

### 3.1 Doctrine proposée

Pros Import vend à deux canaux :

| Canal                | Client                                   | Prix                | Logique                                                | Protection                                             |
| -------------------- | ---------------------------------------- | ------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Partenaire revendeur | Revendeur, agenceur, apporteur structuré | Prix net partenaire | Pros Import marge moins, le partenaire marge librement | Deal registration + lien co-brandé + attribution SIRET |
| Direct pro           | Restaurant, hôtel, café, collectivité    | Prix direct pro     | Pros Import marge plus, service standardisé            | Aucun conflit si prospect non protégé                  |

Le direct pro n'est pas l'ennemi du revendeur si le système protège la relation apportée.

Règle produit : un prospect apporté par un revendeur doit rester attribué à ce revendeur pendant une durée définie, même si ce prospect revient ensuite sur le site public. Cette protection doit être visible dans l'espace partenaire.

### 3.2 Règles commerciales à intégrer

- Prix net partenaire : objectif de marge Pros Import autour de 25%, à affiner par catégorie, transport, risques et devise.
- Prix direct pro : objectif de marge Pros Import autour de 35%, car le direct consomme plus de support et peut concurrencer les distributeurs.
- Prix public conseillé : possible, mais uniquement indicatif et jamais imposé.
- Remises client : afficher des remises compréhensibles de type 2%, 6%, 10% selon quantité, pas les marges internes.
- Ne jamais écrire qu'un revendeur doit respecter un prix minimum de revente.
- Le revendeur peut revendre 2x, 3x ou plus s'il ajoute du conseil, de la pose, du stock, du SAV, de la livraison ou du financement.
- Le site public ne doit pas afficher les conditions nettes partenaire.

### 3.3 Protection partenaire

Fonctionnalités indispensables :

- Inscription partenaire avec validation manuelle.
- Deal registration par SIRET, nom société, email domaine, contact et projet.
- Durée de protection configurable : 90, 120 ou 180 jours.
- Statut du deal : soumis, protégé, devis envoyé, réservation, gagné, perdu, expiré.
- Lien co-brandé partageable : `/p/{slug-partenaire}/selection/{id}`.
- Devis co-brandé : logo partenaire, coordonnées partenaire, produits, conditions, prix public ou prix partenaire selon mode.
- Attribution automatique si le client revient via lien, SIRET, email domaine ou projet déjà protégé.
- Tableau de bord partenaire : deals protégés, volume en cours, prix nets, commissions éventuelles, documents et assets.

Etat de mise en oeuvre au 2026-06-07 :

- MVP public disponible : `/partenaires` pour recruter, `/p/{slug}` pour partager une page co-brandée.
- Le contexte lien partenaire est capturé localement 120 jours et ajouté au snapshot de réservation.
- L'admin peut voir un signal "Lien partenaire" ou "Deal partenaire reconnu" dans les réservations.
- Les prix nets partenaires restent absents des pages publiques.
- Reste à livrer : création de slugs depuis l'admin, espace partenaire authentifié, sélections persistées, devis PDF co-brandés, assets de vente et suivi de commission/marge.

## 4. Personas à servir

### 4.1 Revendeur CHR

Profil :

- Possède un réseau local ou sectoriel.
- Vend déjà du mobilier, de l'agencement, de la terrasse ou de l'équipement professionnel.
- Veut acheter moins cher ou accéder à des modèles différenciants.
- Ne veut pas perdre le client final.

Pains :

- Prix fournisseurs trop élevés.
- Difficulté à importer seul.
- Besoin de marge libre.
- Crainte de se faire contourner.
- Besoin de documents propres pour convaincre.
- Besoin d'un délai et d'une preuve qualité.

Ce qu'il doit ressentir :

> "Je peux utiliser Pros Import comme mon back-office d'import, sans exposer ma marge ni mon client."

### 4.2 Restaurateur / hôtel / café

Profil :

- Cherche à équiper terrasse, salle, hôtel, café, plage, rooftop, camping ou collectivité.
- Compare beaucoup de fournisseurs.
- A peur du mauvais produit, du retard, du SAV, des frais cachés.

Pains :

- Prix élevés chez les distributeurs.
- Manque de transparence sur l'origine et les délais.
- Difficile de savoir si les dimensions, MOQ et volumes sont cohérents.
- Besoin de stock rapide parfois.

Ce qu'il doit ressentir :

> "Je comprends pourquoi c'est moins cher, ce que je gagne, ce que j'accepte comme délai, et je peux acheter sans mauvaise surprise."

### 4.3 Admin Pros Import

Profil :

- Doit piloter catalogue, marge, containers, qualité, stock 24h, réservations et partenaires.

Pains :

- Beaucoup de données à suivre.
- Risque d'erreurs de prix, stock, volume, conformité et attribution.
- Besoin de convertir vite sans perdre le contrôle.

Ce qu'il doit ressentir :

> "Je vois quoi vendre, à qui, avec quelle marge, quel risque, quel container et quelle priorité."

## 5. Différenciation : être unique sans gros stock

Les distributeurs CHR traditionnels gagnent souvent par :

- Stock disponible.
- Largeur de catalogue.
- Livraison rapide.
- Ancienneté.
- Financement ou devis.
- Relation commerciale.

Pros Import ne doit pas jouer exactement la même partie. La différenciation doit être :

1. Achat volume mutualisé : le client comprend le remplissage et le seuil container.
2. Prix rendus explicables : le client sait pourquoi il paie moins.
3. Protection revendeur : le partenaire peut partager sans peur.
4. Devis co-brandé : le revendeur utilise la plateforme comme outil de vente.
5. Stock 24h assumé : pour les urgences, uniquement sur lots disponibles.
6. Qualité visible : documents, tests, photos, contrôles, rapports, historique containers.
7. Packing intelligent : la 3D doit expliquer la capacité réelle, pas seulement décorer.
8. Opérationnel transparent : délais, ports, transporteurs, étapes, risques.
9. Contenu utile pour IA et Google : pages qui répondent aux vraies questions d'achat B2B.
10. Expérience orientée décision : mobile rapide, catalogue dense, prix lisible, CTA clair.

## 6. Principes UX et design

### 6.1 Le site doit être plus "outil pro premium" que "landing page"

Le site peut être élégant, mais il doit surtout permettre de décider :

- Voir vite les produits.
- Comparer vite les dimensions, MOQ, prix, variantes et disponibilité.
- Comprendre la quantité minimale : chaises 50 unités, puis ajout par 10 ; tables selon MOQ défini.
- Comprendre les remises client : 2%, 6%, 10% selon seuils élevés.
- Voir le container évoluer de manière crédible.
- Sauvegarder une sélection.
- Demander un devis ou réserver.

### 6.2 Catalogue

Le catalogue doit pouvoir supporter :

- 100 à 150 chaises/fauteuils.
- 20 tables.
- Variantes coloris/matières.
- Recherche rapide.
- Filtres compacts.
- Vue mobile lisible.
- Vue desktop dense quand nécessaire.

Orientation :

- Sur mobile : cartes portrait plein cadre, image forte, action rapide.
- Sur desktop : conserver le rendu visuel premium, mais prévoir un mode comparaison dense pour les acheteurs pros.
- Les marges internes ne doivent jamais apparaître.
- Les seuils de réduction client doivent être expliqués en pourcentage, pas en marge.

### 6.3 3D container

La 3D n'est pas un jouet. Elle doit devenir un outil de confiance.

Règles connues :

- Les chaises se groupent en piles.
- Exemple métier : 10 chaises = une pile ; 4 piles peuvent tenir sur la largeur selon dimensions validées.
- Les tables peuvent aller au-dessus des piles de chaises, mais jamais en dessous.
- Le placement doit s'adapter à l'ordre d'ajout : ajouter tables puis chaises ne doit pas gaspiller artificiellement l'espace.
- Si le volume ou la géométrie dépasse un 20 pieds, le système doit proposer automatiquement un 40 pieds.
- Les unités hors capacité doivent être expliquées clairement : "dépassement réel" vs "placement à optimiser".

DoD 3D :

- Pas de cartons gris incompréhensibles sans légende.
- Couleurs par type produit.
- Indication des produits réservés par d'autres pros sans créer de confusion.
- Fallback 2D fiable si la scène 3D charge mal.
- Tests avec paniers mixtes : chaises seules, tables seules, tables + chaises, ajout dans ordre inversé.

### 6.4 Qualité

La page qualité ne doit jamais afficher une absence brute du type "0 rapport publié" comme signal principal. Tant que la base Supabase ou les rapports ne sont pas prêts, elle doit présenter :

- Le protocole qualité.
- Ce qui sera vérifié.
- Les documents attendus.
- Les contrôles fournisseur.
- Les limites assumées.
- Les prochaines preuves à publier.

Le message doit être : "la preuve arrive et le process est structuré", pas "il n'y a rien".

## 7. Architecture produit cible

### 7.1 Modules publics

| Module            | Rôle                                                  | Priorité   |
| ----------------- | ----------------------------------------------------- | ---------- |
| Home              | Positionnement dual direct pro + revendeur            | Très haute |
| Catalogue         | Décision produit et ajout quantité                    | Très haute |
| Stock 24h         | Cash court terme et urgences                          | Très haute |
| Revendeurs        | Acquisition partenaires et réassurance canal          | Très haute |
| Qualité           | Confiance, conformité, preuve                         | Très haute |
| Transporteurs     | Clarifier rendu port et options post-port             | Haute      |
| Containers livrés | Preuve sociale et historique                          | Haute      |
| FAQ               | Objections prix, délai, qualité, revendeur, livraison | Haute      |
| Pages SEO/GEO     | Acquisition organique et réponses IA                  | Moyenne    |

### 7.2 Modules partenaires

| Module                 | Rôle                                  |
| ---------------------- | ------------------------------------- |
| Espace partenaire      | Accès prix nets, deals, devis, assets |
| Deal registration      | Protection client/projet              |
| Sélections co-brandées | Partage sans court-circuit            |
| Devis PDF co-brandé    | Outil de vente partenaire             |
| Bibliothèque assets    | Photos, fiches, arguments, dimensions |
| Suivi commission/marge | Transparence partenaire               |

### 7.3 Modules admin

| Module           | Rôle                                           |
| ---------------- | ---------------------------------------------- |
| Catalogue admin  | Produits, variantes, images, prix, MOQ         |
| Containers admin | Capacité, statut, seuils, départ, format 20/40 |
| Réservations     | Conversion, paiement, statut, notes            |
| Stock 24h        | Demandes urgentes et conversion                |
| Partenaires      | Validation, droits, prix, deals                |
| Qualité          | Rapports, certificats, contrôles, documents    |
| Pricing          | Marges, remises, éco-contribution, frais       |
| Analytics        | Funnel, panier, sources, conversion            |

## 8. Modèle économique

### 8.1 Sources de marge

- Marge produit sur prix net importé.
- Frais de réservation éventuels.
- Optimisation container.
- Réassort partenaire.
- Stock 24h écoulé plus vite.
- Services futurs : sourcing dédié, contrôle qualité renforcé, livraison groupée, installation via partenaires.

### 8.2 Règle de marge

Hypothèse actuelle :

- Revendeur : marge Pros Import cible autour de 25%.
- Direct pro petite quantité : marge Pros Import cible autour de 35%.
- Très gros volume : marge ajustable selon risque, catégorie, devise, container et historique client.

Attention : la plateforme doit afficher au client des remises commerciales simples, pas les marges internes.

### 8.3 Logique de prix client

Afficher :

- Prix HT.
- Ancien prix indicatif si justifié.
- Remise quantité client : 2%, 6%, 10%.
- Éco-contribution.
- MOQ.
- Quantité minimale et incrément.
- Seuil suivant.

Ne pas afficher :

- Marge Pros Import.
- Marge revendeur.
- Coût fournisseur.
- Prix net partenaire sur le site public.

## 9. Règles légales et conformité

### 9.1 Prix de revente

Il ne faut pas imposer un prix minimum de revente aux revendeurs. On peut recommander un prix, fournir un prix public conseillé, fournir des assets ou un devis co-brandé, mais le revendeur doit rester libre de son prix final.

Risque à éviter :

- Refuser de livrer un revendeur parce qu'il revendrait "trop bas".
- Écrire que le prix de revente est obligatoire.
- Conditionner des remises au respect d'un prix minimum.

### 9.2 Produit et import

Pros Import doit traiter sérieusement :

- Sécurité générale des produits.
- Traçabilité importateur/fournisseur.
- Documents techniques.
- Notices et avertissements si nécessaires.
- Éco-participation mobilier.
- Responsabilité de mise sur le marché.
- Archivage des preuves qualité.

La conformité doit devenir une force commerciale : les petits importateurs concurrents négligent souvent cette partie.

### 9.3 Données et confidentialité

Ne jamais exposer publiquement :

- Secrets Supabase/Stripe/Resend.
- Informations sensibles de partenaires.
- Conditions nettes partenaire.
- Données personnelles prospects.
- Numéros administratifs non nécessaires publiquement.

Conserver publiquement uniquement les informations légales nécessaires au site.

## 10. SEO, AEO, GEO, LLMO

Le site doit penser au-delà du SEO classique.

Définitions utiles :

- SEO : optimisation pour moteurs de recherche.
- AEO : Answer Engine Optimization, répondre clairement aux questions pour snippets et assistants.
- GEO : Generative Engine Optimization, être cité/compris par les moteurs génératifs.
- LLMO : Large Language Model Optimization, terme moins stabilisé, mais idée proche : rendre le contenu structuré et fiable pour les IA.
- SXO : Search Experience Optimization, cohérence entre recherche, page, UX et conversion.

Approche recommandée :

- Ne pas produire du contenu générique.
- Créer des pages qui répondent à des décisions B2B réelles.
- Utiliser des tableaux, FAQ, définitions, exemples de calcul, schémas de processus.
- Ajouter des preuves : documents, dates, méthodes, limites.
- Travailler les requêtes longues : "acheter 100 chaises restaurant terrasse", "import mobilier CHR container", "mobilier restaurant revendeur prix net", "MOQ chaises restaurant professionnel", "stock mobilier terrasse 24h".

Pages à créer :

- `/revendeurs-mobilier-chr`
- `/achat-volume-mobilier-restaurant`
- `/import-mobilier-terrasse-container`
- `/stock-mobilier-restaurant-24h`
- `/qualite-mobilier-chr`
- `/guides/moq-chaises-restaurant`
- `/guides/prix-net-revendeur-mobilier-chr`
- `/guides/container-20-pieds-vs-40-pieds-mobilier`

## 11. Chantiers prioritaires

### C01 — Repositionnement public de la home

Tenant :

- Le site doit expliquer immédiatement le modèle dual : restaurateurs/hôtels et revendeurs.

Aboutissant :

- Home avec deux entrées claires : "J'équipe mon établissement" et "Je revends à mon réseau".
- Message principal orienté import volume, prix net, protection partenaire, qualité.
- CTA vers catalogue, stock 24h, revendeurs.

DoD :

- Un visiteur comprend le modèle en moins de 10 secondes.
- Aucun terme interne de type "Session 0", "Lovable", "marge" ou "mock" visible.
- Lighthouse et mobile sans régression majeure.

### C02 — Page revendeurs

Tenant :

- Les revendeurs ne partageront pas la plateforme sans protection.

Aboutissant :

- Page dédiée expliquant prix net partenaire, protection client, devis co-brandé, deal registration, documents et fonctionnement.

DoD :

- ✅ Route publique `/partenaires`.
- ✅ Formulaire d'intérêt partenaire.
- ✅ FAQ conflit de canal.
- ✅ Texte clair : "Votre client reste votre client".

### C03 — Deal registration

Tenant :

- Le principal risque de canal est le court-circuit du revendeur.

Aboutissant :

- Système d'enregistrement d'opportunité par partenaire.

DoD :

- ✅ Tables Supabase initiales : `partner_applications`, `partner_deals`.
- ✅ Statuts de deal : soumis, protégé, devis envoyé, réservé, gagné, perdu, expiré, refusé.
- ✅ Admin peut qualifier les candidatures et changer le statut des deals.
- ✅ Protection par SIRET/email domaine : attribution automatique prête en migration, à appliquer sur Supabase prod.
- 🔄 Lien co-brandé : attribution par lien partenaire encore à construire.
- 🔄 Expiration : `protection_days` et `protected_until` existent, automatisation d'expiration à ajouter.

### C04 — Sélections et devis co-brandés

Tenant :

- Le revendeur a besoin d'un support de vente qu'il peut envoyer au client.

Aboutissant :

- Sélection partageable avec identité du partenaire.

DoD :

- URL co-brandée.
- PDF devis.
- Logo et coordonnées partenaire.
- Tracking source.
- CTA qui renvoie vers le partenaire quand le deal est protégé.

### C05 — Pricing partenaire et direct pro

Tenant :

- Il faut garantir la marge Pros Import tout en laissant le revendeur libre.

Aboutissant :

- Pricing par rôle : public/direct, partenaire, admin.

DoD :

- Aucun prix net partenaire accessible hors auth partenaire.
- Calculs testés.
- Remises affichées en pourcentage client.
- Prix public conseillé facultatif et non obligatoire.

### C06 — Catalogue scalable

Tenant :

- Le catalogue doit supporter 100-150 chaises/fauteuils et 20 tables.

Aboutissant :

- Catalogue rapide, filtrable, scannable et beau.

DoD :

- Recherche instantanée/deferred.
- Filtres dimensions, matière, empilable, usage, stock 24h, MOQ.
- Mode carte portrait.
- Mode comparaison dense desktop si utile.
- Tests mobile et desktop.

### C07 — Trust Ledger qualité

Tenant :

- La qualité doit être prouvée, surtout si le prix est plus bas.

Aboutissant :

- Page qualité éditoriale + documents quand disponibles.

DoD :

- Pas d'état vide anxiogène.
- Protocole qualité visible.
- Rapports, certificats, photos, contrôles.
- Admin peut publier/retirer.

### C08 — Container Cockpit intelligent

Tenant :

- La visualisation container doit rassurer sur la faisabilité réelle de la commande.

Aboutissant :

- Packing adaptatif, 20/40 pieds automatique, règles chaises/tables correctes.

DoD :

- Les tables peuvent aller sur les piles de chaises mais pas dessous.
- L'ordre d'ajout ne crée pas de faux hors capacité.
- Couleurs et légendes compréhensibles.
- Tests paniers mixtes.

### C09 — Stock 24h comme machine à cash court terme

Tenant :

- Le stock existant doit convertir vite sans attendre les containers.

Aboutissant :

- Espace stock disponible sous 24h avec demande rapide et suivi admin.

DoD :

- Lots visibles.
- Quantités réellement disponibles.
- Demande en moins d'une minute.
- Admin reçoit et traite.
- Leads non perdus si Supabase public échoue.

### C10 — Réservation fiable

Tenant :

- Le parcours client doit éviter les erreurs qui cassent la confiance.

Aboutissant :

- Réservation transactionnelle, paiement, webhook, emails, historique.

DoD :

- Supabase Auth configuré.
- Stripe live prêt avant ouverture.
- Emails transactionnels Resend.
- Réservation + items atomiques.
- E2E réservation complète.

### C11 — Admin Command Center

Tenant :

- Pros Import doit piloter marge, stock, containers, qualité et partenaires depuis un seul endroit.

Aboutissant :

- Admin opérationnel, pas seulement vitrine.

DoD :

- Vue priorités jour.
- Alertes : stock faible, deal à valider, paiement en attente, container à 80%, document manquant.
- Édition catalogue fiable.
- Logs d'audit.

### C12 — Conformité et documents

Tenant :

- L'importateur doit pouvoir prouver ce qu'il met sur le marché.

Aboutissant :

- Dossier conformité par produit et container.

DoD :

- Éco-participation modélisée.
- Documents qualité liés aux produits/variants.
- Checklists GPSR/import.
- Traçabilité fournisseur.

### C13 — Moteur de contenu SEO/GEO

Tenant :

- Le site doit être trouvé et cité sans dépendre uniquement de publicité payante.

Aboutissant :

- Pages guides utiles, structurées, mises à jour.

DoD :

- Pages avec FAQ schema quand pertinent.
- Sitemap à jour.
- Contenu précis, pas générique.
- Liens internes vers catalogue/stock/revendeurs.

### C14 — Analytics et apprentissage

Tenant :

- Il faut savoir ce qui convertit avant d'investir plus.

Aboutissant :

- Funnel mesuré de la visite au devis/réservation.

DoD :

- Events : vue produit, ajout quantité, seuil atteint, devis, stock request, partner lead.
- Dashboard simple.
- Respect RGPD.

### C15 — Enablement partenaire

Tenant :

- Les revendeurs vendront plus si on leur donne des supports prêts à l'emploi.

Aboutissant :

- Kit partenaire : photos, fiches, arguments, comparatifs, modèles de devis.

DoD :

- Assets téléchargeables.
- Fiches par produit.
- Copy commercial par persona.
- Instructions d'usage sans prix imposé.

### C16 — Boucle fidélisation

Tenant :

- L'achat mobilier peut devenir récurrent via saisons, réassort, réseau et nouveaux modèles.

Aboutissant :

- Compte client/partenaire qui garde l'historique et propose les prochains achats.

DoD :

- Historique commandes/réservations.
- Suggestions réassort.
- Alertes containers à venir.
- Favoris/sélections.

## 12. Ordre recommandé des travaux

### 12.1 Prochain sprint

1. Page revendeurs.
2. Repositionnement home.
3. Page qualité sans état vide faible.
4. Finalisation Supabase Auth public : `VITE_SUPABASE_ANON_KEY`.
5. E2E parcours direct pro et admin.

### 12.2 Sprint suivant

1. Deal registration minimal.
2. Devis co-brandé.
3. Pricing partenaire protégé.
4. Admin partenaires.
5. Contenu SEO/GEO de base.

### 12.3 Avant lancement sérieux

1. Stripe live et webhook production.
2. Resend/Supabase SMTP.
3. Migrations Supabase alignées.
4. Dossier conformité produit.
5. 5 à 10 revendeurs beta.
6. 10 à 20 prospects restaurants/hôtels beta.
7. Audit mobile + accessibilité + performance.

## 13. KPI à suivre

### Acquisition

- Visites catalogue.
- Visites stock 24h.
- Visites page revendeurs.
- Sources trafic.
- Requêtes SEO longues.

### Conversion

- Taux ajout quantité.
- Taux demande devis.
- Taux réservation.
- Taux demande stock 24h.
- Taux formulaire partenaire.

### Canal

- Nombre de partenaires validés.
- Deals enregistrés.
- Deals protégés convertis.
- Volume par partenaire.
- Conflits de canal.

### Opérationnel

- Remplissage container.
- Nombre de séries confirmées.
- Marge moyenne par canal.
- Délai de réponse admin.
- Documents qualité publiés.
- Taux erreurs paiement/réservation.

## 14. Règles de travail pour les futures IA

Toute IA qui intervient sur le projet doit :

1. Lire ce document avant de proposer une stratégie.
2. Lire `docs/DECISIONS.md` avant de modifier une règle métier.
3. Ne pas exposer de secrets, marges internes ou données sensibles.
4. Préserver le modèle hybride revendeur protégé + direct pro encadré.
5. Ajouter des tests quand une règle de prix, quantité, réservation ou packing change.
6. Vérifier le rendu mobile et desktop pour les changements frontend importants.
7. Mettre à jour `docs/CHANGELOG.md` et `docs/PROGRESS.md` quand un chantier est significatif.
8. Ne pas remplacer la stratégie par une landing page générique.
9. Favoriser les parcours qui créent du cash : stock 24h, devis, partenaires, réservation.
10. Garder une écriture client simple : volume, qualité, marge, délai, protection.

## 15. Messages et angles de communication

Messages forts possibles :

- "Votre centrale d'import mobilier CHR, sans immobiliser votre stock."
- "Prix direct import, qualité vérifiée, volume mutualisé."
- "Revendeurs : votre client reste votre client."
- "Restaurants et hôtels : équipez en volume sans payer le prix stockiste."
- "Stock 24h pour les urgences, container mutualisé pour les économies."
- "Voyez le container se remplir avant de vous engager."
- "Des prix bas parce que la logistique est mutualisée, pas parce que la qualité est sacrifiée."

Éviter :

- "Prix le moins cher du marché" sans preuve.
- "Grossiste" seul, trop générique.
- "Marketplace" si le modèle reste propriétaire.
- "Révolutionnaire" sans démonstration concrète.
- "Marge" côté client public.

## 16. Risques majeurs et parades

| Risque                                        | Impact                         | Parade                                                                  |
| --------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Revendeurs ne partagent pas le site           | Acquisition partenaire faible  | Deal registration + co-branding + prix nets cachés                      |
| Clients ne comprennent pas le délai container | Abandon                        | Process visuel + stock 24h + FAQ délais                                 |
| Site perçu comme peu fiable car prix bas      | Méfiance qualité               | Trust Ledger + documents + photos + contrôles                           |
| Trop peu de stock immédiat                    | Conversion urgente faible      | Présenter stock 24h comme solution séparée, pas comme catalogue complet |
| Erreurs de packing 3D                         | Perte de confiance             | Tests géométriques + fallback 2D + explication dépassement              |
| Conflit légal prix revente                    | Risque juridique               | Prix conseillé non obligatoire, liberté revendeur                       |
| Supabase/Auth incomplet                       | Admin et comptes inutilisables | Config publique anon key + tests prod                                   |
| Stripe/Emails non finalisés                   | Parcours cassé                 | Checklist lancement avant trafic payant                                 |
| Contenu trop générique                        | Pas de SEO/GEO                 | Guides précis basés sur vrais cas d'achat                               |

## 17. Sources et observations marché

Ces sources doivent guider la stratégie, sans être copiées :

- FranceAgriMer, études consommation hors domicile 2023-2024 : https://www.franceagrimer.fr/sites/default/files/2026-05/Rapport%20complet_Etudes%20FranceAgriMer_CHD%20Multifili%C3%A8res_CIRCANA_2023-2024.pdf
- CCI Paris Ile-de-France, prix de revente et prix imposé : https://www.entreprises.cci-paris-idf.fr/web/reglementation/nos-produits/docpratic/actualites-juridiques/comment-determiner-prix-revente-produit-bien
- DGCCRF / economie.gouv.fr, revente à perte : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/revente-perte-quelles-sont-les-obligations-du-vendeur
- EUR-Lex, Règlement UE 2023/988 sécurité générale des produits : https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0988
- Ecomaison, obligations professionnels mobilier : https://ecomaison.com/professionnels/vos-obligations-reglementaires/organiser-la-reprise/
- Baymard Institute, product tables pour catalogues B2B complexes : https://baymard.com/blog/use-product-tables-for-desktop-product-listings
- Channeltivity, deal registration et protection partenaire : https://www.channeltivity.com/blog/prm-best-practices-deal-registration/
- xAmplify, deal registration best practices : https://xamplify.com/deal-registration-best-practices/
- Drewry World Container Index, contexte fret maritime : https://www.drewry.co.uk/wci
- EMH CHR, observation concurrente catalogue/stock/service : https://www.emh-chr.com/
- Richard Diffusion, observation concurrente catalogue CHR et disponibilité : https://www.richard-diffusion.fr/

Lecture stratégique des concurrents :

- Les acteurs établis rassurent avec stock, historique, livraison et catalogue large.
- Pros Import doit rassurer autrement : transparence, volume, prix net, preuve qualité, outil revendeur, visualisation container.
- Le manque de gros stock n'est pas une faiblesse si la plateforme explique clairement la différence entre stock 24h et import volume.

## 18. Questions ouvertes à arbitrer

- Durée exacte de protection partenaire : 90, 120 ou 180 jours ?
- Partenaire apporteur simple vs revendeur validé : un seul statut ou deux statuts ?
- Commission apporteur si Pros Import facture directement un prospect protégé ?
- Seuils exacts des remises client 2%, 6%, 10%.
- Conditions d'accès au prix net partenaire.
- Faut-il masquer certains produits aux directs pros et les réserver aux partenaires ?
- Quelle politique de livraison post-port en V2 ?
- Quel niveau de documents qualité minimum avant publication d'un produit ?
- Quel nom de marque final : Pros Import, Container Club, ou architecture double ?

## 19. Conclusion opérationnelle

Le projet doit créer du cash avec peu de stock en vendant trois choses à la fois :

1. Du mobilier professionnel importé en volume.
2. De la confiance opérationnelle : qualité, conformité, container, délais.
3. Une infrastructure commerciale pour revendeurs : protection, prix net, devis, assets.

La plateforme devient forte si elle donne à chaque acteur une raison de revenir :

- Le restaurateur revient pour suivre le container, comparer et réassortir.
- Le revendeur revient pour enregistrer ses opportunités et vendre avec marge.
- Pros Import revient pour piloter le remplissage, les marges et les priorités.

Chaque chantier doit être évalué avec cette question :

> Est-ce que cela aide à remplir un container, convertir du stock, protéger un partenaire ou augmenter la confiance ?

Si la réponse est non, ce n'est probablement pas prioritaire.
