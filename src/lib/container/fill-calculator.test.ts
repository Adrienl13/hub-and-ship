import { describe, expect, it } from 'vitest'

import {
  calculateContainerFill,
  calculateSeriesProgress,
} from './fill-calculator'

describe('container fill calculator', () => {
  it('calculates used CBM, remaining CBM, fill percent and units', () => {
    expect(
      calculateContainerFill(
        [
          { quantity: 50, cbmPerUnit: 0.08 },
          { quantity: 10, cbmPerUnit: 0.25 },
        ],
        28,
      ),
    ).toMatchObject({
      usedCbm: 6.5,
      capacityCbm: 28,
      remainingCbm: 21.5,
      overCapacityCbm: 0,
      fillPercent: 23.21,
      totalUnits: 60,
    })
  })

  it('marks the threshold as reached against the raw unclamped fill percent', () => {
    expect(
      calculateContainerFill([{ quantity: 224, cbmPerUnit: 0.1 }], 28, 80),
    ).toMatchObject({
      usedCbm: 22.4,
      fillPercent: 80,
      thresholdReached: true,
    })
  })

  it('caps display fill at 100 percent but reports over-capacity CBM', () => {
    expect(
      calculateContainerFill([{ quantity: 40, cbmPerUnit: 1 }], 28),
    ).toMatchObject({
      usedCbm: 40,
      fillPercent: 100,
      remainingCbm: 0,
      overCapacityCbm: 12,
      thresholdReached: true,
    })
  })

  it('handles invalid capacity and negative line values defensively', () => {
    expect(
      calculateContainerFill(
        [
          { quantity: -10, cbmPerUnit: 0.3 },
          { quantity: Number.NaN, cbmPerUnit: 0.2 },
        ],
        0,
      ),
    ).toMatchObject({
      usedCbm: 0,
      capacityCbm: 0,
      fillPercent: 0,
      thresholdReached: false,
    })
  })

  it('counts MOQ series reached and remaining series', () => {
    expect(
      calculateSeriesProgress(
        [
          { seriesId: 'black-chair', unitsCommitted: 50, moqUnits: 50 },
          { seriesId: 'grey-chair', unitsCommitted: 42, moqUnits: 50 },
          { seriesId: 'table-oak', unitsCommitted: 20, moqUnits: 20 },
        ],
        3,
      ),
    ).toMatchObject({
      seriesReached: 2,
      totalSeries: 3,
      minSeriesRequired: 3,
      minSeriesReached: false,
      remainingSeries: 1,
    })
  })
})
