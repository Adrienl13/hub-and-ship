# Suivi du trafic — Google Tag Manager + Google Analytics 4

Objectif : mesurer précisément d'où viennent les visiteurs (Google Business
Profile, recherche, Instagram, campagnes) et ce qu'ils font (catalogue,
panier, réservation, paiement, formulaires), sans toucher au code à chaque
nouveau besoin : les tags se gèrent dans Tag Manager.

## 1. Ce que le site envoie déjà (dataLayer)

Le code pousse chaque événement du parcours dans `window.dataLayer` (et vers
Plausible, s'il est configuré) avec le même nom :

| Événement (nom exact)      | Quand                                             | Données utiles                      |
| -------------------------- | ------------------------------------------------- | ----------------------------------- |
| `add_to_cart`              | 1re quantité ajoutée sur une fiche                | `sku`, `quantity`, `value` (€ HT)   |
| `reserve_open`             | ouverture du tunnel de réservation                |                                     |
| `reserve_step`             | passage d'étape dans le tunnel                    | `step`                              |
| `reservation_submit`       | réservation enregistrée en base                   | `reference`, `value`, `total_ht`    |
| `checkout_redirect`        | départ vers la page de paiement Stripe            |                                     |
| `checkout_cancel`          | retour de Stripe sans payer                       |                                     |
| `reservation_paid`         | retour de Stripe avec session (avant vérification)|                                     |
| `reservation_fee_paid`     | **frais encaissés, confirmés côté serveur**       | `reservation`, `value`              |
| `contact_submit`           | formulaire de contact envoyé                      | `topic`                             |
| `custom_colorway_request`  | demande de coloris personnalisé                   | `sku`                               |
| `stock_request_submit`     | demande sur un lot Stock 24h                      | `persisted`                         |
| `partner_request_submit`   | candidature partenaire                            |                                     |
| `quote_pdf`, `share_selection`, `notify_signup`, `review_submit`, `siret_blocked` | actions secondaires | |

Événements e-commerce GA4 standard (objet `ecommerce`, rapports « Monétisation »
sans configuration) : `add_to_cart`, `begin_checkout` (à la réservation, avec
les lignes), `purchase` (frais de réservation encaissés, `transaction_id` =
id de réservation).

L'attribution première visite (`utm_source`, `utm_medium`, `utm_campaign`,
`partner_ref`) est déjà capturée par le site et stockée sur chaque lead et
réservation (colonnes `utm_*` en base) — indépendamment de Google.

## 2. Mise en place (une fois)

1. **Google Tag Manager** : créer un conteneur Web → récupérer l'identifiant
   `GTM-XXXXXXX`.
2. **Google Analytics 4** : créer une propriété → flux Web → récupérer l'ID
   de mesure `G-XXXXXXXX`. Dans le flux, activer la **mesure améliorée**
   (vues de page sur changement d'historique : indispensable, le site est une
   application monopage).
3. **Cloudflare** : variable de build `VITE_GTM_ID=GTM-XXXXXXX` (Workers →
   Settings → Variables and Secrets, type *build*), puis redéployer. Sans
   cette variable, aucun tag Google n'est chargé.
4. **Dans GTM** :
   - Tag « Google Tag » (GA4) avec l'ID `G-…`, déclencheur *All Pages*.
   - Tag « GA4 Event » : nom d'événement `{{Event}}`, déclencheur *Custom
     Event* avec regex
     `add_to_cart|begin_checkout|purchase|reserve_open|reserve_step|reservation_submit|checkout_redirect|checkout_cancel|reservation_fee_paid|contact_submit|custom_colorway_request|stock_request_submit|partner_request_submit|quote_pdf|share_selection|notify_signup`
     (cocher « Envoyer les données e-commerce » → source *Data Layer*).
   - Publier le conteneur.
5. **Dans GA4 → Admin → Événements** : marquer comme **conversions**
   `reservation_fee_paid`, `reservation_submit`, `contact_submit`,
   `stock_request_submit`, `partner_request_submit`.

## 3. Consentement (RGPD / CNIL)

Consent Mode v2 est actif : tout est « denied » au chargement, un bandeau
propose Accepter / Refuser, la décision est mémorisée 6 mois (`cc_consent`)
et modifiable via « Gérer mes cookies » (pied de page). Sans acceptation,
GA4 ne dépose aucun cookie ; les cookies publicitaires restent refusés dans
tous les cas (la politique cookies l'annonce). Pour activer le remarketing
Google Ads un jour : mettre à jour la politique cookies ET
`buildConsentUpdate` (src/lib/analytics/consent.ts).

## 4. Google Business Profile, Search Console, Ads

- **Fiche Google Business** : dans la fiche, renseigner le site avec des
  paramètres de campagne, par ex.
  `https://prosimport.com/?utm_source=google&utm_medium=organic&utm_campaign=business_profile`
  → le trafic issu de la fiche apparaît dans GA4 (Acquisition) ET dans la
  colonne `utm_source` des leads/réservations en base.
- **Search Console** : Admin GA4 → Liens Search Console → associer la
  propriété : requêtes et pages d'entrée dans GA4.
- **Google Ads** : Admin GA4 → Liens Google Ads → importer les conversions
  GA4 (`reservation_fee_paid` en priorité).

## 5. Vérifier

- Onglet GTM « Preview » (Tag Assistant) sur https://prosimport.com : les
  événements du tableau apparaissent en naviguant, `purchase` au retour d'un
  paiement test.
- GA4 → Rapports → Temps réel : la page vue et l'événement `add_to_cart`
  après un ajout au panier.
- Navigateur : le cookie `_ga` n'existe qu'après « Accepter ».
