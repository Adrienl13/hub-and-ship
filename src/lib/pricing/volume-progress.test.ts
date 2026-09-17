import { afterEach, describe, expect, it } from 'vitest'

import {
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'
import { nextVolumeStep } from '@/lib/pricing/volume-progress'

const GRID = {
  assises: [
    { min_units: 100, discount: 0.06 },
    { min_units: 150, discount: 0.1 },
  ],
  tables: [
    { min_units: 80, discount: 0.05 },
    { min_units: 160, discount: 0.08 },
  ],
  salons: [
    { min_units: 10, discount: 0.06 },
    { min_units: 20, discount: 0.1 },
  ],
  autres: [
    { min_units: 100, discount: 0.06 },
    { min_units: 150, discount: 0.1 },
  ],
}

afterEach(() => {
  resetPublicPricingRules()
})

describe('prochain palier volume', () => {
  it('retient la famille la plus proche de son palier', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    // 90 assises (10 manquantes) contre 8 salons (2 manquants) : c'est le
    // salon qui est à portée, et c'est ce qu'il faut dire.
    const step = nextVolumeStep([
      { category: 'chair', quantity: 90 },
      { category: 'lounge', quantity: 8 },
    ])
    expect(step).toMatchObject({
      family: 'salons',
      missingUnits: 2,
      nextPercent: 6,
    })
    expect(step?.label).toBe('Encore 2 salons pour −6 % de remise.')
  })

  it('accorde le singulier', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const step = nextVolumeStep([{ category: 'lounge', quantity: 9 }])
    expect(step?.label).toBe('Encore 1 salon pour −6 % de remise.')
  })

  it('ne conseille jamais une famille absente du panier', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    // Proposer d'ajouter des salons à qui compose une terrasse de chaises
    // serait du remplissage, pas un conseil.
    const step = nextVolumeStep([{ category: 'chair', quantity: 40 }])
    expect(step?.family).toBe('assises')
  })

  it('ne renvoie rien au dernier palier', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    expect(nextVolumeStep([{ category: 'lounge', quantity: 25 }])).toBeNull()
    expect(nextVolumeStep([])).toBeNull()
  })

  it('suit la grille unique tant qu’aucune grille famille n’est posée', () => {
    const step = nextVolumeStep([{ category: 'lounge', quantity: 8 }])
    expect(step).toMatchObject({ missingUnits: 92, nextPercent: 6 })
  })
})
