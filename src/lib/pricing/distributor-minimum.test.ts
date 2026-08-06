import { describe, expect, it } from 'vitest'

import { getDistributorMinimumStatus } from './distributor-minimum'
import {
  resetPublicPricingRules,
  setPublicPricingRules,
} from './public-rules'

describe('minimum de commande distributeur', () => {
  it('bloque un distributeur sous le seuil, avec le volume manquant', () => {
    // 50 chaises × 0,2 m³ = 10 m³ — le cas exact redouté.
    const status = getDistributorMinimumStatus({
      channel: 'distributeur',
      usedCbm: 10,
      minCbm: 28,
    })
    expect(status.blocked).toBe(true)
    expect(status.minCbm).toBe(28)
    expect(status.missingCbm).toBe(18)
  })

  it('laisse passer un distributeur au seuil ou au-dessus', () => {
    expect(
      getDistributorMinimumStatus({
        channel: 'distributeur',
        usedCbm: 28,
        minCbm: 28,
      }).blocked,
    ).toBe(false)
    expect(
      getDistributorMinimumStatus({
        channel: 'distributeur',
        usedCbm: 40,
        minCbm: 28,
      }).blocked,
    ).toBe(false)
  })

  it('ne concerne jamais les autres canaux', () => {
    for (const channel of ['direct', 'revendeur', 'grand_compte'] as const) {
      expect(
        getDistributorMinimumStatus({ channel, usedCbm: 1, minCbm: 28 })
          .blocked,
      ).toBe(false)
    }
  })

  it('seuil null (règle désactivée par l’admin ou pas encore hydratée) → aucun blocage', () => {
    expect(
      getDistributorMinimumStatus({
        channel: 'distributeur',
        usedCbm: 1,
        minCbm: null,
      }).blocked,
    ).toBe(false)
  })

  it('le seuil vient des règles publiques serveur, jamais d’une constante', () => {
    // Miroir vivant : le même RPC qui hydrate les paliers volume porte le
    // seuil distributeur — l'UI suit l'admin, dans les deux sens.
    resetPublicPricingRules()
    const hydrated = setPublicPricingRules({
      tier2_qty: 100,
      tier2_discount: 0.06,
      tier3_qty: 150,
      tier3_discount: 0.1,
      reservation_fee_rate: 0.03,
      reservation_fee_min: 150,
      reservation_fee_max: 500,
      distributor_min_order_cbm: 40,
    })
    expect(hydrated.distributorMinOrderCbm).toBe(40)
    expect(
      getDistributorMinimumStatus({
        channel: 'distributeur',
        usedCbm: 30,
        minCbm: hydrated.distributorMinOrderCbm,
      }).blocked,
    ).toBe(true)

    // Admin efface la règle → null → plus aucun blocage client.
    const cleared = setPublicPricingRules({
      distributor_min_order_cbm: null,
    })
    expect(cleared.distributorMinOrderCbm).toBeNull()
    resetPublicPricingRules()
  })
})
