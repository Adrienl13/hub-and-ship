import { describe, expect, it } from 'vitest'

import {
  summarizePartnerCommissions,
  type MyCommissionRow,
} from './repository'

function row(overrides: Partial<MyCommissionRow>): MyCommissionRow {
  return {
    id: 'l1',
    reservationId: 'res-1',
    baseAmountHt: 1000,
    amount: 80,
    status: 'accrued',
    phase: 'accrual',
    accruedAt: '2026-07-02T10:00:00.000Z',
    paidAt: null,
    ...overrides,
  }
}

describe('summarizePartnerCommissions', () => {
  it('counts distinct attributed reservations and sums CA + commissions', () => {
    const summary = summarizePartnerCommissions([
      row({ id: 'a', reservationId: 'res-1', baseAmountHt: 1000, amount: 80 }),
      row({
        id: 'b',
        reservationId: 'res-2',
        baseAmountHt: 500,
        amount: 40,
        status: 'paid',
      }),
    ])
    expect(summary.reservationsAttributed).toBe(2)
    expect(summary.caEncaisseHt).toBe(1500)
    expect(summary.accrued).toBe(80)
    expect(summary.paid).toBe(40)
    expect(summary.total).toBe(120)
  })

  it('nets reversals and does not double-count a reservation', () => {
    const summary = summarizePartnerCommissions([
      row({ id: 'a', reservationId: 'res-1', baseAmountHt: 1000, amount: 80 }),
      row({
        id: 'b',
        reservationId: 'res-1',
        baseAmountHt: -1000,
        amount: -80,
        phase: 'reversal',
      }),
    ])
    expect(summary.reservationsAttributed).toBe(1)
    expect(summary.caEncaisseHt).toBe(0)
    expect(summary.accrued).toBe(0)
  })

  it('is zero for a partner with no commissions', () => {
    expect(summarizePartnerCommissions([])).toMatchObject({
      reservationsAttributed: 0,
      caEncaisseHt: 0,
      total: 0,
    })
  })
})
