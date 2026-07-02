import { describe, expect, it } from 'vitest'

import {
  CHANNEL_COEFFICIENTS,
  MAX_DIRECT_DISCOUNT_PERCENT,
  WORST_DIRECT_PRICE_FACTOR,
  channelAllowsVolumeDiscounts,
  resolveChannelUnitPrice,
  violatesGoldenRule,
  worstDirectUnitPrice,
} from './channel'

describe('channel pricing constants', () => {
  it('derives the max direct discount from the v2 grid (10%)', () => {
    expect(MAX_DIRECT_DISCOUNT_PERCENT).toBe(10)
    expect(WORST_DIRECT_PRICE_FACTOR).toBeCloseTo(0.9, 10)
  })

  it('keeps reseller coefficients strictly below the worst direct factor', () => {
    expect(CHANNEL_COEFFICIENTS.revendeur).toBeLessThan(WORST_DIRECT_PRICE_FACTOR)
    expect(CHANNEL_COEFFICIENTS.distributeur).toBeLessThan(
      CHANNEL_COEFFICIENTS.revendeur,
    )
  })
})

describe('resolveChannelUnitPrice', () => {
  it('returns the base price for the direct channel (volume discount applies later)', () => {
    expect(resolveChannelUnitPrice({ basePriceHt: 100, channel: 'direct' })).toBe(
      100,
    )
  })

  it('applies the coefficient for revendeur and distributeur', () => {
    expect(
      resolveChannelUnitPrice({ basePriceHt: 100, channel: 'revendeur' }),
    ).toBe(73.68)
    expect(
      resolveChannelUnitPrice({ basePriceHt: 100, channel: 'distributeur' }),
    ).toBe(67.37)
  })

  it('applies the max direct tier (−10%) for grand_compte, no quantity condition', () => {
    expect(
      resolveChannelUnitPrice({ basePriceHt: 100, channel: 'grand_compte' }),
    ).toBe(90)
  })

  it('lets a channel_price_override win over the coefficient', () => {
    expect(
      resolveChannelUnitPrice({
        basePriceHt: 100,
        channel: 'revendeur',
        overrideHt: 80,
      }),
    ).toBe(80)
  })

  it('ignores a null/zero override', () => {
    expect(
      resolveChannelUnitPrice({
        basePriceHt: 100,
        channel: 'revendeur',
        overrideHt: null,
      }),
    ).toBe(73.68)
  })
})

describe('violatesGoldenRule', () => {
  it('never triggers for coefficient-based reseller prices', () => {
    for (const base of [10, 34, 128, 429, 999.99]) {
      expect(violatesGoldenRule({ basePriceHt: base, channel: 'revendeur' })).toBe(
        false,
      )
      expect(
        violatesGoldenRule({ basePriceHt: base, channel: 'distributeur' }),
      ).toBe(false)
    }
  })

  it('never constrains direct or grand_compte', () => {
    expect(violatesGoldenRule({ basePriceHt: 100, channel: 'direct' })).toBe(
      false,
    )
    expect(
      violatesGoldenRule({ basePriceHt: 100, channel: 'grand_compte' }),
    ).toBe(false)
  })

  it('flags a reseller override that reaches/exceeds the worst direct price', () => {
    // worst direct for 100 = 90; an override of 90 or 95 violates (not strictly below)
    expect(
      violatesGoldenRule({
        basePriceHt: 100,
        channel: 'revendeur',
        overrideHt: 90,
      }),
    ).toBe(true)
    expect(
      violatesGoldenRule({
        basePriceHt: 100,
        channel: 'revendeur',
        overrideHt: 95,
      }),
    ).toBe(true)
    expect(
      violatesGoldenRule({
        basePriceHt: 100,
        channel: 'revendeur',
        overrideHt: 89.99,
      }),
    ).toBe(false)
  })
})

describe('channel gating', () => {
  it('only allows volume discounts on the direct channel', () => {
    expect(channelAllowsVolumeDiscounts('direct')).toBe(true)
    expect(channelAllowsVolumeDiscounts('revendeur')).toBe(false)
    expect(channelAllowsVolumeDiscounts('distributeur')).toBe(false)
    expect(channelAllowsVolumeDiscounts('grand_compte')).toBe(false)
  })
})

describe('worstDirectUnitPrice', () => {
  it('is the base price minus the max direct discount', () => {
    expect(worstDirectUnitPrice(200)).toBe(180)
  })
})
