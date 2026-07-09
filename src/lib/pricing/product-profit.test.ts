import { describe, expect, it } from 'vitest'

import {
  computeLandedCostHt,
  computeProductProfit,
  type LandedCostParameters,
} from '@/lib/pricing/product-profit'

// Paramètres proches de la grille active (fx 0.92, douane 3 %, assurance
// 0.4 %, fret 4 500 €, frais fixes 2 €, plancher 15 %).
const PARAMS: LandedCostParameters = {
  fxUsdEur: 0.92,
  customsRate: 0.03,
  importInsuranceRate: 0.004,
  freightEur40hc: 4500,
  fixedImportFeeEur: 2,
  minMarginFloor: 0.15,
}

describe('computeLandedCostHt', () => {
  it('matches the SQL engine formula (FOB × fx × (1+douane+assurance) + fret/qté + fixes)', () => {
    // 38 × 0.92 × 1.034 + 4500/850 + 2 = 36.15 + 5.29 + 2
    expect(computeLandedCostHt(38, 850, PARAMS)).toBeCloseTo(43.44, 2)
  })

  it('returns null when the real costs are missing or invalid', () => {
    expect(computeLandedCostHt(null, 850, PARAMS)).toBeNull()
    expect(computeLandedCostHt(38, null, PARAMS)).toBeNull()
    expect(computeLandedCostHt(0, 850, PARAMS)).toBeNull()
    expect(computeLandedCostHt(38, 0, PARAMS)).toBeNull()
  })
})

describe('computeProductProfit', () => {
  it('derives unit profit, margin % and full-container projection', () => {
    const profit = computeProductProfit(55, 38, 850, PARAMS)
    expect(profit).not.toBeNull()
    expect(profit?.landedCostHt).toBeCloseTo(43.44, 2)
    expect(profit?.unitProfitHt).toBeCloseTo(11.56, 2)
    expect(profit?.marginPercent).toBeCloseTo(21.02, 1)
    expect(profit?.containerProfitHt).toBeCloseTo(11.56 * 850, 0)
    expect(profit?.belowFloor).toBe(false)
  })

  it('flags a sell price under the margin floor', () => {
    // Plancher = 43.44 × 1.15 ≈ 49.96 € → 45 € est sous le plancher.
    const profit = computeProductProfit(45, 38, 850, PARAMS)
    expect(profit?.belowFloor).toBe(true)
    // Et un prix sous le coût rendu donne un bénéfice négatif.
    const losing = computeProductProfit(40, 38, 850, PARAMS)
    expect(losing?.unitProfitHt).toBeLessThan(0)
  })

  it('returns null without real costs or with a zero price (never a fake number)', () => {
    expect(computeProductProfit(55, null, 850, PARAMS)).toBeNull()
    expect(computeProductProfit(55, 38, null, PARAMS)).toBeNull()
    expect(computeProductProfit(0, 38, 850, PARAMS)).toBeNull()
  })
})
