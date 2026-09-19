import { describe, expect, it } from 'vitest'

import {
  isProductComplete,
  matchesGapFilter,
  productGaps,
  tallyGaps,
} from './completeness'

type Fiche = Parameters<typeof productGaps>[0]

const COMPLETE: Fiche = {
  category: 'chair',
  composition: null,
  dimensions: { l: 47, w: 59, h: 85 },
  mainImageUrl: '/catalogue/bistro/BIS-067-01.webp',
  tableShape: null,
  weightKg: 5.4,
}

describe('manques d’une fiche produit', () => {
  it('ne signale rien sur une fiche complète', () => {
    expect(productGaps(COMPLETE)).toEqual([])
    expect(isProductComplete(COMPLETE)).toBe(true)
  })

  it('relève le poids resté à zéro', () => {
    // Sans poids, le devis annonce « 10 chaises de 0 kg » et le transporteur
    // ne peut pas chiffrer. C'est le cas des 17 fiches relevées le 18/09.
    expect(productGaps({ ...COMPLETE, weightKg: 0 })).toEqual(['weight'])
  })

  it('relève une fiche squelette à 0 × 0 × 0', () => {
    expect(
      productGaps({ ...COMPLETE, dimensions: { l: 0, w: 0, h: 0 }, weightKg: 0 }),
    ).toEqual(['dimensions', 'weight'])
  })

  it('relève une cote manquante, pas seulement les trois', () => {
    expect(
      productGaps({ ...COMPLETE, dimensions: { l: 48, w: 0, h: 86 } }),
    ).toEqual(['dimensions'])
  })

  it('n’exige qu’un diamètre et une hauteur sur un plateau rond', () => {
    // La largeur EST le diamètre : une seule cote est saisie côté admin,
    // réclamer la troisième enverrait chercher une donnée qui n'existe pas.
    expect(
      productGaps({
        ...COMPLETE,
        category: 'table_top',
        tableShape: 'round',
        dimensions: { l: 80, w: 80, h: 4 },
      }),
    ).toEqual([])
  })

  it('réclame la composition d’un salon, et pas ses cotes', () => {
    // Les 15 fiches lounge portent 180 × 78 × 78 : les cotes du canapé seul.
    // Ce qui manque, c'est l'ensemble — pas un L × l × H de plus.
    expect(
      productGaps({
        ...COMPLETE,
        category: 'lounge',
        dimensions: { l: 180, w: 78, h: 78 },
      }),
    ).toEqual(['composition'])
  })

  it('cesse de réclamer les cotes dès qu’une composition existe', () => {
    expect(
      productGaps({
        ...COMPLETE,
        category: 'lounge',
        dimensions: { l: 0, w: 0, h: 0 },
        composition: [{ label: 'Canapé', qty: 1, l: 180, w: 80, h: 70 }],
      }),
    ).toEqual([])
  })

  it('n’exige pas de composition hors des salons', () => {
    expect(productGaps({ ...COMPLETE, category: 'chair' })).toEqual([])
  })

  it('relève une fiche sans photo principale', () => {
    expect(productGaps({ ...COMPLETE, mainImageUrl: '   ' })).toEqual(['photo'])
  })

  it('énumère les manques dans un ordre stable', () => {
    expect(
      productGaps({
        category: 'lounge',
        composition: null,
        dimensions: { l: 0, w: 0, h: 0 },
        mainImageUrl: '',
        tableShape: null,
        weightKg: 0,
      }),
    ).toEqual(['photo', 'dimensions', 'weight', 'composition'])
  })
})

describe('compteurs des puces « À compléter »', () => {
  const fiche = (id: string, over: Partial<Fiche> = {}) => ({
    id,
    ...COMPLETE,
    ...over,
  })

  it('ne compte qu’une fois une fiche à qui il manque deux choses', () => {
    // Sinon « Incomplètes » dépasserait le nombre de fiches et ne voudrait
    // plus rien dire.
    const { counts } = tallyGaps([
      fiche('a', { weightKg: 0, dimensions: { l: 0, w: 0, h: 0 } }),
      fiche('b'),
    ])
    expect(counts.all).toBe(2)
    expect(counts.any).toBe(1)
    expect(counts.weight).toBe(1)
    expect(counts.dimensions).toBe(1)
  })

  it('reproduit l’état réel du catalogue au 19/09', () => {
    // 143 fiches actives : 7 sans poids NI dimensions (6 squelettes +
    // BIS-061), 1 sans photo (SKU-321, qui est aussi un squelette), 15
    // salons sans composition. Une fiche cumulant plusieurs manques n'est
    // comptée qu'une fois dans « Incomplètes » : 7 + 15 = 22.
    const rows = [
      ...Array.from({ length: 6 }, (_, i) =>
        fiche(`squelette-${i}`, {
          weightKg: 0,
          dimensions: { l: 0, w: 0, h: 0 },
          // SKU-321 est le seul sans photo principale.
          mainImageUrl: i === 0 ? '' : COMPLETE.mainImageUrl,
        }),
      ),
      fiche('bis-061', { weightKg: 0, dimensions: { l: 0, w: 0, h: 0 } }),
      ...Array.from({ length: 15 }, (_, i) =>
        fiche(`lounge-${i}`, {
          category: 'lounge' as const,
          dimensions: { l: 180, w: 78, h: 78 },
        }),
      ),
      ...Array.from({ length: 121 }, (_, i) => fiche(`ok-${i}`)),
    ]
    const { counts } = tallyGaps(rows)
    expect(counts.all).toBe(143)
    expect(counts.any).toBe(22)
    expect(counts.weight).toBe(7)
    expect(counts.dimensions).toBe(7)
    expect(counts.photo).toBe(1)
    expect(counts.composition).toBe(15)
  })

  it('filtre sur la puce choisie', () => {
    const gaps = ['weight'] as const
    expect(matchesGapFilter(gaps, 'all')).toBe(true)
    expect(matchesGapFilter(gaps, 'any')).toBe(true)
    expect(matchesGapFilter(gaps, 'weight')).toBe(true)
    expect(matchesGapFilter(gaps, 'dimensions')).toBe(false)
    // Une fiche complète ne doit apparaître sous aucune puce de manque.
    expect(matchesGapFilter([], 'any')).toBe(false)
    expect(matchesGapFilter([], 'all')).toBe(true)
  })
})
