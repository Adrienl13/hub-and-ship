import { describe, expect, it } from 'vitest'

import { item, option, seat, stock, variant } from './fixtures.test-helpers'
import { resolveFulfillment } from './fulfillment'
import type { FulfillmentContext } from './types'

const product = seat('chair-a')
const standard = option('chair-a', 'standard_production')

function context(overrides: Partial<FulfillmentContext> = {}): FulfillmentContext {
  return { stock: [], options: [standard], productionOpen: true, ...overrides }
}

describe('fulfillment : le MOQ ne bloque jamais', () => {
  it('6 unités sous un MOQ de 50 sans stock → manual_review + below_moq, jamais une erreur', () => {
    const result = resolveFulfillment(item('chair-a', 6), product, context())
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['below_moq'])
    expect(result.minimumRequired).toBe(50)
  })

  it('le stock réel est vérifié AVANT le MOQ : 6 unités avec 30 en stock → stock', () => {
    const result = resolveFulfillment(
      item('chair-a', 6),
      product,
      context({ stock: [stock('chair-a', 30)] }),
    )
    expect(result.mode).toBe('stock')
    expect(result.reasons).toEqual([])
    expect(result.priceBasis).toBe('stock')
    expect(result.stockLineIds).toEqual(['stock-chair-a'])
  })

  it('stock partiel : manual_review avec below_moq ET stock_insufficient', () => {
    const result = resolveFulfillment(
      item('chair-a', 20),
      product,
      context({ stock: [stock('chair-a', 12)] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['below_moq', 'stock_insufficient'])
    expect(result.stockAvailable).toBe(12)
  })

  it('le stock d’un autre coloris ne compte pas', () => {
    const result = resolveFulfillment(
      item('chair-a', 6),
      product,
      context({ stock: [stock('chair-a', 100, { variantId: 'chair-a-autre' })] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.stockAvailable).toBe(0)
  })

  it('quantité ≥ MOQ → standard_production, ouverte ou non', () => {
    expect(resolveFulfillment(item('chair-a', 50), product, context())).toMatchObject({
      mode: 'standard_production',
      reasons: [],
      optionId: standard.id,
    })
    expect(
      resolveFulfillment(item('chair-a', 60), product, context({ productionOpen: false })),
    ).toMatchObject({ mode: 'standard_production', reasons: ['production_not_open'] })
  })

  it("53 unités (hors pas de 10) restent une quantité valide", () => {
    expect(resolveFulfillment(item('chair-a', 53), product, context()).mode).toBe(
      'standard_production',
    )
  })

  it('sous MOQ avec un regroupement CONFIRMÉ couvrant la quantité → grouped_production', () => {
    const grouped = option('chair-a', 'grouped_production', {
      minQuantity: 5,
      maxQuantity: 40,
      confirmedBy: 'admin-uuid',
    })
    const result = resolveFulfillment(
      item('chair-a', 8),
      product,
      context({ options: [standard, grouped] }),
    )
    expect(result.mode).toBe('grouped_production')
    expect(result.optionId).toBe(grouped.id)
  })

  it('un regroupement NON confirmé ne fabrique pas de disponibilité', () => {
    const grouped = option('chair-a', 'grouped_production', { minQuantity: 5 })
    const result = resolveFulfillment(
      item('chair-a', 8),
      product,
      context({ options: [standard, grouped] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['below_moq'])
  })

  it('une option expirée ou pas encore ouverte est ignorée', () => {
    const now = new Date('2026-09-08T10:00:00Z')
    const expired = option('chair-a', 'standard_production', { expiresAt: '2026-09-01T00:00:00Z' })
    const future = option('chair-a', 'standard_production', {
      id: 'future',
      availableFrom: '2026-12-01',
    })
    const result = resolveFulfillment(
      item('chair-a', 50),
      product,
      context({ options: [expired, future], now }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['no_fulfillment_path'])
  })
})

describe('fulfillment : minimum coloris et cas spéciaux', () => {
  it('un coloris à minimum 70 impose colour_minimum même au-dessus du MOQ', () => {
    const top = seat('top-a', {
      category: 'table_top',
      moqUnits: 15,
      variants: [variant('top-a-bleu', { minOrderUnits: 70 })],
      studio: { studioRole: 'tabletop', seatKind: null, material: 'metal', modelFamilyId: null, visualTraits: null, dataQuality: {} },
    })
    const result = resolveFulfillment(
      item('top-a', 20, { variantId: 'top-a-bleu', role: 'tabletop' }),
      top,
      context({ options: [option('top-a', 'standard_production', { minQuantity: 15 })] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['colour_minimum'])
    expect(result.minimumRequired).toBe(70)
  })

  it('coloris RAL ou dimensions spéciales = confirmation usine, même avec du stock', () => {
    const colour = resolveFulfillment(
      item('chair-a', 60, { customColour: true }),
      product,
      context({ stock: [stock('chair-a', 100)] }),
    )
    expect(colour.mode).toBe('manual_review')
    expect(colour.reasons).toEqual(['custom_colour_requested'])
    const dims = resolveFulfillment(
      item('chair-a', 60, { customDimensions: true }),
      product,
      context(),
    )
    expect(dims.reasons).toEqual(['custom_tabletop_requested'])
  })

  it("un produit sur demande part toujours en étude, même au-dessus du MOQ", () => {
    const onRequest = seat('chair-b', { visibility: 'on_request' })
    const result = resolveFulfillment(item('chair-b', 100), onRequest, context())
    expect(result).toMatchObject({ mode: 'manual_review', reasons: ['on_request_product'] })
  })

  it('une quantité nulle ou négative est traitée comme 1, sans exception', () => {
    expect(() => resolveFulfillment(item('chair-a', 0), product, context())).not.toThrow()
    expect(resolveFulfillment(item('chair-a', -3), product, context()).mode).toBe('manual_review')
  })
})
