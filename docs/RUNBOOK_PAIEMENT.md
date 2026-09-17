# Runbook — ouvrir le paiement en ligne

Le site ouvre en **mode devis** : le client compose son panier, renseigne ses
coordonnées et sa livraison, puis reçoit son devis. Rien n'est encaissé en
ligne. Terrassea reçoit le même devis, rappelle sous 24 h ouvrées et transmet
ses coordonnées bancaires pour engager la commande.

Le code de paiement Stripe n'a pas été supprimé : il est court-circuité par
une seule constante.

```ts
// src/lib/reservations/mode.ts
export const RESERVATION_MODE: ReservationMode = 'quote' // → 'payment'
```

## Ce que la bascule change

| Surface | `quote` | `payment` |
|---|---|---|
| Bouton du panier et de l'étape 4 | « Recevoir mon devis » | « Confirmer et payer X € » |
| Fin du tunnel | écran de confirmation | redirection Stripe Checkout |
| Récap prix | « À la commande (par virement) » | « À payer aujourd'hui » |
| E-mail client | « Votre devis Terrassea », sans ligne à régler | « Réservation enregistrée » + montant dû |
| E-mail Terrassea | « Devis … à rappeler », avec livraison et note | « Nouvelle résa … » |
| Espace compte | rappel de la suite (notre appel) | bouton « Retenter le paiement » |
| Réassurance | « Devis gratuit · aucun paiement en ligne » | badges Stripe, 3D Secure |

Aucune autre ligne n'est à toucher, et aucune migration n'est nécessaire :
les réservations sont déjà écrites en base dans les deux modes, avec le même
statut `pending_reservation_fee`.

## À vérifier AVANT de basculer

La base de production n'a jamais porté une seule transaction : aucune
société, aucune réservation, aucun paiement, aucune facture. Le tunnel Stripe
n'a donc jamais tourné de bout en bout, ici comme en production. Cette liste
n'est pas une formalité — c'est la recette qui manque.

- [ ] `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` présents dans
      l'environnement Cloudflare (pas seulement en local).
- [ ] Endpoint webhook déclaré côté Stripe sur le domaine de production, et
      `checkout.session.completed` reçu au moins une fois pour de vrai.
- [ ] Un paiement réel de bout en bout, avec une vraie carte, petit montant :
      redirection → paiement → retour sur `/account/reservations/<id>` →
      statut passé → e-mail de confirmation reçu → facture émise.
- [ ] Un paiement **abandonné** : retour avec `?canceled=true`, réservation
      conservée, bouton « Retenter le paiement » fonctionnel.
- [ ] Le TVA du RPC de réservation lu côté serveur et non repris du payload
      client (`v_vat_rate`) — sans quoi un appel forgé persiste `vat_amount`
      à 0. Sans effet en mode devis, bloquant dès qu'on encaisse.
- [ ] Le bucket `reservation-quotes` créé par migration et non à la main, et
      vérifié privé dans le Dashboard.
- [ ] Les relances de paiement (`api/cron/payment-reminders`) testées sur une
      réservation impayée.

Tant que ces cases ne sont pas cochées, laisser `RESERVATION_MODE` sur
`quote` : un devis qui arrive vaut mieux qu'un paiement qui échoue en
silence.
