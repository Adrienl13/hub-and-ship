import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_RESERVATIONS,
  calculateAccountReservationKpis,
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
})
