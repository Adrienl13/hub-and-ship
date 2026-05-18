import { describe, expect, it } from 'vitest'

import {
  canStartProduction,
  canTransition,
  getAllowedContainerTransitions,
  getContainerOperationalStatus,
} from './status'

describe('container status', () => {
  it('allows only the lifecycle transitions from the spec', () => {
    expect(canTransition('draft', 'open')).toBe(true)
    expect(canTransition('open', 'threshold_reached')).toBe(true)
    expect(canTransition('threshold_reached', 'production')).toBe(true)
    expect(canTransition('production', 'manufactured')).toBe(true)
    expect(canTransition('manufactured', 'shipped')).toBe(true)
    expect(canTransition('shipped', 'customs')).toBe(true)
    expect(canTransition('customs', 'arrived')).toBe(true)
    expect(canTransition('arrived', 'delivered')).toBe(true)

    expect(canTransition('open', 'production')).toBe(false)
    expect(canTransition('delivered', 'open')).toBe(false)
  })

  it('exposes allowed transitions for admin controls', () => {
    expect(getAllowedContainerTransitions('threshold_reached')).toEqual([
      'production',
      'cancelled',
      'open',
    ])
  })

  it('derives threshold reached display status without mutating persisted status', () => {
    expect(
      getContainerOperationalStatus({
        status: 'open',
        fillPercent: 81,
        thresholdPercent: 80,
      }),
    ).toBe('threshold_reached')

    expect(
      getContainerOperationalStatus({
        status: 'production',
        fillPercent: 30,
        thresholdPercent: 80,
      }),
    ).toBe('production')
  })

  it('allows production only when fill, MOQ series and deposits are ready', () => {
    expect(
      canStartProduction({
        fillPercent: 80,
        seriesReached: 3,
        minSeriesRequired: 3,
        thresholdPercent: 80,
        hasUnpaidDeposits: false,
      }),
    ).toEqual({ canStart: true, reasons: [] })
  })

  it('explains every missing production condition', () => {
    const result = canStartProduction({
      fillPercent: 74.4,
      seriesReached: 2,
      minSeriesRequired: 3,
      thresholdPercent: 80,
      hasUnpaidDeposits: true,
    })

    expect(result.canStart).toBe(false)
    expect(result.reasons).toEqual([
      'Remplissage 74.4% < 80%',
      '2 series atteintes / 3 requises',
      'Acomptes non encore tous payes',
    ])
  })
})
