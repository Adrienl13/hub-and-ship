import { describe, expect, it } from 'vitest'

import type { AdminPricingParameters } from '@/lib/catalogue-admin/types'
import {
  computeContainerProfit,
  computeUnitGoodsCostHt,
  freightForFormat,
  maxSafeRfaPercent,
} from './container-profit'

// Paramètres = défauts de la migration pricing_engine_bridge (la grille
// réellement active en prod tant qu'Adrien ne l'a pas modifiée).
const PARAMS: AdminPricingParameters = {
  id: 'test',
  version: 1,
  label: 'test',
  fxUsdEur: 0.92,
  freightEur40hc: 4500,
  usefulContainerCbm40hc: 66,
  freightEur20gp: 3000,
  freightEur40gp: null,
  customsRate: 0,
  importInsuranceRate: 0,
  fixedImportFeeEur: 0,
  directMarginRate: 0.9,
  resellerMarginRate: 0.4,
  distributorMarginRate: 0.28,
  minMarginFloor: 0.15,
  lossLeaderMinLot: 16,
  tier2Qty: 100,
  tier2Discount: 0.06,
  tier3Qty: 150,
  tier3Discount: 0.1,
  reservationFeeRate: 0.03,
  reservationFeeMin: 150,
  reservationFeeMax: 500,
  updatedAt: '2026-07-28T00:00:00Z',
}

const CHAIR = {
  productId: 'p-chair',
  name: 'Chaise test',
  unitPriceHt: 78,
  fobUsd: 20,
  cbmPerUnit: 0.2,
  quantity: 100,
}

describe('container-profit', () => {
  it('calcule le coût marchandise unitaire (FOB × fx × (1+douane+assurance) + frais fixes)', () => {
    expect(computeUnitGoodsCostHt(20, PARAMS)).toBe(18.4)
    expect(computeUnitGoodsCostHt(null, PARAMS)).toBeNull()
    expect(computeUnitGoodsCostHt(0, PARAMS)).toBeNull()
  })

  it('résout le fret par format et refuse d’inventer une valeur manquante', () => {
    expect(freightForFormat('40_hc', PARAMS)).toBe(4500)
    expect(freightForFormat('20_gp', PARAMS)).toBe(3000)
    expect(freightForFormat('40_gp', PARAMS)).toBeNull()
  })

  it('bénéfice = CA − marchandise − fret (scénario simple 20 GP)', () => {
    const result = computeContainerProfit({
      format: '20_gp',
      lines: [CHAIR],
      params: PARAMS,
    })
    // CA 7800, marchandise 1840, fret 3000 → bénéfice 2960.
    expect(result.revenueHt).toBe(7800)
    expect(result.goodsCostHt).toBe(1840)
    expect(result.profitHt).toBe(2960)
    expect(result.marginPercent).toBeCloseTo(37.95, 1)
    expect(result.usedCbm).toBe(20)
    expect(result.overCapacity).toBe(false)
    expect(result.incompleteLines).toHaveLength(0)
  })

  it('fret manquant → bénéfice null (jamais un chiffre inventé)', () => {
    const result = computeContainerProfit({
      format: '40_gp',
      lines: [CHAIR],
      params: PARAMS,
    })
    expect(result.freightEur).toBeNull()
    expect(result.profitHt).toBeNull()
    expect(result.marginPercent).toBeNull()
  })

  it('commission 8 % et RFA se déduisent du CA', () => {
    const result = computeContainerProfit({
      format: '20_gp',
      lines: [CHAIR],
      params: PARAMS,
      includeCommission: true,
      rfaPercent: 5,
    })
    expect(result.commissionHt).toBe(624)
    expect(result.rfaHt).toBe(390)
    expect(result.profitHt).toBe(2960 - 624 - 390)
  })

  it('FOB manquant : ligne signalée, coût exclu (bénéfice affiché surestimé)', () => {
    const result = computeContainerProfit({
      format: '20_gp',
      lines: [{ ...CHAIR, fobUsd: null }],
      params: PARAMS,
    })
    expect(result.incompleteLines).toEqual(['Chaise test'])
    expect(result.goodsCostHt).toBe(0)
  })

  it('signale un mix qui déborde du volume utile', () => {
    const result = computeContainerProfit({
      format: '20_gp',
      lines: [{ ...CHAIR, quantity: 200 }], // 40 m³ > 28 m³
      params: PARAMS,
    })
    expect(result.overCapacity).toBe(true)
  })
})

describe('plafond RFA sans vente à perte', () => {
  it('floor 15 % + commission 8 % → RFA max ≈ 5 %', () => {
    expect(maxSafeRfaPercent(0.15)).toBeCloseTo(5.04, 1)
  })

  it('sans commission, le plafond monte à ≈ 13 %', () => {
    expect(maxSafeRfaPercent(0.15, 0)).toBeCloseTo(13.04, 1)
  })

  it('démonstration : RFA au-dessus du plafond = perte sur un prix plancher', () => {
    const cost = 100
    const floorPrice = cost * (1 + PARAMS.minMarginFloor) // 115
    const ceiling = maxSafeRfaPercent(PARAMS.minMarginFloor) / 100

    const profitAtCeiling =
      floorPrice * (1 - 0.08 - ceiling) - cost
    const profitAboveCeiling =
      floorPrice * (1 - 0.08 - (ceiling + 0.01)) - cost

    expect(profitAtCeiling).toBeGreaterThanOrEqual(-0.01)
    expect(profitAboveCeiling).toBeLessThan(0)
  })
})
