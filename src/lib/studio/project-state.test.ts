import { describe, expect, it } from 'vitest'

import { item, option, seat, stock } from './fixtures.test-helpers'
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
const open: FulfillmentContext = {
  stock: [],
  options: [option('chair', 'standard_production')],
  productionOpen: true,
}

describe('état projet', () => {
  it('projet vide → feasibility_review avec empty_project (jamais un dead-end)', () => {
    expect(computeProjectState([])).toEqual({
      state: 'feasibility_review',
      lines: [],
      reasons: ['empty_project'],
    })
  })

  it('50 chaises, production ouverte → reservation_ready', () => {
    const result = computeProjectState([evaluate(item('chair', 50), chair, open)])
    expect(result.state).toBe('reservation_ready')
    expect(result.reasons).toEqual([])
  })

  it('6 chaises servies par le stock → reservation_ready sans container', () => {
    const context: FulfillmentContext = { stock: [stock('chair', 10)], options: [], productionOpen: false }
    const result = computeProjectState([evaluate(item('chair', 6), chair, context)])
    expect(result.state).toBe('reservation_ready')
  })

  it('6 chaises sans stock → feasibility_review avec below_moq sur la ligne', () => {
    const result = computeProjectState([evaluate(item('chair', 6), chair, open)])
    expect(result.state).toBe('feasibility_review')
    expect(result.lines).toEqual([
      { productId: 'chair', variantId: 'chair-std', reasons: ['below_moq'] },
    ])
  })

  it('50 chaises, production NON ouverte → auto_quote_ready (devis ferme, réservation à confirmer)', () => {
    const result = computeProjectState([
      evaluate(item('chair', 50), chair, { ...open, productionOpen: false }),
    ])
    expect(result.state).toBe('auto_quote_ready')
    expect(result.reasons).toEqual(['production_not_open'])
  })

  it('un prix non confirmé ou un coloris spécial impose manual_quote_required, prioritaire', () => {
    const pendingPrice = seat('pending', {
      dataQuality: { price: { status: 'pending', source: 'none' } },
    })
    const mixed = computeProjectState([
      evaluate(item('chair', 6), chair, open),
      evaluate(item('pending', 50), pendingPrice, {
        ...open,
        options: [option('pending', 'standard_production')],
      }),
    ])
    expect(mixed.state).toBe('manual_quote_required')
    expect(mixed.reasons).toContain('price_unconfirmed')
    expect(mixed.reasons).toContain('below_moq')

    const custom = computeProjectState([
      evaluate(item('chair', 50, { customColour: true }), chair, open),
    ])
    expect(custom.state).toBe('manual_quote_required')
    expect(custom.reasons).toEqual(['custom_colour_requested'])
  })

  it('un produit sur demande → manual_quote_required même en grande quantité', () => {
    const onRequest = seat('or', { visibility: 'on_request' })
    const result = computeProjectState([
      evaluate(item('or', 200), onRequest, { ...open, options: [option('or', 'standard_production')] }),
    ])
    expect(result.state).toBe('manual_quote_required')
    expect(result.reasons).toEqual(['on_request_product'])
  })

  it('les raisons sont structurées par ligne et dédoublonnées', () => {
    const result = computeProjectState([
      evaluate(item('chair', 6), chair, open),
      evaluate(item('chair', 7, { variantId: 'chair-std' }), chair, open),
    ])
    expect(result.reasons).toEqual(['below_moq'])
    expect(result.lines).toHaveLength(2)
  })
})
