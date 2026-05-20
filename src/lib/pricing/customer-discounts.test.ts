import { describe, expect, it } from 'vitest'

import { getCustomerDiscountStatus } from '@/lib/pricing/customer-discounts'

describe('customer quantity discounts', () => {
  it('does not grant a discount below the first threshold', () => {
    expect(getCustomerDiscountStatus(49)).toMatchObject({
      discountPercent: 0,
      nextGapUnits: 1,
    })
  })

  it('grants 2 percent from 50 units', () => {
    expect(getCustomerDiscountStatus(50)).toMatchObject({
      discountPercent: 2,
      nextGapUnits: 100,
    })
  })

  it('keeps 6 and 10 percent for high quantities', () => {
    expect(getCustomerDiscountStatus(149).discountPercent).toBe(2)
    expect(getCustomerDiscountStatus(150).discountPercent).toBe(6)
    expect(getCustomerDiscountStatus(299).discountPercent).toBe(6)
    expect(getCustomerDiscountStatus(300).discountPercent).toBe(10)
  })
})
