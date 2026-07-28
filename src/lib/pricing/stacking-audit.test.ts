import { describe, expect, it } from 'vitest'

import {
  CHANNEL_COEFFICIENTS,
  channelCoefficientFromMargins,
  resolveChannelUnitPrice,
  violatesGoldenRule,
  worstDirectUnitPrice,
} from './channel'
import { computeCommissionAmount } from './commission'
import { getCustomerDiscountStatus } from './customer-discounts'
import { maxSafeRfaPercent } from './container-profit'

// Audit rentabilité 07/2026 — invariants d'EMPILEMENT.
//
// Le moteur SQL garantit : prix ≥ plancher = coût rendu × (1 + floor 15 %),
// paliers volume appliqués AVANT le greatest(prix, plancher), overrides
// partenaires rejetés sous le plancher (M9), règle d'or à l'écriture.
// Ces tests vérifient côté client que les CUMULS (remise volume + commission
// apporteur + RFA) ne peuvent pas transformer un prix plancher en perte —
// et documentent la seule combinaison dangereuse (RFA au-delà du plafond).

const FLOOR = 0.15 // min_margin_floor par défaut (migration bridge)
const COMMISSION = 0.08 // commission apporteur (8 % du CA encaissé)

describe('empilement direct : palier volume max + commission apporteur', () => {
  it('les remises volume ne se cumulent pas entre elles (un seul palier actif)', () => {
    const tiers = [
      { minUnits: 100, discountPercent: 6 },
      { minUnits: 150, discountPercent: 10 },
    ]
    // À 200 unités, seul le palier −10 % s'applique — jamais 6 + 10.
    expect(getCustomerDiscountStatus(200, tiers).discountPercent).toBe(10)
    expect(getCustomerDiscountStatus(149, tiers).discountPercent).toBe(6)
    expect(getCustomerDiscountStatus(99, tiers).discountPercent).toBe(0)
  })

  it('pire vente directe (prix plancher, loss leader) + commission 8 % reste positive', () => {
    // get_price vend un loss leader AU plancher : prix = coût × 1,15.
    // Même avec la commission apporteur, la marge nette reste > 0.
    const cost = 100
    const floorPrice = cost * (1 + FLOOR) // 115
    const commission = computeCommissionAmount(floorPrice, COMMISSION * 100)
    const net = floorPrice - commission - cost
    expect(net).toBeGreaterThan(0) // ≈ +5,8 € pour 100 € de coût
    expect(net / cost).toBeCloseTo(0.058, 2)
  })

  it('vente directe palier 3 (−10 %) + commission : marge confortable', () => {
    // Prix formule direct = coût × 1,90 ; palier 3 = ×0,90 ; le plancher ne
    // mord pas (1,71 > 1,15). Commission 8 % ensuite.
    const cost = 100
    const tier3Price = cost * 1.9 * 0.9 // 171
    const net = tier3Price * (1 - COMMISSION) - cost
    expect(net / cost).toBeCloseTo(0.573, 2) // +57 % sur coût
  })
})

describe('empilement partenaires : coefficient + commission + RFA', () => {
  it('les coefficients affichés dérivent bien des marges actives (cohérence moteur)', () => {
    expect(channelCoefficientFromMargins(0.9, 0.4)).toBe(
      CHANNEL_COEFFICIENTS.revendeur,
    )
    expect(channelCoefficientFromMargins(0.9, 0.28)).toBe(
      CHANNEL_COEFFICIENTS.distributeur,
    )
  })

  it('règle d’or : aucun prix revendeur/distributeur ne peut atteindre le pire prix direct', () => {
    const base = 78
    for (const channel of ['revendeur', 'distributeur'] as const) {
      expect(violatesGoldenRule({ basePriceHt: base, channel })).toBe(false)
      // Un override AU niveau du pire prix direct viole la règle (strictement <).
      expect(
        violatesGoldenRule({
          basePriceHt: base,
          channel,
          overrideHt: worstDirectUnitPrice(base),
        }),
      ).toBe(true)
    }
  })

  it('distributeur (marge +28 %) + commission 8 % + RFA 5 % reste positif', () => {
    const cost = 100
    const price = cost * 1.28
    const net = price * (1 - COMMISSION - 0.05) - cost
    expect(net).toBeGreaterThan(0) // ≈ +11,4 % sur coût
  })

  it('DANGER documenté : prix au plancher + commission + RFA > plafond = perte', () => {
    const cost = 100
    const floorPrice = cost * (1 + FLOOR)
    const ceilingPercent = maxSafeRfaPercent(FLOOR) // ≈ 5,04 %

    const atCeiling = floorPrice * (1 - COMMISSION - ceilingPercent / 100) - cost
    const above = floorPrice * (1 - COMMISSION - 0.07) - cost

    expect(atCeiling).toBeGreaterThanOrEqual(-0.01) // break-even au plafond
    expect(above).toBeLessThan(0) // RFA 7 % → vente à perte
  })

  it('grand compte = pire prix direct d’office, jamais en dessous', () => {
    const base = 78
    const gc = resolveChannelUnitPrice({
      basePriceHt: base,
      channel: 'grand_compte',
    })
    expect(gc).toBe(worstDirectUnitPrice(base))
    // Base à 90 % de marge sur coût : même au pire prix direct, la marge
    // reste au-dessus du plancher 15 % (1,9 × 0,9 = 1,71 > 1,15).
    const cost = base / 1.9
    expect(gc).toBeGreaterThan(cost * (1 + FLOOR))
  })
})
