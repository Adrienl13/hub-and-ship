import { describe, expect, it } from 'vitest'

import {
  QUOTE_REQUEST_TOPIC,
  buildQuoteRequestMessage,
  validateQuoteRequest,
} from './quote-request'
import { CONTACT_TOPICS, CONTACT_TOPIC_LABEL } from './contact'

describe('demande de devis pour un modèle', () => {
  it('compose un message complet depuis le tiroir', () => {
    const message = buildQuoteRequestMessage({
      name: 'Fauteuil de bistrot MONTMARTRE - cannage rouge / crème',
      ref: 'BIS-061',
      design: 'cannage rouge / crème',
      qty: 50,
      priceLabel: '83,26 €',
      moq: 50,
      note: '  Livraison souhaitée avant le 15 mars.  ',
    })
    expect(message).toBe(
      [
        'Demande de devis — Fauteuil de bistrot MONTMARTRE - cannage rouge / crème (BIS-061)',
        'Design : cannage rouge / crème',
        'Quantité : 50 pièces',
        'Prix catalogue : 83,26 € HT / pièce, dès 50 pièces',
        '',
        'Livraison souhaitée avant le 15 mars.',
      ].join('\n'),
    )
  })

  it('se passe du design et du prix depuis la fiche produit', () => {
    const message = buildQuoteRequestMessage({
      name: 'Chaise Cannes',
      ref: 'ROP-001',
      qty: 60,
    })
    expect(message).toBe(
      'Demande de devis — Chaise Cannes (ROP-001)\nQuantité : 60 pièces',
    )
    expect(message.length).toBeGreaterThanOrEqual(10) // minimum de /api/contact
  })

  it('a son propre sujet, accepté par le formulaire de contact', () => {
    expect(CONTACT_TOPICS).toContain(QUOTE_REQUEST_TOPIC)
    expect(CONTACT_TOPIC_LABEL[QUOTE_REQUEST_TOPIC]).toBe('Demande de devis')
  })

  it('refuse un nom ou un email manquant, en français', () => {
    expect(validateQuoteRequest({ name: 'A', email: 'a@b.fr' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('nom'),
    })
    expect(
      validateQuoteRequest({ name: 'Camille', email: 'pas-un-email' }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('email') })
    expect(
      validateQuoteRequest({ name: 'Camille', email: 'c@hotel.fr' }),
    ).toEqual({ ok: true })
  })
})
