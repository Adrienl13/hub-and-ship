// Comment se termine le tunnel de réservation.
//
//   'quote'    Le client va jusqu'au bout — panier, coordonnées, livraison —
//              et reçoit son devis. Rien n'est encaissé sur le site : le
//              devis part par e-mail au client ET à Terrassea, qui rappelle
//              avec ses coordonnées bancaires pour engager la commande.
//
//   'payment'  Le client règle les frais de réservation par carte (Stripe
//              Checkout) à la fin du tunnel.
//
// Choix du 18 septembre 2026, avant ouverture : `quote`. Stripe est en place
// dans le code mais n'a jamais tourné de bout en bout en production — aucun
// paiement réel, aucun webhook reçu, aucune facture émise. Et dans les faits
// la majorité des professionnels appellent avant de commander : un devis
// sous les yeux des deux côtés vaut mieux qu'un paiement à l'aveugle.
//
// Pour ouvrir le paiement plus tard : passer cette constante à 'payment',
// après avoir vérifié en production la clé Stripe, le webhook, l'e-mail de
// confirmation et la facture. Rien d'autre n'est à toucher — le code de
// paiement n'est pas supprimé, il est seulement court-circuité. La recette
// est dans docs/RUNBOOK_PAIEMENT.md.
export type ReservationMode = 'quote' | 'payment'

export const RESERVATION_MODE: ReservationMode = 'quote'

/** Le tunnel s'arrête au devis : aucun encaissement sur le site. */
export function isQuoteMode(mode: ReservationMode = RESERVATION_MODE): boolean {
  return mode === 'quote'
}
