import { describe, expect, it } from 'vitest'

import { computePartnerReport, dealsByStatus } from './reporting'
import type {
  PartnerWorkspaceDeal,
  PartnerWorkspaceReservation,
} from '@/lib/partners/portal'

function deal(status: PartnerWorkspaceDeal['status']): PartnerWorkspaceDeal {
  return {
    id: status,
    clientCompanyName: 'C',
    projectType: 'terrasse',
    projectCity: null,
    status,
    protectedUntil: null,
    referralSlug: null,
  }
}

function res(totalHt: number): PartnerWorkspaceReservation {
  return {
    id: `r${totalHt}`,
    reference: 'CC',
    status: 'reserved',
    totalHt,
    attributionReason: 'client_siret',
    createdAt: '2026-06-08',
  }
}

describe('computePartnerReport', () => {
  it('aggregates deal and reservation figures', () => {
    const report = computePartnerReport(
      [deal('protected'), deal('quoted'), deal('won'), deal('lost')],
      [res(1000), res(500)],
    )
    expect(report).toEqual({
      totalDeals: 4,
      protectedDeals: 2,
      wonDeals: 1,
      attributedReservations: 2,
      attributedTotalHt: 1500,
    })
  })

  it('handles empty input', () => {
    expect(computePartnerReport([], [])).toEqual({
      totalDeals: 0,
      protectedDeals: 0,
      wonDeals: 0,
      attributedReservations: 0,
      attributedTotalHt: 0,
    })
  })
})

describe('dealsByStatus', () => {
  it('counts and orders by descending count', () => {
    const result = dealsByStatus([
      deal('protected'),
      deal('protected'),
      deal('won'),
    ])
    expect(result[0]).toEqual({ status: 'protected', count: 2 })
    expect(result[1]).toEqual({ status: 'won', count: 1 })
  })
})
