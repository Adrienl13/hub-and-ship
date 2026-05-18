import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOYALTY_TIERS,
  applyLoyaltyDiscount,
  getLoyaltyDiscount,
} from './loyalty'

describe('loyalty pricing', () => {
  it('exports the default V1 loyalty tiers', () => {
    expect(DEFAULT_LOYALTY_TIERS).toEqual([
      { minContainers: 2, discountPercent: 2 },
      { minContainers: 3, discountPercent: 3 },
      { minContainers: 5, discountPercent: 4 },
      { minContainers: 10, discountPercent: 5 },
    ])
  })

  it('returns no discount before two delivered containers', () => {
    expect(getLoyaltyDiscount(0)).toBe(0)
    expect(getLoyaltyDiscount(1)).toBe(0)
    expect(applyLoyaltyDiscount(1_000, 1)).toMatchObject({
      discountPercent: 0,
      discountAmount: 0,
      totalAfter: 1_000,
      nextGapContainers: 1,
    })
  })

  it('applies the boundary tiers from the spec', () => {
    expect(getLoyaltyDiscount(2)).toBe(2)
    expect(getLoyaltyDiscount(3)).toBe(3)
    expect(getLoyaltyDiscount(4)).toBe(3)
    expect(getLoyaltyDiscount(5)).toBe(4)
    expect(getLoyaltyDiscount(9)).toBe(4)
    expect(getLoyaltyDiscount(10)).toBe(5)
  })

  it('rounds the discount amount to cents before VAT', () => {
    expect(applyLoyaltyDiscount(12_345.67, 3)).toMatchObject({
      discountPercent: 3,
      discountAmount: 370.37,
      totalAfter: 11_975.3,
    })
  })

  it('returns the active and next tier metadata for UI progress', () => {
    expect(applyLoyaltyDiscount(1_000, 4)).toMatchObject({
      activeTier: { minContainers: 3, discountPercent: 3 },
      nextTier: { minContainers: 5, discountPercent: 4 },
      nextGapContainers: 1,
    })

    expect(applyLoyaltyDiscount(1_000, 10)).toMatchObject({
      nextTier: null,
      nextGapContainers: 0,
    })
  })

  it('handles unsorted custom tiers and unsafe inputs defensively', () => {
    const customTiers = [
      { minContainers: 8, discountPercent: 9 },
      { minContainers: 2, discountPercent: 3 },
      { minContainers: -1, discountPercent: 99 },
    ]

    expect(getLoyaltyDiscount(8.9, customTiers)).toBe(9)
    expect(applyLoyaltyDiscount(-100, Number.NaN, customTiers)).toMatchObject({
      discountPercent: 0,
      discountAmount: 0,
      totalAfter: 0,
    })
  })
})
