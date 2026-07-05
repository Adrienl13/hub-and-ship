import { describe, expect, it } from 'vitest'

import {
  EMPTY_ADVANCED_FILTERS,
  filterAndSortProducts,
  hasActiveAdvancedFilters,
  isStackable,
  type CatalogueAdvancedFilters,
} from './catalogue'
import type { Product } from '@/lib/products'

function product(partial: Partial<Product> & { id: string }): Product {
  return {
    sku: partial.id,
    category: 'chair',
    name: partial.id,
    description: '',
    dimensions: { l: 50, w: 50, h: 80 },
    cbmPerUnit: 0.1,
    weightKg: 4,
    moqUnits: 50,
    basePriceHt: 89,
    retailPriceRef: 150,
    ecoContribution: 1,
    mainImageUrl: '',
    galleryUrls: [],
    variants: [{ id: 'v', name: 'V', unitsCommitted: 0 }],
    features: [],
    ...partial,
  } as Product
}

const products: Product[] = [
  product({ id: 'cheap-stack-m1', basePriceHt: 70, moqUnits: 20, fireRating: 'M1', features: ['Empilable x8'] }),
  product({ id: 'pricey-m2', basePriceHt: 220, moqUnits: 80, fireRating: 'M2', features: ['Coussins'] }),
  product({ id: 'mid', basePriceHt: 120, moqUnits: 50, features: [] }),
]

function run(advanced: CatalogueAdvancedFilters): string[] {
  return filterAndSortProducts({
    products,
    filter: 'all',
    search: '',
    sort: 'default',
    advanced,
  }).map((p) => p.id)
}

describe('isStackable', () => {
  it('detects "empilable" in features', () => {
    expect(isStackable(product({ id: 'x', features: ['Empilable x10'] }))).toBe(true)
    expect(isStackable(product({ id: 'x', features: ['Coussins'] }))).toBe(false)
  })
})

describe('advanced catalogue filters', () => {
  it('returns everything with empty filters', () => {
    expect(run(EMPTY_ADVANCED_FILTERS)).toHaveLength(3)
  })

  it('filters by max price', () => {
    expect(run({ ...EMPTY_ADVANCED_FILTERS, maxPrice: 100 })).toEqual([
      'cheap-stack-m1',
    ])
  })

  it('filters by max MOQ', () => {
    expect(run({ ...EMPTY_ADVANCED_FILTERS, maxMoq: 50 })).toEqual([
      'cheap-stack-m1',
      'mid',
    ])
  })

  it('filters M1 fire rating only', () => {
    expect(run({ ...EMPTY_ADVANCED_FILTERS, fireM1Only: true })).toEqual([
      'cheap-stack-m1',
    ])
  })

  it('filters stackable only', () => {
    expect(run({ ...EMPTY_ADVANCED_FILTERS, stackableOnly: true })).toEqual([
      'cheap-stack-m1',
    ])
  })

  it('combines criteria', () => {
    expect(
      run({ maxPrice: 100, maxMoq: 30, fireM1Only: true, stackableOnly: true }),
    ).toEqual(['cheap-stack-m1'])
  })
})

describe('hasActiveAdvancedFilters', () => {
  it('is false for the empty preset and true when any criterion is set', () => {
    expect(hasActiveAdvancedFilters(EMPTY_ADVANCED_FILTERS)).toBe(false)
    expect(
      hasActiveAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS, fireM1Only: true }),
    ).toBe(true)
  })
})
