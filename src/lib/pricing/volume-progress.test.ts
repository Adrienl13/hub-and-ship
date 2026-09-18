import { afterEach, describe, expect, it } from 'vitest'

import {
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'
import {
  buildVolumeScale,
  nextVolumeStep,
} from '@/lib/pricing/volume-progress'

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

describe('échelle de la jauge', () => {
  it('ne remplit pas jusqu’au palier tant qu’il n’est pas atteint', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    // Le défaut signalé : à 50 assises sur un palier à 100, l'ancienne jauge
    // remplissait 50 % de la piste — soit pile sous le libellé « −6 % ».
    const scale = buildVolumeScale([{ category: 'chair', quantity: 50 }])!
    expect(scale.family).toBe('assises')
    expect(scale.unitsLabel).toBe('50 assises')
    // Échelle 0 → 150 (dernier palier) : 50 pièces = un tiers de la piste.
    expect(scale.fill).toBe('33.3%')
    expect(scale.marks).toEqual([
      {
        left: '66.7%',
        shift: 'translateX(-50%)',
        label: '100 · −6 %',
        reached: false,
        tone: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
      },
      {
        left: '100%',
        shift: 'translateX(-100%)',
        label: '150 · −10 %',
        reached: false,
        tone: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
      },
    ])
  })

  it('le remplissage atteint le repère exactement quand le palier tombe', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const scale = buildVolumeScale([{ category: 'chair', quantity: 100 }])!
    expect(scale.fill).toBe('66.7%')
    expect(scale.marks[0]).toMatchObject({ left: '66.7%', reached: true })
    expect(scale.marks[1]!.reached).toBe(false)
  })

  it('sature au dernier palier', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const scale = buildVolumeScale([{ category: 'chair', quantity: 400 }])!
    expect(scale.fill).toBe('100%')
    expect(scale.marks.every((m) => m.reached)).toBe(true)
  })

  it('suit l’échelle de la famille, pas une échelle universelle', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    // Salons : paliers 10 et 20. Dix salons, c'est la moitié du chemin — pas
    // « encore 140 pièces » comme le disait une échelle 50/100/150.
    const scale = buildVolumeScale([{ category: 'lounge', quantity: 10 }])!
    expect(scale.family).toBe('salons')
    expect(scale.unitsLabel).toBe('10 salons')
    expect(scale.fill).toBe('50%')
    expect(scale.marks.map((m) => m.label)).toEqual(['10 · −6 %', '20 · −10 %'])
    expect(scale.marks[0]!.reached).toBe(true)
  })

  it('accorde le singulier et rend null sur un panier vide', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    expect(buildVolumeScale([{ category: 'lounge', quantity: 1 }])!.unitsLabel).toBe(
      '1 salon',
    )
    expect(buildVolumeScale([])).toBeNull()
  })
})
