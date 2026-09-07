import { describe, expect, it } from 'vitest'

import { confirmedOption, item, option, seat, stock, variant } from './fixtures.test-helpers'
import { confirmedFulfillmentPaths, resolveFulfillment } from './fulfillment'
import type { FulfillmentContext } from './types'

const product = seat('chair-a')
/** Option semée par la migration : série standard connue, NON confirmée. */
const seeded = option('chair-a', 'standard_production')

function context(overrides: Partial<FulfillmentContext> = {}): FulfillmentContext {
  return { stock: [], options: [seeded], ...overrides }
}

describe('fulfillment : le MOQ ne bloque jamais', () => {
  it('6 unités sous un MOQ de 50 sans stock → manual_review + below_moq, jamais une erreur', () => {
    const result = resolveFulfillment(item('chair-a', 6), product, context())
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['below_moq'])
    expect(result.confirmed).toBe(false)
    expect(result.minimumRequired).toBe(50)
  })

  it('cas C — le stock réel est vérifié AVANT le MOQ : 8 unités avec 10 en stock → stock confirmé', () => {
    const result = resolveFulfillment(
      item('chair-a', 8),
      product,
      context({ stock: [stock('chair-a', 10)] }),
    )
    expect(result.mode).toBe('stock')
    expect(result.reasons).toEqual([])
    expect(result.confirmed).toBe(true)
    expect(result.priceBasis).toBe('stock')
    expect(result.stockLineIds).toEqual(['stock-chair-a'])
  })

  it('stock insuffisant ne fabrique aucune disponibilité : below_moq + stock_insufficient, non confirmé', () => {
    const result = resolveFulfillment(
      item('chair-a', 20),
      product,
      context({ stock: [stock('chair-a', 12)] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['below_moq', 'stock_insufficient'])
    expect(result.confirmed).toBe(false)
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

  it("cas A — quantité ≥ MOQ sur l'option seed_moq NON confirmée → standard_production non confirmée (production_unconfirmed)", () => {
    const result = resolveFulfillment(item('chair-a', 50), product, context())
    expect(result).toMatchObject({
      mode: 'standard_production',
      reasons: ['production_unconfirmed'],
      confirmed: false,
      optionId: seeded.id,
    })
  })

  it('cas B — standard_production CONFIRMÉE pour ce produit → voie confirmée', () => {
    const confirmed = confirmedOption('chair-a', 'standard_production')
    const result = resolveFulfillment(
      item('chair-a', 50),
      product,
      context({ options: [seeded, confirmed] }),
    )
    expect(result).toMatchObject({
      mode: 'standard_production',
      reasons: [],
      confirmed: true,
      optionId: confirmed.id,
    })
  })

  it('une confirmation limitée à un autre coloris ne confirme pas celui-ci', () => {
    const other = confirmedOption('chair-a', 'standard_production', { variantId: 'chair-a-autre' })
    const result = resolveFulfillment(
      item('chair-a', 50),
      product,
      context({ options: [seeded, other] }),
    )
    expect(result.confirmed).toBe(false)
    expect(result.reasons).toEqual(['production_unconfirmed'])
  })

  it("53 unités (hors pas de 10) restent une quantité valide", () => {
    expect(resolveFulfillment(item('chair-a', 53), product, context()).mode).toBe(
      'standard_production',
    )
  })

  it('cas E — sous MOQ avec un regroupement CONFIRMÉ couvrant la quantité → grouped_production confirmée', () => {
    const grouped = confirmedOption('chair-a', 'grouped_production', {
      minQuantity: 5,
      maxQuantity: 40,
    })
    const result = resolveFulfillment(
      item('chair-a', 20),
      product,
      context({ options: [seeded, grouped] }),
    )
    expect(result.mode).toBe('grouped_production')
    expect(result.confirmed).toBe(true)
    expect(result.optionId).toBe(grouped.id)
  })

  it('cas D — 20 unités, MOQ 50, sans stock ni regroupement confirmé → manual_review below_moq, projet valide', () => {
    const groupedUnconfirmed = option('chair-a', 'grouped_production', { minQuantity: 5 })
    const result = resolveFulfillment(
      item('chair-a', 20),
      product,
      context({ options: [seeded, groupedUnconfirmed] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['below_moq'])
    expect(result.confirmed).toBe(false)
  })

  it('une option expirée ou pas encore ouverte est ignorée, même confirmée', () => {
    const now = new Date('2026-09-08T10:00:00Z')
    const expired = confirmedOption('chair-a', 'standard_production', {
      expiresAt: '2026-09-01T00:00:00Z',
    })
    const future = confirmedOption('chair-a', 'standard_production', {
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

describe('fulfillment : voies confirmées par produit', () => {
  it("l'option seed_moq n'est jamais une voie confirmée", () => {
    expect(confirmedFulfillmentPaths('chair-a', context())).toEqual([])
  })

  it('stock réel, standard confirmée et regroupement confirmé sont les trois seules voies', () => {
    const paths = confirmedFulfillmentPaths('chair-a', {
      stock: [stock('chair-a', 3)],
      options: [
        seeded,
        confirmedOption('chair-a', 'standard_production'),
        confirmedOption('chair-a', 'grouped_production'),
        option('chair-a', 'grouped_production'),
      ],
    })
    expect(paths).toEqual(['stock', 'standard_production', 'grouped_production'])
  })

  it('une confirmation sur un autre produit ne confirme rien ici', () => {
    expect(
      confirmedFulfillmentPaths('chair-a', {
        stock: [],
        options: [confirmedOption('chair-b', 'standard_production')],
      }),
    ).toEqual([])
  })

  it('filtrée par coloris : le stock et les options d’un autre coloris ne comptent pas', () => {
    const paths = confirmedFulfillmentPaths(
      'chair-a',
      {
        stock: [stock('chair-a', 3, { variantId: 'chair-a-autre' })],
        options: [confirmedOption('chair-a', 'standard_production', { variantId: 'chair-a-autre' })],
      },
      'chair-a-std',
    )
    expect(paths).toEqual([])
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
      context({ options: [confirmedOption('top-a', 'standard_production', { minQuantity: 15 })] }),
    )
    expect(result.mode).toBe('manual_review')
    expect(result.reasons).toEqual(['colour_minimum'])
    expect(result.minimumRequired).toBe(70)
  })

  it('cas F — coloris RAL ou dimensions spéciales = confirmation usine, même avec du stock ou une voie confirmée', () => {
    const colour = resolveFulfillment(
      item('chair-a', 60, { customColour: true }),
      product,
      context({ stock: [stock('chair-a', 100)] }),
    )
    expect(colour.mode).toBe('manual_review')
    expect(colour.reasons).toEqual(['custom_colour_requested'])
    expect(colour.confirmed).toBe(false)
    const dims = resolveFulfillment(
      item('chair-a', 60, { customDimensions: true }),
      product,
      context({ options: [confirmedOption('chair-a', 'standard_production')] }),
    )
    expect(dims.reasons).toEqual(['custom_tabletop_requested'])
    expect(dims.confirmed).toBe(false)
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
