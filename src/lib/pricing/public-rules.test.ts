import { afterEach, describe, expect, it } from 'vitest'

import { calculateReservationFee } from '@/lib/order'
import { getCustomerDiscountStatus } from '@/lib/pricing/customer-discounts'
import {
  DEFAULT_PUBLIC_PRICING_RULES,
  getActiveCustomerDiscountTiers,
  getPublicPricingRules,
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'

afterEach(() => {
  resetPublicPricingRules()
})

describe('public pricing rules module', () => {
  it('starts on the historical grid (100→6%, 150→10%, 3% / 150 / 500)', () => {
    expect(getPublicPricingRules()).toEqual(DEFAULT_PUBLIC_PRICING_RULES)
    expect(DEFAULT_PUBLIC_PRICING_RULES).toEqual({
      tier2Qty: 100,
      tier2Discount: 0.06,
      tier3Qty: 150,
      tier3Discount: 0.1,
      reservationFeeRate: 0.03,
      reservationFeeMin: 150,
      reservationFeeMax: 500,
    })
  })

  it('hydrates from the RPC payload (snake_case, numeric strings tolerated)', () => {
    setPublicPricingRules({
      tier2_qty: 80,
      tier2_discount: '0.05',
      tier3_qty: 120,
      tier3_discount: 0.12,
      reservation_fee_rate: 0.025,
      reservation_fee_min: 100,
      reservation_fee_max: 600,
    })
    expect(getPublicPricingRules()).toEqual({
      tier2Qty: 80,
      tier2Discount: 0.05,
      tier3Qty: 120,
      tier3Discount: 0.12,
      reservationFeeRate: 0.025,
      reservationFeeMin: 100,
      reservationFeeMax: 600,
    })
  })

  it('falls back field by field on missing or invalid values', () => {
    setPublicPricingRules({ tier2_qty: 90, reservation_fee_rate: 'abc' })
    const rules = getPublicPricingRules()
    expect(rules.tier2Qty).toBe(90)
    expect(rules.reservationFeeRate).toBe(0.03)
    expect(rules.tier3Qty).toBe(150)
  })

  it.each([
    ['tier 3 below tier 2', { tier2_qty: 150, tier3_qty: 100 }],
    ['discount above 100%', { tier2_discount: 1.5 }],
    ['tier 3 discount below tier 2', { tier2_discount: 0.1, tier3_discount: 0.05 }],
    ['fee min above max', { reservation_fee_min: 900, reservation_fee_max: 500 }],
    ['negative fee rate', { reservation_fee_rate: -0.01 }],
  ])('rejects an incoherent payload in full (%s)', (_label, payload) => {
    const before = getPublicPricingRules()
    setPublicPricingRules(payload)
    expect(getPublicPricingRules()).toEqual(before)
  })

  it('ignores non-object payloads', () => {
    for (const raw of [null, undefined, 'x', 12, ['tier2_qty']]) {
      setPublicPricingRules(raw)
    }
    expect(getPublicPricingRules()).toEqual(DEFAULT_PUBLIC_PRICING_RULES)
  })

  it('derives the customer discount tiers in display format (%)', () => {
    setPublicPricingRules({ tier2_qty: 80, tier2_discount: 0.05 })
    expect(getActiveCustomerDiscountTiers()).toEqual([
      { minUnits: 80, discountPercent: 5 },
      { minUnits: 150, discountPercent: 10 },
    ])
  })
})

describe('P0.4 — the dead panel fields now act on the money paths', () => {
  it('reservation fee follows the active rules', () => {
    expect(calculateReservationFee(10000)).toBe(300)
    setPublicPricingRules({
      reservation_fee_rate: 0.05,
      reservation_fee_min: 200,
      reservation_fee_max: 400,
    })
    expect(calculateReservationFee(10000)).toBe(400)
    expect(calculateReservationFee(1000)).toBe(200)
    expect(calculateReservationFee(0)).toBe(0)
  })

  it('customer discount status follows the active tiers by default', () => {
    expect(getCustomerDiscountStatus(90).discountPercent).toBe(0)
    setPublicPricingRules({ tier2_qty: 80, tier2_discount: 0.05 })
    expect(getCustomerDiscountStatus(90).discountPercent).toBe(5)
    expect(getCustomerDiscountStatus(150).discountPercent).toBe(10)
  })
})
