import { describe, expect, it } from 'vitest'

import { getCustomerDiscountStatus } from '@/lib/pricing/customer-discounts'

describe('customer quantity discounts', () => {
  it('does not grant a discount below the first threshold', () => {
    expect(getCustomerDiscountStatus(99)).toMatchObject({
      discountPercent: 0,
      nextGapUnits: 1,
    })
  })

  it('grants 6 percent from 100 units', () => {
    expect(getCustomerDiscountStatus(100)).toMatchObject({
      discountPercent: 6,
      nextGapUnits: 50,
    })
  })

  it('applies the v2 grid boundaries (100→6%, 149→6%, 150→10%)', () => {
    expect(getCustomerDiscountStatus(149).discountPercent).toBe(6)
    expect(getCustomerDiscountStatus(150).discountPercent).toBe(10)
    expect(getCustomerDiscountStatus(500).discountPercent).toBe(10)
  })

  it('caps the discount at the top tier with no next tier', () => {
    expect(getCustomerDiscountStatus(150)).toMatchObject({
      discountPercent: 10,
      nextTier: null,
      nextGapUnits: 0,
    })
  })
})
