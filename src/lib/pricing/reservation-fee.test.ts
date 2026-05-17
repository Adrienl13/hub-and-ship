import { describe, expect, it } from 'vitest'

import {
  DEFAULT_RESERVATION_FEE_CONFIG,
  calculateReservationFee,
} from './reservation-fee'

describe('calculateReservationFee', () => {
  it('returns 0 for an empty or negative subtotal', () => {
    expect(calculateReservationFee(0)).toBe(0)
    expect(calculateReservationFee(-100)).toBe(0)
  })

  it('applies the minimum fee when 3 percent is too low', () => {
    expect(calculateReservationFee(1_000)).toBe(150)
    expect(calculateReservationFee(4_999)).toBe(150)
  })

  it('calculates 3 percent inside the min/max window', () => {
    expect(calculateReservationFee(6_000)).toBe(180)
    expect(calculateReservationFee(12_345.67)).toBe(370.37)
  })

  it('caps the reservation fee at the maximum', () => {
    expect(calculateReservationFee(20_000)).toBe(500)
  })

  it('accepts custom config for future app_config overrides', () => {
    expect(
      calculateReservationFee(2_000, {
        rate: 0.05,
        min: 50,
        max: 120,
      }),
    ).toBe(100)
  })

  it('exports the default V1 config', () => {
    expect(DEFAULT_RESERVATION_FEE_CONFIG).toEqual({
      rate: 0.03,
      min: 150,
      max: 500,
    })
  })
})
