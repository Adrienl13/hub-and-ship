# Passage de relais Claude Code — chantiers prioritaires

> Derniere mise a jour : 2026-06-07
> Branche active : `codex/seo-geo-foundation`
> Dernier commit fonctionnel : voir `git log --oneline -5`
> Prod verifiee : `https://prosimport.com/p/chr-conseil?deploy=09757d8`
> Dernier deploy Cloudflare : `6b96d65d-b07d-45a5-b268-56dc60d1d3ce`

Ce document sert de point d'entree court pour reprendre le chantier avec Claude Code ou une autre IA. Lire aussi `docs/PLATFORM_STRATEGY.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md` et `docs/KNOWN_ISSUES.md`.

## Objectif produit

Pros Import / Container Club doit devenir une centrale d'import digitale pour mobilier CHR : utile aux restaurateurs/hotels en direct, mais surtout suffisamment sure pour que les revendeurs partagent la plateforme sans craindre de perdre leurs clients.

Regles non negociables :

- Ne jamais exposer les prix nets partenaires publiquement.
- Ne jamais exposer les marges internes.
- Ne pas imposer de prix minimum de revente aux revendeurs.
- Le site public peut vendre en direct, mais tout prospect apporte par un partenaire doit etre protege.
- Les donnees prospects partenaires doivent rester admin-only.
- Ne pas remettre de numero EORI public dans le site.

## Etat reel au 2026-06-07

Fait et pousse sur GitHub :

- Page publique `/partenaires` avec positionnement revendeur protege, FAQ conflit canal, formulaire demande partenaire et mode "proteger une opportunite".
- Page publique `/p/{slug}` co-brandee pour qu'un revendeur puisse partager une entree Pros Import sans exposer ses prix nets.
- Page `/p/{slug}` enrichie avec un bloc dynamique "Attribution en coulisses" pour expliquer le lien capte, le projet reconnu, le deal protege et les prix nets prives.
- Tracker global de lien partenaire : capture `/p/{slug}` et les query params `partner`, `partner_slug`, `revendeur` dans `localStorage` pendant 120 jours.
- Reservation enrichie : le contexte partenaire est copie dans `contact_snapshot.partner_context` pour conserver la preuve d'origine.
- Fondation IA livree : `public/llms.txt` + declaration dans `robots.txt`, sans prix nets partenaires, marges internes ni EORI.
- API `/api/partner-requests` same-origin, validation Zod, refus origin externe, persistance service role quand Supabase est pret.
- Migration creee : `supabase/migrations/20260606190000_partner_applications_and_deals.sql`.
- Migration creee : `supabase/migrations/20260606210000_partner_attribution_on_reservations.sql`.
- Migration creee : `supabase/migrations/20260607090000_partner_link_attribution.sql`.
- Tables cible : `partner_applications`, `partner_deals`.
- Reservations enrichies : `partner_deal_id`, `partner_application_id`, `partner_attribution_reason`, `partner_attribution_snapshot`.
- RLS cible : admin-only pour lecture/ecriture directe ; le public passe par l'endpoint serveur.
- Onglet admin `Partenaires` pour lire, filtrer et changer les statuts.
- Onglet admin `Reservations` enrichi avec badge interne "Deal partenaire reconnu", "Partenaire reconnu" ou "Lien partenaire capte".
- Fallback local : si l'API/persistance echoue, le lead est sauvegarde dans `localStorage`.
- Tests ajoutes : builder partenaire, matching attribution, API, migrations securite, E2E partenaires/API.
- Deploy Cloudflare effectue : version `fe56b3be-8185-43a4-88ef-d7b648c73ffd`.
- Deploy Cloudflare attribution effectue : version `d2010af1-46b3-4e3c-94ce-7f0353fde8be`.
- Deploy Cloudflare lien partenaire effectue : version `6b96d65d-b07d-45a5-b268-56dc60d1d3ce`.

Validation passee :

```bash
npm run check
npm run test:security
npm run build
npx playwright test tests/e2e/site-audit.spec.ts --grep "partner|partenaire|API"
npx playwright test tests/e2e/site-audit.spec.ts --grep "partner|partenaire|/p/"
```

Point bloque important — RESOLU le 2026-06-07 (Claude Code) :

- ~~Les migrations Supabase partenaires n'ont pas ete appliquees au projet distant.~~ **Appliquees** sur `mkfztwibolswqcggukeq` via le MCP Supabase (les 3 migrations partenaires + une migration de durcissement `20260607140000_harden_partner_attribution_function_grants.sql`). Voir `docs/KNOWN_ISSUES.md` ISSUE-001 et ISSUE-002.
- Verifie en prod : `POST /api/partner-requests` et `POST /api/stock-requests` renvoient `201 persisted:true` ; attribution reservation (SIRET / email pro / lien co-brande) validee ; fonctions d'attribution revoquees pour anon/authenticated (admin/service-only).
- Restent NON appliquees au distant (hors scope P0 partenaires, a traiter separement) : `20260605183000_create_reservation_with_items_rpc.sql` (bascule le checkout public sur un RPC et ferme les policies anon INSERT ; le front prod appelle deja le RPC avec fallback legacy, donc a appliquer apres verification du bundle deploye).
- Divergence connue : l'historique de migration distant contient des migrations absentes du dossier local (`stock_lines*`, `admin_save_product_full_audit`, `stock_lines_cascade_on_delete`, `admin_save_product_full_zero_variant_guard`) — la branche locale a ete creee avant. A reconcilier lors d'un prochain `supabase db pull`.

## Reprise conseillee pour Claude Code

Ordre de travail recommande, sans redemarrer l'analyse depuis zero :

1. **Debloquer Supabase prod** : appliquer les migrations partenaires, verifier les secrets Worker, tester `/api/partner-requests`, `/admin?tab=partners`, `/admin?tab=reservations`.
2. **Rendre l'admin operable** : ajouter les actions qui permettent a Adrien de piloter les leads, reservations, partenaires et contenus sans toucher au code.
3. **Construire le portail partenaire** : espace authentifie, slugs, deals, selections partageables, documents et prix nets proteges.
4. **Completer le portail client** : reservations, paiements, documents, factures, SAV, profil et notifications.
5. **Renforcer les pages header** : chaque entree publique doit avoir un role clair dans la conversion, le SEO/GEO et la confiance.
6. **Structurer la visibilite IA** : rendre Pros Import comprehensible, citable et nommable par Google AI Overviews, ChatGPT Search, Perplexity, Claude, Mistral et autres moteurs generatifs.

Ne pas commencer par des effets visuels decoratifs. Les animations sont utiles si elles rendent le modele plus lisible : remplissage container, progression reservation, confiance qualite, preuves, statuts et transitions de decisions.

## Cartographie par surface

### Surface publique / Header

Source principale : `src/components/Header.tsx`.

Entrees actuelles :

- Logo `Container Club` -> `/#top`
- `Catalogue` -> `/catalogue`
- `Stock 24h` -> `/stock-24h`
- `Partenaires` -> `/partenaires`
- `Comment ça marche` -> `/#comment`
- `Containers livrés` -> `/livres`
- `Qualité & Tests` -> `/qualite`
- `FAQ` -> `/faq`
- Bouton `Mon compte` -> `/account/reservations`
- Bouton admin visible aux admins -> `/admin`
- CTA global `Réserver`

Chantiers par entree :

| Entree            | Etat                                               | Priorite | Chantiers a faire                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue         | Fonctionnel, cartes portrait, panier, 3D lazy, **filtres avances (prix max / MOQ max / classe feu M1 / empilable, 2026-06-07)** | P1       | Brancher donnees Supabase live, mode comparaison dense desktop, ~~filtres avances empilable/MOQ~~ (fait — reste dimensions/matiere si attributs ajoutes), sauvegarde selection, import/export catalogue admin, vrais visuels et documents. |
| Stock 24h         | Fonctionnel avec endpoint serveur + fallback local | P1       | Gerer le stock depuis l'admin, decrementer/reserver les lots, notifier Adrien, convertir une demande stock en reservation/devis, afficher delais et quantites fiables.                                   |
| Partenaires       | Fonctionnel public + intake API                    | P0/P1    | Appliquer migrations, creer slugs, relier comptes partenaires, dashboard partenaire, deal registration complet, selections/devis co-brandes, prix nets proteges.                                         |
| Comment ça marche | Ancre home seulement                               | P2       | Creer route SEO `/comment-ca-marche`, expliquer achat groupé, paiement, transport rendu port, 20'/40', risques, calendrier, difference stock 24h vs container.                                           |
| Containers livrés | Pages publiques et admin existants                 | P2       | Relier aux vraies donnees, photos, timeline, documents qualite, chiffres de remplissage, retours client, preuve sociale exportable.                                                                      |
| Qualité & Tests   | Carnet de preuves public, upload admin             | P1       | Publier vrais PDF SGS/Eurofins, relier rapports aux produits/categories, signed URLs auth, rappels admin documents manquants, schema SEO FAQ/Article.                                                    |
| FAQ               | Page publique simple                               | P2       | FAQ recherchable, categories direct/partenaire/transport/paiement/qualite, JSON-LD FAQPage, liens vers pages utiles.                                                                                     |
| Mon compte        | Reservations liste/detail                          | P1       | Dashboard client, factures, documents, paiements, SAV, parrainage, profil/RGPD, actions sur reservation.                                                                                                 |
| Admin             | Dashboard + onglets                                | P1       | Command center, exports, filtres, audit log visible, actions batch, droits/roles, 2FA admin.                                                                                                             |

DoD public header :

- Aucun lien mort ou ancre fragile.
- Chaque page a titre, description, canonical, schema quand pertinent.
- Mobile verifie sur header, CTA, formulaires et longues listes.
- Les prix nets partenaires et marges internes restent absents du public.

### Chantier experience dynamique / animations

Objectif : rendre le site plus vivant et memorisable sans perdre le cote outil pro. Les animations doivent aider a comprendre, pas faire "landing page gadget".

Animations recommandees :

- Apparition progressive douce des sections au scroll avec `prefers-reduced-motion`.
- Compteurs KPI animes sur home, stock 24h, containers livres, qualite.
- Animation du remplissage container et des seuils 20'/40' dans le panier.
- Transitions sur cartes catalogue : image, variante, MOQ, quantite, ajout panier.
- Feedback micro-interaction : ajout panier, sauvegarde selection, copie lien partenaire, demande envoyee.
- Timeline animee sur "Comment ca marche", reservation, qualite, container livre.
- Skeletons propres pour les donnees Supabase au lieu d'etats vides.
- Admin : transitions de statut visibles, badges qui se mettent a jour, alertes Command Center.
- Partenaire : animation de protection deal/lien co-brande pour rendre le concept clair.

Garde-fous :

- Toujours respecter `prefers-reduced-motion`.
- Ne pas animer les tableaux denses ou longs catalogues de maniere lourde.
- Pas de layout shift quand les images/cartes apparaissent.
- Eviter les animations qui ralentissent mobile ou augmentent trop le bundle.
- Les animations 3D restent lazy-load, jamais dans le bundle initial.

Fichiers de depart :

- `src/styles/globals.css`
- `src/routes/index.tsx`
- `src/routes/catalogue.tsx`
- `src/components/OrderSidebar.tsx`
- `src/components/ContainerScene.tsx`
- `src/components/ProductCard.tsx`
- `src/components/ReservationDialog.tsx`
- `src/routes/p.$partnerSlug.tsx`

DoD animations :

- Lighthouse mobile ne regresse pas.
- Aucun chevauchement texte/UI sur mobile.
- Les composants restent utilisables clavier/screen reader.
- Playwright capture au moins un parcours catalogue + reservation apres animations.

### Portail admin

Route : `/admin`, fichier principal `src/routes/admin.tsx`.

Onglets actuels :

- `overview`
- `stock-requests`
- `reservations`
- `products`
- `containers`
- `quality`
- `carriers`
- `partners`
- `users`

Etat et chantiers :

| Onglet admin   | Etat actuel                                                       | Priorite | A faire                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vue generale   | KPIs + snapshot partiellement demo                                | P1       | Command Center reel : leads non traites, paiements en attente, deals a qualifier, documents manquants, container proche 80%, alerts Supabase/Stripe/stock.         |
| Demandes stock | DB-backed + transitions + fallback demo                           | P1       | Attribution responsable, relance, conversion en devis/reservation, export CSV, recherche avancee, historique contact, suppression RGPD.                            |
| Reservations   | DB live, transitions statut, notes, lien Stripe, badge partenaire | P0/P1    | Verifier prod apres migrations, ajouter vue detail admin, actions paiement/remboursement, timeline audit, documents/factures, filtre partenaire, export comptable. |
| Catalogue      | CRUD produits/variants/commitments                                | P1       | Images multiples, documents produit, prix par role, marges non publiques, import CSV, validation MOQ/increment, preview public, gestion stock 24h liee.            |
| Containers     | CRUD containers livres/actifs                                     | P1       | Distinguer container actif vs historique, seuils 20/40, depart estime, participants, reservations rattachees, remplissage live, cloture/archivage.                 |
| Qualite        | CRUD rapports + upload PDF                                        | P1       | Relier rapports a produits/containers, statut documents requis, expiration/validite, preview public, acces client auth, alertes documents manquants.               |
| Transporteurs  | CRUD carrier_partners                                             | P2       | Zones, tarifs indicatifs, contacts, delais, statut actif, demande client -> transporteur, comparatif par region.                                                   |
| Partenaires    | Lecture/filtre/status candidatures et deals                       | P0/P1    | Creer/editer `partner_referral_slug`, lier user au partenaire, notes internes, pipeline deal, protection 120/180j, attribution test, export, timeline.             |
| Utilisateurs   | Onglet lazy existant                                              | P1       | Gestion roles, invitation admin/partenaire, relation `partner_users`, suspension, magic link, 2FA admin, audit des changements.                                    |

Chantier admin le plus impactant apres Supabase :

1. ~~Ajouter dans `AdminPartnersTab` l'edition du slug public partenaire.~~ **FAIT (2026-06-07)** — editeur "Lien partageable" sur chaque carte candidature/deal (slug normalise + valide cote DB).
2. ~~Ajouter une action "Creer lien partageable" qui produit `/p/{slug}`.~~ **FAIT (2026-06-07)** — apercu de l'URL absolue + copie presse-papier + indicateur d'attribution active/en attente. Repo : `updatePartnerApplicationSlug` / `updatePartnerDealSlug` (+ tests).
3. ~~Ajouter une vue detail partenaire : candidatures, deals, reservations attribuees, statut, notes.~~ **FAIT (2026-06-07)** — notes internes editables (candidatures + deals), expansion "Detail" par candidature montrant les deals lies et les reservations attribuees (chargees a la demande via `listAllReservations`). Repo : `updatePartnerApplicationNote` / `updatePartnerDealNote` (+ tests).
4. ~~Ajouter dans `ReservationsAdminPanel` des filtres rapides : partenaire, paiement, container, 40' demande, statut.~~ **FAIT (2026-06-07)** — filtres origine partenaire / paiement (frais payes vs en attente) / type container (20'/40') + bouton "Reinitialiser" (statut + recherche deja presents).
5. ~~Ajouter un "Command Center" en haut de `/admin` avec les 5 urgences du jour.~~ **FAIT partiellement (2026-06-07)** — Command Center live en haut de l'overview avec 3 urgences fiables (leads stock `new`, partenaires a qualifier = candidatures new/reviewing + deals submitted, reservations `pending_reservation_fee`), cartes cliquables vers l'onglet concerne. `src/lib/admin/command-center.ts` + tests. **Reste a ajouter** quand les modeles seront prets : containers proches de 80% (remplissage live) et documents qualite manquants.

Fichiers de depart :

- `src/routes/admin.tsx`
- `src/components/AdminPartnersTab.tsx`
- `src/components/AdminCatalogueTab.tsx`
- `src/components/AdminContainersTab.tsx`
- `src/components/AdminQualityReportsTab.tsx`
- `src/components/AdminCarrierPartnersTab.tsx`
- `src/components/AdminUsersTab.tsx`
- `src/lib/admin/dashboard.ts`
- `src/lib/partners/repository.ts`
- `src/lib/account/admin-reservations.repository.ts`
- `src/lib/supabase/types.ts`

DoD admin :

- Un admin peut traiter une demande partenaire, proteger un deal, voir l'attribution reservation et exporter le suivi. **Export CSV livre (2026-06-07)** sur Reservations, Stock, Partenaires (candidatures + deals) et SAV — respecte les filtres courants (`src/lib/admin/csv.ts`).
- Aucune action admin ne depend d'un fallback local pour la prod.
- Les erreurs Supabase/Stripe sont affichees clairement et testees.
- Les actions sensibles sont tracees via `logAdminAction`.

### Portail client

Routes actuelles :

- `/account/reservations`
- `/account/reservations/$reservationId`

Etat actuel :

- Liste reservations locale + Supabase quand disponible.
- Detail reservation avec lignes, totaux, statut, paiement.
- Retour Stripe gere via `session_id`.
- Pas encore de dashboard client complet.

Chantiers prioritaires :

| Module client        | Priorite | A faire                                                                                                                  |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Dashboard `/account` | ~~P1~~ **FAIT 2026-06-07** | Livre : carte prochaine action (paiement du d'abord), KPIs, paiements en attente, reservations recentes, documents/aide. Hook `useAccountReservations` (Supabase RLS + historique local) partage avec la liste ; helpers `src/lib/account/dashboard.ts` + tests. Header "Mon compte" -> `/account`. Reste : factures PDF reelles, SAV. |
| Reservations         | P1 (partiel) | **FAIT 2026-06-07** : timeline pilotee par statut (reservation->frais->acompte->production->transport->livraison, etats done/current/upcoming + annulee), carte documents reelle (CGV, preuves qualite, statut facture honnete, contact). `src/lib/account/timeline.ts` + tests. Reste : statut paiement/webhook en detail, messages de retard, factures PDF reelles, relance paiement avancee, annulation encadree. |
| Factures/devis       | P1 | **FAIT** : recapitulatif imprimable `/account/reservations/{id}/document` (2026-06-07) ; **facture legale numerotee** (2026-06-08) — table `invoices` + sequence continue `invoice_number_seq`, RPC admin-only `issue_reservation_invoice` (numerotation atomique FAC-NNNNNN, snapshot immuable, refus de doublon), bouton admin "Facturer", facture imprimable `/account/reservations/{id}/facture/{invoiceId}` avec mentions legales FR completes, **envoi email au client a l'emission** (`sendInvoiceEmail`). Reste : acompte/solde separes, avoir. |
| Documents            | P1 (partiel) | **FAIT 2026-06-07** : carte documents reelle sur le detail (recapitulatif PDF, CGV, preuves qualite, statut facture honnete). Reste : rapports qualite du container rattaches a la reservation, fiches techniques, acces signe. |
| Profil societe       | P2       | SIRET, contacts facturation/logistique, adresses, emails, preference transport.                                          |
| SAV / Claims         | P2 (partiel) | **FAIT 2026-06-07** cote client : table `reservation_claims` + RLS (client cree/lit ses reclamations sur ses propres reservations, admin full access), formulaire SAV (categorie/quantite/description) + historique + statut + reponse admin sur le detail reservation. `src/lib/account/claims.ts` + tests. **Cote admin FAIT** : onglet `/admin?tab=claims` (SAV) — liste, filtres, transition de statut, reponse au client ; `src/lib/account/admin-claims.repository.ts` ; carte "Reclamations SAV ouvertes" dans le Command Center. Reste : upload photos, notifications email. |
| Parrainage / avis    | P3       | Credits, invitations, avis verifies post-livraison, emails de relance.                                                   |
| Mobile account nav   | P2       | Navigation compacte reservations/documents/profil/aide.                                                                  |

Fichiers de depart :

- `src/routes/account.reservations.tsx`
- `src/routes/account.reservations.$reservationId.tsx`
- `src/lib/account/reservations.ts`
- `src/lib/reservations/repository.ts`
- `src/lib/reservations/local-history.ts`
- `src/lib/stripe/checkout.ts`
- `src/lib/email/reservation-confirmation.ts`

DoD client :

- Le client comprend toujours "ce que je dois faire maintenant".
- Aucune reservation payee ne reste seulement locale.
- Les documents critiques sont telechargeables.
- Le tunnel fonctionne si Stripe est indisponible, sans faire croire que le paiement est confirme.

### Portail partenaire

Etat actuel :

- **MVP portail authentifie livre (2026-06-07)** : route `/partner` (noindex + robots Disallow), garde `PartnerGuard`, auto-liaison securisee via `claim_partner_access()` (un user ne peut reclamer qu'une candidature `qualified/approved` dont le `contact_email` == son email verifie JWT). Table `partner_users`, helpers `is_partner()` / `current_partner_application_ids()`, RLS scoping (le partenaire ne lit QUE sa candidature, ses deals, ses reservations attribuees ; isolation negative testee). Migration `20260607160000_partner_portal_access.sql`. Dashboard : lien co-brande `/p/{slug}` + copie, deals proteges, reservations attribuees. Lien header gated `useIsPartner`.
- Surfaces publiques existantes : `/partenaires` et `/p/{slug}`.
- Attribution preparee via migrations `partner_applications`, `partner_deals`, `partner_referral_slug`, `partner_application_id`.
- **Selections co-brandees persistantes livrees (2026-06-07)** : migration `20260607180000_partner_selections.sql` (`partner_selections` + `partner_selection_items`, RLS partenaire-CRUD-own / admin-all / public-read-published, snapshot produit = prix public uniquement). Route `/partner/selections` (creer depuis le catalogue, brouillon/publier, copier le lien, modifier, supprimer). Rendu public sur `/p/{slug}?selection={id}` (reutilise la capture lien + attribution existantes). Repo `src/lib/partners/selections.ts` + tests. Isolation anon (publiee vs brouillon) testee.
- Variantes dans le builder de selection : **FAIT (2026-06-07)** — une entree par (produit, variante), quantites par design.
- Creation de deal depuis le portail : **FAIT (2026-06-07)** — formulaire `/partner` (RLS INSERT partenaire limitee a sa candidature + statut `submitted` ; la protection reste admin-only). Migration `20260607200000_partner_self_service_deals.sql`.
- Devis co-brande : **FAIT (2026-06-07)** — vue imprimable `/p/{slug}/devis?selection={id}` (A4 print-to-PDF navigateur, zero dependance) : identite partenaire, ref devis, lignes (qte/PU HT/total), HT/eco/TVA/TTC, conditions. Boutons "Devis" (cartes selections publiees) + "Telecharger le devis" (page publique). Prix publics uniquement.
- **Reste a faire** : edition de deal depuis le portail, documents/assets partageables, reporting attribution, et test positif end-to-end au login d'un vrai partenaire approuve.

Objectif :

Creer un espace ou le revendeur peut utiliser Pros Import comme back-office d'import sans exposer ses marges ni perdre ses clients.

Routes recommandees :

- `/partner` ou `/partenaire/dashboard`
- `/partner/deals`
- `/partner/selections`
- `/partner/documents`
- `/partner/pricing`
- `/partner/settings`

Tables/migrations probables :

- `partner_users` : lien user Supabase -> partenaire valide.
- `partner_selections` : selection produits, quantites, variantes, mode prix public/client.
- `partner_selection_items`.
- `partner_assets` : logos, documents, photos partageables.
- Eventuellement `partner_commissions` si modele apporteur.

Chantiers prioritaires :

| Module partenaire   | Priorite | A faire                                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------------------------- |
| Acces/RLS           | P0/P1    | Role partenaire, liaison user, policies pour voir uniquement ses donnees, admin bypass. |
| Dashboard           | P1       | Deals proteges, reservations attribuees, volume, prochaine action, liens rapides.       |
| Deal registration   | P1       | Soumettre/editer un prospect, statut, duree protection, preuves, historique.            |
| Liens co-brandes    | P1       | Generer slug, selection partageable, statut de capture, QR/link copy.                   |
| Selections          | P1       | Creer selection depuis catalogue, quantites, variantes, commentaire, page partageable.  |
| Prix nets           | P1       | Affichage uniquement authentifie partenaire valide, jamais public ni client final.      |
| Devis PDF co-brande | P1       | Logo/nom partenaire, produits, conditions, prix public/client, contact partenaire.      |
| Documents/assets    | P2       | Photos, fiches techniques, arguments, certificats, garanties.                           |
| Reporting           | P2       | Reservations attribuees, conversion, volume, commission/apporteur si applicable.        |

Regles non negociables portail partenaire :

- Le partenaire ne voit jamais les deals d'un autre partenaire.
- Le client final ne voit jamais le prix net partenaire.
- Le partenaire garde sa liberte de prix de revente.
- Les pages publiques co-brandees doivent rassurer sans promettre une exclusivite commerciale illimitee.

DoD partenaire :

- Un partenaire approuve peut se connecter, creer un deal, partager un lien, voir une reservation attribuee.
- Un client final venant du lien peut reserver sans voir de prix net.
- L'admin voit tout et peut corriger une attribution.

### Pages publiques hors header mais importantes

- `/catalogue/chaises-restaurant` et `/catalogue/tables-restaurant` : pages SEO category, a enrichir avec FAQ, schema, vrais contenus, liens catalogue filtres.
- `/stock-mobilier-terrasse-24h` : landing SEO stock urgent, a relier aux lots reels.
- `/transport-partenaires` : deja creee, a alimenter avec donnees et demandes transport.
- `/legal/*` : textes existants, validation juridique requise avant commercialisation large.
- `/auth/login` et `/auth/callback` : indispensables pour admin/client/partenaire, SMTP Supabase a fiabiliser.

### Visibilite IA / AEO / GEO / LLMO

Clarification : il n'y a pas une "connexion IA" unique a brancher. Pour etre cite ou nomme lors d'une recherche IA, le site doit etre crawlable, comprehensible, structure, fiable et cite sur des requetes longues. Le travail est donc technique + contenu + schema.

Objectif :

- Quand quelqu'un demande a une IA "ou acheter du mobilier CHR par container", "comment reduire le prix de chaises de restaurant en volume", "import mobilier terrasse restaurant France", ou "solution revendeur mobilier CHR", Pros Import doit pouvoir etre compris comme une reponse pertinente.

Chantiers techniques :

- `public/llms.txt` existe deja avec resume clair, pages importantes, proposition de valeur, contacts publics, limites, liens vers catalogue/partenaires/qualite. Le maintenir a jour quand de nouvelles pages strategiques sont creees.
- Verifier `robots.txt` et `sitemap.xml`; passer a un sitemap dynamique si les pages guides/produits deviennent nombreuses.
- Ajouter JSON-LD par type de page : `Organization`, `WebSite`, `BreadcrumbList`, `FAQPage`, `Product`, `Offer`, `ItemList`, `Article`, `HowTo` quand pertinent.
- Ajouter canonical + meta description specifique sur toutes les routes publiques.
- Ajouter OpenGraph/Twitter images propres pour partage LinkedIn/WhatsApp.
- Garder les contenus importants SSR/crawlables, pas seulement dans des states client.
- Ajouter une page `/a-propos` ou `/pros-import` qui explique l'entite, le modele, le role importateur, la difference avec une marketplace.
- Ajouter une page `/contact` indexable avec informations publiques sans EORI.
- Connecter Google Search Console et Bing Webmaster Tools; soumettre sitemap.
- Prevoir IndexNow/Bing si necessaire pour nouvelles pages.

Chantiers contenu :

- Creer des "answer blocks" courts en haut des guides : 40-80 mots, reponse directe, puis details.
- Guides prioritaires :
  - `/guides/import-mobilier-chr-container`
  - `/guides/prix-chaises-restaurant-volume`
  - `/guides/revendeur-mobilier-chr-prix-net`
  - `/guides/container-20-pieds-vs-40-pieds-mobilier`
  - `/guides/moq-chaises-restaurant`
  - `/guides/stock-mobilier-terrasse-24h`
- Chaque guide doit inclure : definition, cas concret, chiffres prudents, limites, FAQ, liens vers catalogue/partenaires/qualite, schema FAQ/Article.
- Utiliser les expressions marque + categorie :
  - "Pros Import"
  - "Container Club"
  - "centrale d'import mobilier CHR"
  - "mobilier terrasse restaurant par container"
  - "achat groupe mobilier outdoor professionnel"
  - "prix net revendeur mobilier CHR"
- Citer les preuves internes : containers livres, rapports qualite, stock 24h, transport rendu port.

Chantiers reputation/citation externe :

- Obtenir quelques liens/citations depuis Terrassea, partenaires, LinkedIn, fiches annuaires B2B, articles conseils.
- Publier des cas reels anonymises : "80 chaises terrasse", "restaurant bord de mer", "revendeur CHR sud".
- Creer une page ou section presse/partenaires quand le reseau existe.

DoD visibilite IA :

- `llms.txt` disponible en prod.
- Sitemap contient les pages guides et pages strategiques.
- Les pages importantes ont JSON-LD valide.
- Les guides repondent clairement aux questions sans contenu generique.
- Aucun contenu IA/SEO n'expose prix nets partenaires, marges internes ou donnees partenaires.

### Prompt final conseille pour Claude Code

```text
Lis d'abord docs/HANDOFF_CLAUDE_CODE.md, docs/PLATFORM_STRATEGY.md, docs/KNOWN_ISSUES.md et docs/PROGRESS.md.
Objectif : reprendre Pros Import / Container Club sans changer la strategie.
Priorite 1 : debloquer Supabase prod et verifier les migrations partenaires.
Priorite 2 : rendre l'admin vraiment operable pour partenaires/reservations/stock.
Priorite 3 : construire le portail partenaire authentifie avec deals, slugs, selections et prix nets proteges.
Priorite 4 : completer le portail client avec documents, factures, paiements et SAV.
Priorite 5 : ajouter la fondation IA/LLMO : llms.txt, schema.org, guides repondant aux vraies questions, sitemap et pages crawlables.
Ne rends jamais publics les prix nets partenaires, les marges internes ou les donnees prospects partenaires.
Avant chaque commit : npm run check, npm run test:security si migration/RLS, npm run build, puis Playwright cible sur les pages touchees.
```

## Priorite P0 — Debloquer la prod data

### P0.1 Appliquer les migrations Supabase partenaires

Pourquoi : sans ces migrations, les leads partenaires ne remontent pas dans l'admin et les reservations ne sont pas attribuees automatiquement aux deals proteges.

Commandes conseillees :

```bash
export SUPABASE_ACCESS_TOKEN=...
npx supabase link --project-ref mkfztwibolswqcggukeq
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Verification :

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('partner_applications', 'partner_deals');

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reservations'
  and column_name in (
    'partner_deal_id',
    'partner_attribution_reason',
    'partner_attribution_snapshot',
    'partner_application_id'
  );
```

Puis tester en prod :

1. Aller sur `https://prosimport.com/partenaires#demande-partenaire`.
2. Soumettre une demande partenaire test.
3. Se connecter admin.
4. Aller sur `/admin?tab=partners`.
5. Verifier que la candidature apparait.

Rollback minimal :

- Ne pas supprimer les tables si des leads existent.
- En cas d'erreur UI, deployer un correctif front ; les tables peuvent rester.

### P0.2 Verifier les secrets Cloudflare

Pourquoi : l'endpoint serveur depend de la service role.

Verifier :

```bash
wrangler secret list
```

Secrets attendus :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- plus tard `RESEND_API_KEY`

### P0.3 Smoke test endpoint partenaire

Apres migration :

```bash
curl -i -X POST "https://prosimport.com/api/partner-requests" \
  -H "content-type: application/json" \
  --data '{
    "mode":"application",
    "partnerKind":"reseller",
    "companyName":"Audit CHR",
    "contactName":"Test Admin",
    "contactEmail":"test+partner@prosimport.com",
    "contactPhone":"+33 6 00 00 00 00",
    "territory":"France",
    "expectedMonthlyVolume":"1 container / trimestre"
  }'
```

Attendu : `201` avec `persisted: true`.

## Priorite P1 — Rendre le modele partenaire vraiment protecteur

### P1.1 Attribution automatique SIRET/email

Statut : implementation code + migration prete, push Supabase distant encore bloque par `SUPABASE_ACCESS_TOKEN`.

Pourquoi : c'est le coeur de la confiance revendeur.

But :

- Quand un client final arrive avec un SIRET/email deja protege, le systeme doit reconnaitre le deal.
- L'UI publique ne doit pas afficher le partenaire sans controle, mais l'admin doit voir l'attribution.

Ce qui est implemente :

- Migration `20260606210000_partner_attribution_on_reservations.sql`.
- Matching priorise : SIRET exact, email exact, domaine email professionnel.
- Exclusion des domaines generiques pour le matching par domaine (`gmail.com`, `orange.fr`, `outlook.com`, etc.).
- Trigger `reservations_set_partner_attribution` avant insert/update SIRET/contact.
- Snapshot admin-only dans `reservations.partner_attribution_snapshot`.
- Module pur `src/lib/partners/attribution.ts` + tests.
- Admin reservations affiche "Deal partenaire reconnu".

Reste a faire apres application Supabase :

- Creer un deal test en statut `protected` avec `protected_until` futur.
- Creer une reservation test avec le meme SIRET/email.
- Verifier `/admin?tab=reservations` : badge deal partenaire.
- Verifier que le public ne voit jamais le nom du partenaire dans le checkout.

Fichiers de depart :

- `src/lib/partners/attribution.ts`
- `src/lib/partners/attribution.test.ts`
- `src/lib/partners/repository.ts`
- `src/lib/partners/submission.ts`
- `supabase/migrations/20260606190000_partner_applications_and_deals.sql`
- `supabase/migrations/20260606210000_partner_attribution_on_reservations.sql`

### P1.2 Espace partenaire authentifie

Pourquoi : les prix nets ne doivent jamais etre publics.

But :

- Route future : `/partner` ou `/partenaire/dashboard`.
- Acces reserve aux comptes valides.
- Voir ses deals, statuts, protections, selections, documents.

Pre-requis :

- RLS par partenaire/organisation.
- Modele `users_profile.role` ou nouvelle relation `partner_users`.
- Admin peut approuver un partenaire et lier un user.

### P1.3 Selections co-brandées

Pourquoi : c'est ce qui donnera envie au revendeur de partager le site.

Statut : MVP lien public implemente, selections persistantes encore a faire.

Ce qui est implemente :

- Route `/p/{slug}` avec hero co-brande, produits vitrines, CTA catalogue et reservation.
- Capture 120 jours du contexte partenaire via `src/components/PartnerLinkTracker.tsx`.
- Module pur `src/lib/partners/link.ts` + tests.
- Snapshot reservation `contact_snapshot.partner_context`.
- Migration `20260607090000_partner_link_attribution.sql` pour matcher un `partner_referral_slug` vers un deal ou une candidature partenaire.
- Admin reservations affiche le signal lien/partenaire sans l'exposer au client.

But :

- Le revendeur cree une selection produit.
- URL partageable : `/p/{slug}/selection/{id}`.
- Page avec identité partenaire, produits, quantites, conditions.
- CTA qui renvoie vers le partenaire ou protege le client.

Ne pas faire :

- Ne pas montrer le prix net partenaire au client final.
- Ne pas forcer un prix de revente.

Prochaines etapes :

- Ajouter generation/edition de `partner_referral_slug` dans l'onglet admin `Partenaires`.
- Creer une table future `partner_selections` quand les migrations distant sont debloquees.
- Ajouter devis PDF co-brande : logo/nom partenaire public, prix public ou prix client, jamais prix net partenaire.
- Ajouter un statut de protection visible dans le futur espace partenaire.

## Priorite P2 — Fiabiliser conversion et operationnel

### P2.1 Emails transactionnels Resend

Infra : `src/lib/email/server.ts` (`sendEmail` no-op gracieux si `RESEND_API_KEY` absent, jamais d'exception), `src/lib/email/templates.ts`, `src/lib/email/notify-leads.ts`.

**ACTIVATION** : poser les secrets Worker `RESEND_API_KEY` et `RESEND_FROM` (domaine verifie Resend) — `wrangler secret put RESEND_API_KEY`. Tant qu'ils sont absents, tous les envois no-op proprement (les leads sont quand meme persistes).

Priorite emails :

1. ~~Demande partenaire recue~~ **FAIT** : admin + confirmation au demandeur (`notifyPartnerRequest`, cable dans `/api/partner-requests`).
2. ~~Opportunite partenaire soumise~~ **FAIT** : meme flux (mode deal).
3. ~~Reservation recue~~ **DEJA EN PLACE** : `src/lib/email/reservation-confirmation.ts` (user + admin), declenche depuis `ReservationDialog`.
4. ~~Paiement webhook confirme~~ **FAIT** : `notifyPaymentConfirmed` (user + admin), declenche dans `/api/stripe/webhook` sur `checkout.session.completed`, construit depuis la session Stripe.
5. ~~Demande stock 24h recue~~ **FAIT** : admin + confirmation (`notifyStockRequest`, cable dans `/api/stock-requests`).

### P2.2 Admin Command Center

Pourquoi : Adrien doit voir les urgences sans fouiller les onglets.

Ajouter dans `/admin` :

- Deals partenaires en attente.
- Demandes stock non traitees.
- Reservations paiement en attente.
- Containers proches de 80%.
- Documents qualite manquants.

Fichiers :

- `src/routes/admin.tsx`
- `src/lib/admin/dashboard.ts`

### P2.3 Production readiness paiement

Pourquoi : le site ne doit pas encaisser en mode fragile.

A faire :

- Stripe live.
- Webhook prod confirme.
- Cas echecs/expiration retestes.
- Retour paiement verifie.
- Mentions CGV valides.

## Priorite P3 — Differenciation et acquisition

### P3.1 Guides SEO/AEO/GEO/LLMO

**Fondation livree (2026-06-07)** : systeme de guides data-driven dans `src/lib/guides/content.ts`, route `/guides` (index) + `/guides/$slug`, answer block 40-80 mots, sections, FAQ, maillage interne, JSON-LD Article + FAQPage + BreadcrumbList (verifies en SSR), ajout au `sitemap.xml`, `llms.txt` et footer. Helpers `articleJsonLd` / `linkListJsonLd`. Pour ajouter un guide : une entree dans `GUIDES`.

Guides livres (5) :

- `/guides/import-mobilier-chr-container` ✅
- `/guides/prix-chaises-restaurant-volume` ✅
- `/guides/container-20-pieds-vs-40-pieds-mobilier` ✅
- `/guides/moq-chaises-restaurant` ✅
- `/guides/prix-net-revendeur-mobilier-chr` ✅

Pages entite livrees : `/a-propos` et `/contact` (indexables, JSON-LD `Organization` + `BreadcrumbList`, ajoutees au footer/sitemap/llms.txt). `/guides/stock-mobilier-terrasse-24h` volontairement non cree (la landing `/stock-mobilier-terrasse-24h` couvre deja ce mot-cle). Pour ajouter un guide : une entree dans `GUIDES`.

Regles :

- Pages utiles, pas generiques.
- Tableaux, FAQ schema, exemples chiffres, limites claires.
- Lien vers catalogue, partenaires, stock 24h.
- Ajouter `llms.txt`, JSON-LD, sitemap a jour et answer blocks courts pour les moteurs generatifs.

### P3.2 Trust Ledger qualite

Pourquoi : prix bas + import = besoin de preuve.

A faire :

- Uploader vrais PDF.
- Relier rapports aux produits/categories.
- Ajouter photos controle, dates, fournisseurs masques si necessaire.
- Eviter tout etat vide anxiogene.

### P3.3 Catalogue scalable

Objectif :

- Supporter 100-150 chaises/fauteuils et 20 tables.

A faire :

- Mode comparaison dense desktop.
- Filtres dimensions/matiere/empilable/MOQ/stock 24h.
- Tests mobile sur longues listes.
- Garder les cartes portrait plein cadre comme rendu principal public.

## Audit rapide avant chaque commit

Toujours lancer :

```bash
npm run check
npm run build
```

Pour les pages publiques/admin :

```bash
npx playwright test tests/e2e/site-audit.spec.ts --grep "partner|partenaire|API"
```

Avant deploy :

```bash
git status --short --branch
npm run check
npm run build
```

Apres deploy :

```bash
curl -I "https://prosimport.com/partenaires?deploy=<sha>"
curl -i "https://prosimport.com/api/partner-requests?deploy=<sha>"
```

## Prompts conseilles pour Claude Code

### Reprise P0

```text
Lis docs/HANDOFF_CLAUDE_CODE.md, docs/PROGRESS.md et docs/KNOWN_ISSUES.md.
Priorite absolue : appliquer ou verifier la migration Supabase partenaires, puis tester un submit reel depuis /partenaires jusqu'a /admin?tab=partners.
Ne change pas le modele commercial. Ne rends pas publics les prix nets partenaires.
```

### Reprise P1

```text
Lis docs/HANDOFF_CLAUDE_CODE.md et docs/PLATFORM_STRATEGY.md.
Implemente l'attribution automatique partenaire par SIRET/email en gardant les donnees prospects admin-only.
Ajoute migration, types, logique metier, tests securite, tests unitaires et mise a jour docs.
```

### Reprise P1 selections co-brandees

```text
Lis docs/HANDOFF_CLAUDE_CODE.md et docs/PLATFORM_STRATEGY.md sections C04/C05.
Reprends le MVP lien partenaire deja implemente via /p/{slug}, puis implemente la premiere version persistante des selections co-brandees revendeur.
Le client final ne doit jamais voir le prix net partenaire.
```

## Definition de "fini" pour le prochain gros jalon

Le prochain jalon est fini quand :

- Une demande partenaire prod est enregistree en DB.
- Une opportunite partenaire prod peut etre protegee depuis l'admin.
- Le systeme reconnait au moins le SIRET client protege.
- Un partenaire valide peut acceder a un espace minimal sans voir les autres partenaires.
- Aucun prix net partenaire n'est visible publiquement.
- `npm run check`, `npm run build` et E2E cibles passent.
