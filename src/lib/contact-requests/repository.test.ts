import { describe, expect, it, vi } from 'vitest'

import { buildContactMessageDraft } from '@/lib/contact'
import {
  insertContactRequest,
  toContactRequestInsertPayload,
} from './repository'

function draftFrom(input: Record<string, unknown>) {
  const result = buildContactMessageDraft({
    name: 'Camille Test',
    email: 'Camille@Hotel-Test.FR',
    message: 'Bonjour, pouvez-vous me rappeler pour un projet terrasse ?',
    ...input,
  })
  if (!result.ok) throw new Error(result.error)
  return result.draft
}

describe('contact requests repository', () => {
  it('mappe un devis rapide vers les colonnes de la table, statut new implicite', () => {
    const payload = toContactRequestInsertPayload(
      draftFrom({
        topic: 'devis',
        source: 'catalogue_quick_quote',
        company: 'Hôtel Test',
        phone: '06 00 00 00 00',
        product: {
          sku: 'BIS-061',
          name: 'Fauteuil de bistrot',
          design: 'cannage rouge / crème',
          quantity: 50,
          priceLabel: '83,26 €',
        },
        attribution: { utm_source: 'meta', partner_ref: 'agence-x' },
      }),
    )

    expect(payload).toEqual({
      topic: 'devis',
      source: 'catalogue_quick_quote',
      name: 'Camille Test',
      email: 'camille@hotel-test.fr',
      company: 'Hôtel Test',
      phone: '06 00 00 00 00',
      message: 'Bonjour, pouvez-vous me rappeler pour un projet terrasse ?',
      product_sku: 'BIS-061',
      product_name: 'Fauteuil de bistrot',
      product_design: 'cannage rouge / crème',
      quantity: 50,
      price_label: '83,26 €',
      studio_brief: null,
      utm_source: 'meta',
      utm_medium: null,
      utm_campaign: null,
      partner_ref: 'agence-x',
    })
    // Le statut et la note interne restent à la base : la politique RLS
    // publique exige status = new et internal_note null.
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('internal_note')
  })

  it('garde le brief Studio dans sa colonne et annexé au message', () => {
    const payload = toContactRequestInsertPayload(
      draftFrom({ studioBrief: 'ROPE : bleu — Sur demande' }),
    )
    expect(payload.source).toBe('studio_brief')
    expect(payload.studio_brief).toBe('ROPE : bleu — Sur demande')
    expect(payload.message).toContain('ROPE : bleu — Sur demande')
    expect(payload.product_sku).toBeNull()
    expect(payload.quantity).toBeNull()
  })

  it('insère sans .select() (aucune lecture publique) et ne retourne rien', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const from = vi.fn((table: 'contact_requests') => {
      expect(table).toBe('contact_requests')
      return { insert }
    })

    await expect(
      insertContactRequest({ from }, draftFrom({ topic: 'produit' })),
    ).resolves.toBeUndefined()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'produit', source: 'contact_page' }),
    )
  })

  it('remonte une erreur lisible quand Supabase refuse la ligne', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async () => ({ error: { message: 'RLS denied' } })),
      })),
    }
    await expect(insertContactRequest(client, draftFrom({}))).rejects.toThrow(
      'RLS denied',
    )
  })
})
