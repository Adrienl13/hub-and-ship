import { describe, expect, it } from 'vitest'

import {
  isReservationCancelled,
  reservationTimelineSteps,
} from './timeline'

describe('reservationTimelineSteps', () => {
  it('marks the reservation done and the fee current while the fee is pending', () => {
    const steps = reservationTimelineSteps('pending_reservation_fee')
    expect(steps.map((s) => s.state)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
  })

  it('advances to production when in production', () => {
    const steps = reservationTimelineSteps('in_production')
    expect(steps[1]?.state).toBe('done') // fee
    expect(steps[2]?.state).toBe('done') // deposit
    expect(steps[3]?.state).toBe('current') // production
    expect(steps[4]?.state).toBe('upcoming')
  })

  it('marks every step done when delivered', () => {
    const steps = reservationTimelineSteps('delivered')
    expect(steps.every((s) => s.state === 'done')).toBe(true)
  })

  it('shows no progress when cancelled', () => {
    const steps = reservationTimelineSteps('cancelled')
    expect(steps.every((s) => s.state === 'upcoming')).toBe(true)
    expect(isReservationCancelled('cancelled')).toBe(true)
  })
})
