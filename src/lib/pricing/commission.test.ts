import { describe, expect, it } from 'vitest'

import {
  COMMISSION_RATE_PERCENT,
  buildCommissionAccrual,
  buildCommissionReversal,
  commissionWindowExpiry,
  computeCommissionAmount,
  isWithinCommissionWindow,
} from './commission'

const REFERRED = '2026-01-15T10:00:00.000Z'

describe('commission window (12 months, first-touch)', () => {
  it('expires exactly 12 months after referred_at', () => {
    expect(commissionWindowExpiry(REFERRED).toISOString()).toBe(
      '2027-01-15T10:00:00.000Z',
    )
  })

  it('is due within the window', () => {
    expect(isWithinCommissionWindow(REFERRED, '2026-06-01T00:00:00Z')).toBe(true)
    expect(isWithinCommissionWindow(REFERRED, '2027-01-14T23:59:00Z')).toBe(true)
    expect(isWithinCommissionWindow(REFERRED, REFERRED)).toBe(true)
  })

  it('is NOT due at/after the 12-month expiry', () => {
    expect(isWithinCommissionWindow(REFERRED, '2027-01-15T10:00:00Z')).toBe(false)
    expect(isWithinCommissionWindow(REFERRED, '2027-03-01T00:00:00Z')).toBe(false)
  })

  it('is not due for a reservation before the referral', () => {
    expect(isWithinCommissionWindow(REFERRED, '2025-12-01T00:00:00Z')).toBe(false)
  })
})

describe('computeCommissionAmount', () => {
  it('defaults to 8% of the HT base', () => {
    expect(COMMISSION_RATE_PERCENT).toBe(8)
    expect(computeCommissionAmount(1000)).toBe(80)
    expect(computeCommissionAmount(4450)).toBe(356)
  })

  it('rounds to cents', () => {
    expect(computeCommissionAmount(333.33)).toBe(26.67)
  })
})

describe('buildCommissionAccrual', () => {
  const base = {
    partnerCodeId: 'pc-1',
    reservationId: 'res-1',
    baseAmountHt: 4450,
    referredAt: REFERRED,
  }

  it('accrues 8% inside the window', () => {
    expect(
      buildCommissionAccrual({ ...base, reservationAt: '2026-06-01T00:00:00Z' }),
    ).toEqual({
      partner_code_id: 'pc-1',
      reservation_id: 'res-1',
      base_amount_ht: 4450,
      rate: 8,
      amount: 356,
      status: 'accrued',
      phase: 'accrual',
    })
  })

  it('returns null outside the window (no commission after 12 months)', () => {
    expect(
      buildCommissionAccrual({ ...base, reservationAt: '2027-02-01T00:00:00Z' }),
    ).toBeNull()
  })
})

describe('buildCommissionReversal', () => {
  it('produces a negative-amount reversal row (never a deletion)', () => {
    const reversal = buildCommissionReversal({
      partnerCodeId: 'pc-1',
      reservationId: 'res-1',
      refundedBaseHt: 4450,
    })
    expect(reversal.base_amount_ht).toBe(-4450)
    expect(reversal.amount).toBe(-356)
    expect(reversal.phase).toBe('reversal')
  })
})
