import { describe, expect, it } from 'vitest'

import { confirmedOption, item, option, seat, stock } from './fixtures.test-helpers'
import { resolveFulfillment } from './fulfillment'
import { computeProjectState, type ProjectLineEvaluation } from './project-state'
import { computeReadiness } from './readiness'
import type { FulfillmentContext, StudioProduct, StudioProjectItem } from './types'

function evaluate(
  line: StudioProjectItem,
  product: StudioProduct,
  context: FulfillmentContext,
): ProjectLineEvaluation {
  return {
    item: line,
    readiness: computeReadiness(product, context, line.variantId),
    fulfillment: resolveFulfillment(line, product, context),
  }
}

const chair = seat('chair')
/** Exactement l'état après la migration 39 : option seed_moq non confirmée. */
const seededOnly: FulfillmentContext = {
  stock: [],
  options: [option('chair', 'standard_production')],
}
const confirmedStandard: FulfillmentContext = {
  stock: [],
  options: [option('chair', 'standard_production'), confirmedOption('chair', 'standard_production')],
}

describe('état projet', () => {
  it('projet vide → feasibility_review avec empty_project (jamais un dead-end)', () => {
    expect(computeProjectState([])).toEqual({
      state: 'feasibility_review',
      lines: [],
      reasons: ['empty_project'],
    })
  })

  it('cas A — 50 chaises (MOQ 50), option seed_moq, aucun stock, aucune confirmation → auto_quote_ready, PAS reservation_ready', () => {
    const result = computeProjectState([evaluate(item('chair', 50), chair, seededOnly)])
    expect(result.state).toBe('auto_quote_ready')
    expect(result.reasons).toEqual(['production_unconfirmed'])
  })

  it('cas B — même produit, standard_production confirmée explicitement → reservation_ready', () => {
    const result = computeProjectState([evaluate(item('chair', 50), chair, confirmedStandard)])
    expect(result.state).toBe('reservation_ready')
    expect(result.reasons).toEqual([])
  })

  it('cas C — 8 chaises servies par 10 en stock → reservation_ready malgré le MOQ 50', () => {
    const context: FulfillmentContext = { stock: [stock('chair', 10)], options: [] }
    const result = computeProjectState([evaluate(item('chair', 8), chair, context)])
    expect(result.state).toBe('reservation_ready')
  })

  it('cas D — 20 chaises sans stock suffisant ni regroupement confirmé → feasibility_review, below_moq sur la ligne, jamais bloqué', () => {
    const result = computeProjectState([evaluate(item('chair', 20), chair, seededOnly)])
    expect(result.state).toBe('feasibility_review')
    expect(result.lines).toEqual([
      { productId: 'chair', variantId: 'chair-std', reasons: ['below_moq'] },
    ])
    const partial = computeProjectState([
      evaluate(item('chair', 20), chair, { ...seededOnly, stock: [stock('chair', 12)] }),
    ])
    expect(partial.state).toBe('feasibility_review')
    expect(partial.reasons).toEqual(['below_moq', 'stock_insufficient'])
  })

  it('cas E — regroupement confirmé couvrant 20 unités → reservation_ready', () => {
    const grouped = confirmedOption('chair', 'grouped_production', { minQuantity: 10, maxQuantity: 40 })
    const result = computeProjectState([
      evaluate(item('chair', 20), chair, { ...seededOnly, options: [...seededOnly.options, grouped] }),
    ])
    expect(result.state).toBe('reservation_ready')
  })

  it('cas F — coloris RAL ou dimensions spéciales → manual_quote_required, jamais une réservation automatique', () => {
    const custom = computeProjectState([
      evaluate(item('chair', 50, { customColour: true }), chair, confirmedStandard),
    ])
    expect(custom.state).toBe('manual_quote_required')
    expect(custom.reasons).toEqual(['custom_colour_requested'])
    const dims = computeProjectState([
      evaluate(item('chair', 50, { customDimensions: true }), chair, {
        ...confirmedStandard,
        stock: [stock('chair', 100)],
      }),
    ])
    expect(dims.state).toBe('manual_quote_required')
  })

  it('une seule ligne non confirmée empêche reservation_ready pour tout le projet', () => {
    const other = seat('other')
    const result = computeProjectState([
      evaluate(item('chair', 50), chair, confirmedStandard),
      evaluate(item('other', 50), other, { stock: [], options: [option('other', 'standard_production')] }),
    ])
    expect(result.state).toBe('auto_quote_ready')
    expect(result.lines[1]?.reasons).toEqual(['production_unconfirmed'])
  })

  it('un prix non confirmé ou un coloris spécial impose manual_quote_required, prioritaire', () => {
    const pendingPrice = seat('pending', {
      dataQuality: { price: { status: 'pending', source: 'none' } },
    })
    const mixed = computeProjectState([
      evaluate(item('chair', 6), chair, seededOnly),
      evaluate(item('pending', 50), pendingPrice, {
        stock: [],
        options: [confirmedOption('pending', 'standard_production')],
      }),
    ])
    expect(mixed.state).toBe('manual_quote_required')
    expect(mixed.reasons).toContain('price_unconfirmed')
    expect(mixed.reasons).toContain('below_moq')
  })

  it('un produit sur demande → manual_quote_required même en grande quantité', () => {
    const onRequest = seat('or', { visibility: 'on_request' })
    const result = computeProjectState([
      evaluate(item('or', 200), onRequest, { stock: [], options: [confirmedOption('or', 'standard_production')] }),
    ])
    expect(result.state).toBe('manual_quote_required')
    expect(result.reasons).toEqual(['on_request_product'])
  })

  it('les raisons sont structurées par ligne et dédoublonnées', () => {
    const result = computeProjectState([
      evaluate(item('chair', 6), chair, seededOnly),
      evaluate(item('chair', 7, { variantId: 'chair-std' }), chair, seededOnly),
    ])
    expect(result.reasons).toEqual(['below_moq'])
    expect(result.lines).toHaveLength(2)
  })
})
