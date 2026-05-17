import { describe, expect, it } from 'vitest'

import { getMoqStatus } from './moq'

describe('getMoqStatus', () => {
  it('returns empty before any unit is committed', () => {
    expect(getMoqStatus(0, 50)).toEqual({
      status: 'empty',
      unitsCommitted: 0,
      unitsRequired: 50,
      unitsRemaining: 50,
      percent: 0,
      message: 'Soyez le premier a engager cette serie',
      colorClass: 'muted',
    })
  })

  it('returns starting below 40 percent', () => {
    const result = getMoqStatus(10, 50)

    expect(result.status).toBe('starting')
    expect(result.percent).toBe(20)
    expect(result.unitsRemaining).toBe(40)
  })

  it('returns progressing from 40 percent', () => {
    const result = getMoqStatus(20, 50)

    expect(result.status).toBe('progressing')
    expect(result.percent).toBe(40)
    expect(result.colorClass).toBe('amber')
  })

  it('returns almost from 80 percent', () => {
    const result = getMoqStatus(40, 50)

    expect(result.status).toBe('almost')
    expect(result.unitsRemaining).toBe(10)
  })

  it('returns reached at or above required MOQ', () => {
    expect(getMoqStatus(50, 50)).toMatchObject({
      status: 'reached',
      unitsRemaining: 0,
      percent: 100,
    })
    expect(getMoqStatus(55, 50)).toMatchObject({
      status: 'reached',
      unitsRemaining: 0,
      percent: 100,
    })
  })

  it('rounds percent for uneven quantities', () => {
    expect(getMoqStatus(1, 3).percent).toBe(33.33)
  })

  it('normalizes negative inputs defensively', () => {
    expect(getMoqStatus(-2, 10)).toMatchObject({
      status: 'empty',
      unitsCommitted: 0,
    })
  })
})
