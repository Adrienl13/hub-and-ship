import { describe, expect, it } from 'vitest'

import type { CartLineForPricing } from './tiers'
import {
  calculatePricingWithExistingCbm,
  calculatePricingWithExistingReservations,
  getCumulativeCbmForCompany,
  isActiveReservationStatus,
  type ReservationForAggregation,
} from './aggregation'

function createLine(
  overrides: Partial<CartLineForPricing> = {},
): CartLineForPricing {
  return {
    productId: 'product-a',
    variantId: 'variant-a',
    variantCombinationId: null,
    quantity: 10,
    cbmPerUnit: 0.1,
    costLanded: 100,
    ecoContribution: 1,
    ...overrides,
  }
}

const reservations: ReadonlyArray<ReservationForAggregation> = [
  {
    id: 'r1',
    companyId: 'company-a',
    containerId: 'container-1',
    status: 'reserved',
    totalCbm: 0.8,
  },
  {
    id: 'r2',
    companyId: 'company-a',
    containerId: 'container-1',
    status: 'deposit_paid',
    totalCbm: 1.2,
  },
  {
    id: 'r3',
    companyId: 'company-a',
    containerId: 'container-1',
    status: 'cancelled',
    totalCbm: 9,
  },
  {
    id: 'r4',
    companyId: 'company-b',
    containerId: 'container-1',
    status: 'reserved',
    totalCbm: 5,
  },
  {
    id: 'r5',
    companyId: 'company-a',
    containerId: 'container-2',
    status: 'reserved',
    totalCbm: 4,
  },
]

describe('pricing aggregation', () => {
  it('identifies only statuses that should count against anti-splitting', () => {
    expect(isActiveReservationStatus('reserved')).toBe(true)
    expect(isActiveReservationStatus('pending_deposit')).toBe(true)
    expect(isActiveReservationStatus('paid_full')).toBe(true)
    expect(isActiveReservationStatus('cart')).toBe(false)
    expect(isActiveReservationStatus('cancelled')).toBe(false)
  })

  it('sums active CBM for the same company and same container only', () => {
    expect(
      getCumulativeCbmForCompany(reservations, 'company-a', 'container-1'),
    ).toBe(2)
  })

  it('excludes the edited reservation when requested', () => {
    expect(
      getCumulativeCbmForCompany(
        reservations,
        'company-a',
        'container-1',
        'r2',
      ),
    ).toBe(0.8)
  })

  it('starts the incremental tier calculation after existing CBM', () => {
    const withoutExisting = calculatePricingWithExistingCbm([createLine()], 0)
    const withExisting = calculatePricingWithExistingCbm([createLine()], 1.5)

    expect(withExisting.existingCbm).toBe(1.5)
    expect(withExisting.totalCbm).toBe(1)
    expect(withExisting.cumulativeCbm).toBe(2.5)
    expect(withExisting.lines).toHaveLength(1)
    expect(withExisting.lines[0]?.effectiveMargin).toBeLessThan(
      withoutExisting.lines[0]?.effectiveMargin ?? 0,
    )
  })

  it('does not include the ghost existing line in customer totals', () => {
    const result = calculatePricingWithExistingCbm([createLine()], 3)

    expect(result.lines.map((line) => line.productId)).toEqual(['product-a'])
    expect(result.subtotalHt).toBe(result.lines[0]?.subtotalHt)
    expect(result.ecoContributionTotal).toBe(
      result.lines[0]?.ecoContributionTotal,
    )
  })

  it('combines reservation lookup and pricing in one pure helper', () => {
    const result = calculatePricingWithExistingReservations({
      newLines: [createLine({ quantity: 5, cbmPerUnit: 0.2 })],
      reservations,
      companyId: 'company-a',
      containerId: 'container-1',
    })

    expect(result.existingCbm).toBe(2)
    expect(result.totalCbm).toBe(1)
    expect(result.cumulativeCbm).toBe(3)
  })
})
