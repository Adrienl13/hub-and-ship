import { describe, expect, it } from 'vitest'

import {
  commissionsToCsv,
  summarizeByPartner,
  type CommissionAdminRow,
} from './admin-repository'

function row(overrides: Partial<CommissionAdminRow>): CommissionAdminRow {
  return {
    id: 'l1',
    partnerCodeId: 'pc-1',
    partnerCode: 'DBP-13',
    companyName: 'Distri Provence',
    reservationId: 'res-1',
    baseAmountHt: 1000,
    rate: 8,
    amount: 80,
    status: 'accrued',
    phase: 'accrual',
    accruedAt: '2026-07-02T10:00:00.000Z',
    paidAt: null,
    ...overrides,
  }
}

describe('summarizeByPartner', () => {
  it('rolls up accrued / payable / paid per apporteur', () => {
    const summary = summarizeByPartner([
      row({ id: 'a', amount: 80, status: 'accrued' }),
      row({ id: 'b', amount: 50, status: 'payable' }),
      row({ id: 'c', amount: 30, status: 'paid' }),
      row({
        id: 'd',
        partnerCodeId: 'pc-2',
        partnerCode: 'XYZ-1',
        companyName: 'Autre',
        amount: 10,
        status: 'accrued',
      }),
    ])
    expect(summary).toHaveLength(2)
    const dbp = summary.find((s) => s.partnerCodeId === 'pc-1')!
    expect(dbp).toMatchObject({ accrued: 80, payable: 50, paid: 30 })
  })

  it('nets a reversal (negative amount) into the accrued total', () => {
    const summary = summarizeByPartner([
      row({ id: 'a', amount: 80, status: 'accrued', phase: 'accrual' }),
      row({ id: 'b', amount: -80, status: 'accrued', phase: 'reversal' }),
    ])
    expect(summary[0]?.accrued).toBe(0)
  })
})

describe('commissionsToCsv', () => {
  it('emits a header + one line per row and escapes commas', () => {
    const csv = commissionsToCsv([
      row({ companyName: 'Distri, Provence', amount: 80 }),
    ])
    const lines = csv.split('\n')
    expect(lines[0]).toContain('apporteur_code')
    expect(lines[1]).toContain('"Distri, Provence"')
    expect(lines[1]).toContain('80.00')
  })
})
