import { describe, expect, it } from 'vitest'

import {
  DISTRIBUTOR_MIN_ORDER_CBM_DEFAULT,
  getDistributorMinimumStatus,
} from './distributor-minimum'

describe('minimum de commande distributeur', () => {
  it('le défaut commercial est le volume utile d’un 20 GP (28 m³)', () => {
    expect(DISTRIBUTOR_MIN_ORDER_CBM_DEFAULT).toBe(28)
  })

  it('bloque un distributeur sous le seuil, avec le volume manquant', () => {
    // 50 chaises × 0,2 m³ = 10 m³ — le cas exact redouté.
    const status = getDistributorMinimumStatus({
      channel: 'distributeur',
      usedCbm: 10,
    })
    expect(status.blocked).toBe(true)
    expect(status.minCbm).toBe(28)
    expect(status.missingCbm).toBe(18)
  })

  it('laisse passer un distributeur au seuil ou au-dessus', () => {
    expect(
      getDistributorMinimumStatus({ channel: 'distributeur', usedCbm: 28 })
        .blocked,
    ).toBe(false)
    expect(
      getDistributorMinimumStatus({ channel: 'distributeur', usedCbm: 40 })
        .blocked,
    ).toBe(false)
  })

  it('ne concerne jamais les autres canaux', () => {
    for (const channel of ['direct', 'revendeur', 'grand_compte'] as const) {
      expect(
        getDistributorMinimumStatus({ channel, usedCbm: 1 }).blocked,
      ).toBe(false)
    }
  })

  it('seuil null (règle désactivée par l’admin) → aucun blocage', () => {
    expect(
      getDistributorMinimumStatus({
        channel: 'distributeur',
        usedCbm: 1,
        minCbm: null,
      }).blocked,
    ).toBe(false)
  })
})
