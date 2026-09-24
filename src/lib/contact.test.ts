import { describe, expect, it } from 'vitest'

import { buildContactMessageDraft, CONTACT_SOURCES } from './contact'

const VALID = {
  name: 'Marie Martin',
  email: 'Marie@Resto-Provence.FR',
  company: '  Bistrot du Port  ',
  phone: '',
  topic: 'container',
  message: 'Bonjour, 60 chaises + 15 tables pour une terrasse à Marseille ?',
}

describe('buildContactMessageDraft', () => {
  it('accepts a valid message, lowercasing email and nulling blanks', () => {
    const result = buildContactMessageDraft(VALID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.email).toBe('marie@resto-provence.fr')
    expect(result.draft.company).toBe('Bistrot du Port')
    expect(result.draft.phone).toBeNull()
    expect(result.draft.topic).toBe('container')
    expect(result.draft.source).toBe('contact_page')
    expect(result.draft.product).toBeNull()
    expect(result.draft.studioBrief).toBeNull()
  })

  it('defaults the topic to autre when omitted', () => {
    const result = buildContactMessageDraft({ ...VALID, topic: undefined })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.topic).toBe('autre')
  })

  it('rejects a short message, a bad email and a non-object payload', () => {
    expect(buildContactMessageDraft({ ...VALID, message: 'court' }).ok).toBe(
      false,
    )
    expect(buildContactMessageDraft({ ...VALID, email: 'nope' }).ok).toBe(false)
    expect(buildContactMessageDraft(null).ok).toBe(false)
    expect(buildContactMessageDraft('x').ok).toBe(false)
  })

  it('rejects an unknown topic instead of coercing it', () => {
    expect(buildContactMessageDraft({ ...VALID, topic: 'spam' }).ok).toBe(false)
  })

  it('accepte chaque source connue et refuse une source inconnue', () => {
    for (const source of CONTACT_SOURCES) {
      const result = buildContactMessageDraft({ ...VALID, source })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.draft.source).toBe(source)
    }
    expect(
      buildContactMessageDraft({ ...VALID, source: 'newsletter' }).ok,
    ).toBe(false)
  })

  it('normalise le produit concerné (design/prix vides → null)', () => {
    const result = buildContactMessageDraft({
      ...VALID,
      topic: 'devis',
      source: 'catalogue_quick_quote',
      product: {
        sku: ' BIS-061 ',
        name: 'Fauteuil de bistrot MONTMARTRE',
        design: '',
        quantity: 50,
        priceLabel: '83,26 €',
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.product).toEqual({
      sku: 'BIS-061',
      name: 'Fauteuil de bistrot MONTMARTRE',
      design: null,
      quantity: 50,
      priceLabel: '83,26 €',
    })
  })

  it('accepte un produit sans quantité ni prix (coloris, plateau)', () => {
    const result = buildContactMessageDraft({
      ...VALID,
      source: 'custom_colorway',
      product: { sku: 'ROP-001', name: 'Chaise Cannes', design: 'Noir' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.product).toEqual({
      sku: 'ROP-001',
      name: 'Chaise Cannes',
      design: 'Noir',
      quantity: null,
      priceLabel: null,
    })
  })

  it('refuse un produit sans référence ou avec une quantité non entière positive', () => {
    expect(
      buildContactMessageDraft({
        ...VALID,
        product: { sku: '', name: 'Chaise Cannes' },
      }).ok,
    ).toBe(false)
    expect(
      buildContactMessageDraft({
        ...VALID,
        product: { sku: 'ROP-001', name: 'Chaise Cannes', quantity: 0 },
      }).ok,
    ).toBe(false)
    expect(
      buildContactMessageDraft({
        ...VALID,
        product: { sku: 'ROP-001', name: 'Chaise Cannes', quantity: 1.5 },
      }).ok,
    ).toBe(false)
  })

  it('garde le brief Studio en colonne dédiée, l’annexe au message et déduit la source', () => {
    const result = buildContactMessageDraft({
      ...VALID,
      studioBrief: 'ROPE : bleu — Sur demande',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.studioBrief).toBe('ROPE : bleu — Sur demande')
    expect(result.draft.message).toBe(
      VALID.message +
        '\n\nPROJET STUDIO — DÉCLARATION CLIENT À REVALIDER (aucun devis ferme)\nROPE : bleu — Sur demande',
    )
    expect(result.draft.source).toBe('studio_brief')
  })

  it('une source explicite prime sur la déduction depuis le brief', () => {
    const result = buildContactMessageDraft({
      ...VALID,
      source: 'contact_page',
      studioBrief: 'ROPE : bleu',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.source).toBe('contact_page')
  })
})
