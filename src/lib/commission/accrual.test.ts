import { describe, expect, it } from 'vitest'

import {
  isAccruableStatus,
  matchPartnerCodeId,
  resolveReservationAccrual,
} from './accrual'

const REFERRED = '2026-01-15T10:00:00.000Z'

const base = {
  reservationId: 'res-1',
  status: 'delivered' as const,
  baseAmountHt: 4450,
  partnerCodeId: 'pc-1',
  reservationAt: '2026-06-01T00:00:00Z',
  companyReferredAt: REFERRED,
}

describe('isAccruableStatus', () => {
  it('excludes every partially-collected status (only full CA accrues)', () => {
    // reserved = frais seuls ; deposit_* = acompte 30% ; in_production = solde
    // pas encore appelé → commissionner 100% du CA serait une fuite comptable.
    for (const status of [
      'draft',
      'pending_reservation_fee',
      'reserved',
      'deposit_called',
      'deposit_paid',
      'in_production',
      'cancelled',
    ] as const) {
      expect(isAccruableStatus(status)).toBe(false)
    }
  })

  it('accrues only once the full CA is collected (in_transit / delivered)', () => {
    expect(isAccruableStatus('in_transit')).toBe(true)
    expect(isAccruableStatus('delivered')).toBe(true)
  })
})

describe('matchPartnerCodeId (case-insensitive)', () => {
  const codes = [
    { id: 'pc-1', code: 'DBP-13' },
    { id: 'pc-2', code: 'XYZ-1' },
  ]

  it('matches regardless of case / surrounding spaces', () => {
    expect(matchPartnerCodeId(codes, 'DBP-13')).toBe('pc-1')
    expect(matchPartnerCodeId(codes, 'dbp-13')).toBe('pc-1')
    expect(matchPartnerCodeId(codes, '  Dbp-13 ')).toBe('pc-1')
  })

  it('returns null for an unknown, empty, or missing ref', () => {
    expect(matchPartnerCodeId(codes, 'nope')).toBeNull()
    expect(matchPartnerCodeId(codes, '')).toBeNull()
    expect(matchPartnerCodeId(codes, null)).toBeNull()
    expect(matchPartnerCodeId([], 'DBP-13')).toBeNull()
  })
})

describe('resolveReservationAccrual', () => {
  it('accrues 8% for an eligible paid reservation with a partner code', () => {
    const result = resolveReservationAccrual(base)
    expect(result.accrued).toBe(true)
    if (!result.accrued) return
    expect(result.payload).toMatchObject({
      reservation_id: 'res-1',
      partner_code_id: 'pc-1',
      base_amount_ht: 4450,
      amount: 356,
      phase: 'accrual',
      status: 'accrued',
    })
  })

  it('does not accrue on a not-yet-paid status', () => {
    expect(
      resolveReservationAccrual({ ...base, status: 'pending_reservation_fee' }),
    ).toEqual({ accrued: false, reason: 'status_not_paid' })
  })

  it('does not accrue without a partner code (no referrer)', () => {
    expect(
      resolveReservationAccrual({ ...base, partnerCodeId: null }),
    ).toEqual({ accrued: false, reason: 'no_partner_code' })
  })

  it('does not accrue after the 12-month window', () => {
    expect(
      resolveReservationAccrual({
        ...base,
        reservationAt: '2027-03-01T00:00:00Z',
      }),
    ).toEqual({ accrued: false, reason: 'outside_window' })
  })

  it('treats a null company referred_at as first-touch (opens the window now)', () => {
    const result = resolveReservationAccrual({
      ...base,
      companyReferredAt: null,
      reservationAt: '2026-06-01T00:00:00Z',
    })
    expect(result.accrued).toBe(true)
  })
})
