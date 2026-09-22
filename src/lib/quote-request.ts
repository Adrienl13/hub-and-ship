// Demande de devis pour UN modèle, depuis la fiche ou le tiroir catalogue.
//
// Elle emprunte le canal du formulaire de contact (/api/contact) : un devis
// pour un modèle est une conversation par email, pas une réservation. Ce qui
// change, c'est le sujet — « Demande de devis », pour que la notification
// interne se distingue d'une simple question — et le corps, composé ici
// pour que rien d'utile ne manque au rappel : référence, design, quantité,
// prix affiché.

export const QUOTE_REQUEST_TOPIC = 'devis' as const

export interface QuoteRequestModel {
  readonly name: string
  readonly ref: string
  /** Design / coloris choisi ; absent depuis la fiche produit. */
  readonly design?: string | null
  readonly qty: number
  /** Prix affiché au moment de la demande (« 83,26 € »), sans « HT ». */
  readonly priceLabel?: string | null
  readonly moq?: number | null
  /** Précisions libres du client : délai, livraison, autres modèles. */
  readonly note?: string | null
}

export function buildQuoteRequestMessage(model: QuoteRequestModel): string {
  const lines = [`Demande de devis — ${model.name} (${model.ref})`]
  if (model.design) lines.push(`Design : ${model.design}`)
  lines.push(`Quantité : ${model.qty} pièces`)
  if (model.priceLabel) {
    lines.push(
      `Prix catalogue : ${model.priceLabel} HT / pièce${
        model.moq ? `, dès ${model.moq} pièces` : ''
      }`,
    )
  }
  const note = model.note?.trim()
  if (note) lines.push('', note)
  return lines.join('\n')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contrôle côté navigateur, avant l'appel réseau. Le serveur revalide tout
 * (src/lib/contact.ts) ; ici on évite seulement un aller-retour pour un
 * champ vide, avec un message en français plutôt qu'un 400.
 */
export function validateQuoteRequest(fields: {
  readonly name: string
  readonly email: string
}): { readonly ok: true } | { readonly ok: false; readonly error: string } {
  if (fields.name.trim().length < 2) {
    return {
      ok: false,
      error: 'Indiquez votre nom pour que nous puissions vous répondre.',
    }
  }
  if (!EMAIL.test(fields.email.trim())) {
    return {
      ok: false,
      error: 'Indiquez une adresse email valide : le devis vous y sera envoyé.',
    }
  }
  return { ok: true }
}
