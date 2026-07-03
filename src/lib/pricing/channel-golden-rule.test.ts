import { describe, expect, it } from 'vitest'

import { PRODUCTS } from '@/lib/products'
import {
  resolveChannelUnitPrice,
  violatesGoldenRule,
  worstDirectUnitPrice,
  type SalesChannel,
} from './channel'

/**
 * PERMANENT, BLOCKING invariant (decision #1): for every product, the worst
 * direct price (max volume discount, −10%) must stay STRICTLY greater than the
 * resolved reseller price. Failure of this test = failure of the build.
 */
describe('golden rule — worst direct price > reseller price (all products)', () => {
  const resellerChannels: ReadonlyArray<SalesChannel> = [
    'revendeur',
    'distributeur',
  ]

  it('holds for every product on every reseller channel', () => {
    expect(PRODUCTS.length).toBeGreaterThan(0)
    for (const product of PRODUCTS) {
      const worstDirect = worstDirectUnitPrice(product.basePriceHt)
      for (const channel of resellerChannels) {
        const resolved = resolveChannelUnitPrice({
          basePriceHt: product.basePriceHt,
          channel,
        })
        expect(
          worstDirect,
          `${product.sku} (${channel}): worst direct ${worstDirect} must exceed ${resolved}`,
        ).toBeGreaterThan(resolved)
        expect(
          violatesGoldenRule({ basePriceHt: product.basePriceHt, channel }),
        ).toBe(false)
      }
    }
  })

  it('keeps grand_compte at the best direct tier (never below reseller-only pricing)', () => {
    for (const product of PRODUCTS) {
      const grandCompte = resolveChannelUnitPrice({
        basePriceHt: product.basePriceHt,
        channel: 'grand_compte',
      })
      // grand_compte is a direct-channel deal: equal to the worst direct price,
      // and strictly above any reseller price.
      expect(grandCompte).toBe(worstDirectUnitPrice(product.basePriceHt))
      expect(grandCompte).toBeGreaterThan(
        resolveChannelUnitPrice({
          basePriceHt: product.basePriceHt,
          channel: 'revendeur',
        }),
      )
    }
  })
})
