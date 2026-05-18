import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_RESERVATIONS,
  calculateAccountReservationKpis,
  mergeAccountReservations,
  getAccountReservationById,
} from './reservations'

describe('account reservations fixtures', () => {
  it('exposes deterministic account reservation snapshots', () => {
    expect(ACCOUNT_RESERVATIONS[0]?.draft.reference).toBe(
      'CC-2026-001-20260518-0018',
    )
    expect(ACCOUNT_RESERVATIONS[0]?.draft.lines.length).toBeGreaterThan(0)
  })

  it('finds reservations by account route id', () => {
    expect(getAccountReservationById('res-demo-active')?.status).toBe(
      'pending_reservation_fee',
    )
    expect(getAccountReservationById('missing')).toBeNull()
  })

  it('calculates account KPIs from reservations', () => {
    expect(calculateAccountReservationKpis(ACCOUNT_RESERVATIONS)).toMatchObject({
      activeCount: 2,
      totalCommittedHt: 20480,
      totalCbm: 26.5,
    })
  })

  it('puts local checkout reservations before demo fixtures', () => {
    const first = ACCOUNT_RESERVATIONS[0]
    if (!first) throw new Error('Missing reservation fixture')

    const merged = mergeAccountReservations({
      baseReservations: ACCOUNT_RESERVATIONS,
      localRecords: [
        {
          id: `local-${first.draft.reference}`,
          status: 'reserved',
          draft: first.draft,
          paidAmount: first.draft.payment.payNow,
          nextActionLabel: 'Reservation locale',
          updatedAt: first.updatedAt,
        },
      ],
    })

    expect(merged).toHaveLength(2)
    expect(merged[0]?.id).toBe(`local-${first.draft.reference}`)
  })
})
