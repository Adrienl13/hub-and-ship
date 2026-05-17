import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PRICING_TIERS,
  calculateOrderPricing,
  type CartLineForPricing,
  type PricingTier,
} from './tiers'

function createLine(
  overrides: Partial<CartLineForPricing> = {},
): CartLineForPricing {
  return {
    productId: 'product-test',
    variantId: 'variant-test',
    variantCombinationId: null,
    quantity: 1,
    cbmPerUnit: 0.1,
    costLanded: 50,
    ecoContribution: 0.5,
    ...overrides,
  }
}

describe('calculateOrderPricing', () => {
  it('returns the default empty result for an empty cart', () => {
    expect(calculateOrderPricing([])).toEqual({
      lines: [],
      totalCbm: 0,
      effectiveMarginPercent: 35,
      subtotalHt: 0,
      ecoContributionTotal: 0,
      totalHt: 0,
    })
  })

  it('prices a simple order entirely in the first tier', () => {
    const result = calculateOrderPricing([
      createLine({ quantity: 5, cbmPerUnit: 0.1, costLanded: 50 }),
    ])

    expect(result.totalCbm).toBe(0.5)
    expect(result.effectiveMarginPercent).toBe(35)
    expect(result.lines[0]?.unitPriceHt).toBe(68)
    expect(result.subtotalHt).toBe(340)
  })

  it('applies weighted incremental margin when one line crosses tiers', () => {
    const result = calculateOrderPricing([
      createLine({ quantity: 15, cbmPerUnit: 0.1, costLanded: 50 }),
    ])

    expect(result.totalCbm).toBe(1.5)
    expect(result.effectiveMarginPercent).toBe(33.6)
    expect(result.lines[0]?.effectiveMargin).toBe(33.6)
  })

  it('accumulates CBM across multiple lines in cart order', () => {
    const result = calculateOrderPricing([
      createLine({
        productId: 'p1',
        quantity: 10,
        cbmPerUnit: 0.08,
        costLanded: 45,
      }),
      createLine({
        productId: 'p2',
        quantity: 5,
        cbmPerUnit: 0.25,
        costLanded: 95,
      }),
    ])

    expect(result.totalCbm).toBe(2.05)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]?.effectiveMargin).toBe(35)
    expect(result.lines[1]?.effectiveMargin).toBe(31.92)
  })

  it.each([
    { cbm: 0.8, expected: 35 },
    { cbm: 2, expected: 33.2 },
    { cbm: 4, expected: 31.6 },
    { cbm: 8, expected: 29.3 },
  ])('handles the $cbm CBM boundary', ({ cbm, expected }) => {
    const result = calculateOrderPricing([
      createLine({ quantity: 1, cbmPerUnit: cbm }),
    ])

    expect(result.totalCbm).toBe(cbm)
    expect(result.effectiveMarginPercent).toBe(expected)
  })

  it('tracks eco-contribution totals separately from subtotal', () => {
    const result = calculateOrderPricing([
      createLine({ quantity: 4, ecoContribution: 1.25 }),
    ])

    expect(result.ecoContributionTotal).toBe(5)
    expect(result.lines[0]?.ecoContributionTotal).toBe(5)
    expect(result.totalHt).toBe(result.subtotalHt)
  })

  it('rounds monetary values to cents', () => {
    const result = calculateOrderPricing([
      createLine({ quantity: 7, cbmPerUnit: 0.0833, costLanded: 33.33 }),
    ])

    expect(Number.isInteger(result.lines[0]!.unitPriceHt * 100)).toBe(true)
    expect(Number.isInteger(result.subtotalHt * 100)).toBe(true)
  })

  it('supports custom tiers', () => {
    const customTiers: ReadonlyArray<PricingTier> = [
      { minCbm: 0, maxCbm: 1, marginPercent: 50 },
      { minCbm: 1, maxCbm: null, marginPercent: 20 },
    ]
    const result = calculateOrderPricing(
      [createLine({ quantity: 20, cbmPerUnit: 0.1 })],
      customTiers,
    )

    expect(result.totalCbm).toBe(2)
    expect(result.effectiveMarginPercent).toBe(35)
  })

  it('keeps the configured default tiers immutable for callers', () => {
    expect(DEFAULT_PRICING_TIERS).toHaveLength(5)
    expect(DEFAULT_PRICING_TIERS[4]).toEqual({
      minCbm: 8,
      maxCbm: null,
      marginPercent: 25,
    })
  })
})
