import { describe, expect, it } from 'vitest'

import type { DesignVariant, Product } from '@/lib/products'
import {
  compatibleBases,
  compatibleTops,
  composedCartLines,
  composedQuantityRule,
  isCompatibleTop,
} from './table-composer'

function variant(id: string, minOrderUnits: number | null = null): DesignVariant {
  return { id, name: id, unitsCommitted: 0, minOrderUnits }
}

function product(overrides: Partial<Product> & Pick<Product, 'id' | 'category'>): Product {
  return {
    sku: overrides.id.toUpperCase(),
    name: overrides.id,
    description: '',
    dimensions: { l: 70, w: 70, h: 73 },
    cbmPerUnit: 0.1,
    weightKg: 5,
    moqUnits: 20,
    basePriceHt: 100,
    retailPriceRef: 150,
    ecoContribution: 0,
    mainImageUrl: '/x.webp',
    galleryUrls: [],
    variants: [variant(`${overrides.id}-std`)],
    features: [],
    ...overrides,
  }
}

const roundBase = product({
  id: 'base-round',
  category: 'table_base',
  compatibleTopShapes: ['round'],
})
const anyBase = product({ id: 'base-any', category: 'table_base' })
const roundTop = product({ id: 'top-round', category: 'table_top', tableShape: 'round' })
const rectTop = product({ id: 'top-rect', category: 'table_top', tableShape: null })
const chair = product({ id: 'chair', category: 'chair', moqUnits: 50 })

describe('table composer compatibility', () => {
  it('matches tops by shape, any top when the base lists none', () => {
    expect(isCompatibleTop(roundBase, roundTop)).toBe(true)
    expect(isCompatibleTop(roundBase, rectTop)).toBe(false)
    expect(isCompatibleTop(anyBase, rectTop)).toBe(true)
    expect(isCompatibleTop(anyBase, chair)).toBe(false)
  })

  it('never lists on-request (made-to-measure) products', () => {
    const projectTop = product({
      id: 'top-project',
      category: 'table_top',
      visibility: 'on_request',
    })
    expect(
      compatibleTops(anyBase, [rectTop, projectTop]).map((p) => p.id),
    ).toEqual(['top-rect'])
  })

  it('lists compatible tops and bases from the catalogue', () => {
    const catalogue = [roundBase, anyBase, roundTop, rectTop, chair]
    expect(compatibleTops(roundBase, catalogue).map((p) => p.id)).toEqual([
      'top-round',
    ])
    expect(compatibleBases(rectTop, catalogue).map((p) => p.id)).toEqual([
      'base-any',
    ])
  })
})

describe('composed quantity', () => {
  it('starts at the most demanding colour minimum, then adds by the unit', () => {
    const rule = composedQuantityRule({
      base: anyBase,
      baseVariant: variant('b'),
      top: rectTop,
      topVariant: variant('special', 40),
    })
    expect(rule).toEqual({
      minimum: 40,
      step: 1,
      label: 'Min. 40 (coloris du plateau), puis à l’unité'.replace('’', "'"),
    })
  })

  it('writes two equal cart lines, never below the minimum', () => {
    const lines = composedCartLines({
      base: anyBase,
      baseVariant: variant('b'),
      top: rectTop,
      topVariant: variant('special', 40),
      quantity: 12,
    })
    expect(lines).toEqual([
      { productId: 'base-any', variantId: 'b', quantity: 40 },
      { productId: 'top-rect', variantId: 'special', quantity: 40 },
    ])
  })
})
