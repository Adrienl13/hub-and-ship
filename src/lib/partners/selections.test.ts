import { describe, expect, it } from 'vitest'

import {
  buildSelectionItemInput,
  catalogSelectionEntries,
  quoteReference,
  selectionEcoTotal,
  selectionEntryKey,
  selectionPublicTotalHt,
  selectionTotalUnits,
} from './selections'
import type { Product, DesignVariant } from '@/lib/products'

const product = {
  id: 'p1',
  sku: 'CHR-001',
  category: 'chair',
  name: 'Chaise Cannes',
  basePriceHt: 89,
  ecoContribution: 1.5,
  mainImageUrl: 'https://img/p1.jpg',
} as unknown as Product

const variant = {
  id: 'v-noir',
  name: 'Noir',
  imageUrl: 'https://img/p1-noir.jpg',
} as unknown as DesignVariant

describe('buildSelectionItemInput', () => {
  it('snapshots public catalogue data only and uses the variant image', () => {
    const item = buildSelectionItemInput(product, variant, 12)
    expect(item).toEqual({
      productId: 'p1',
      variantId: 'v-noir',
      variantName: 'Noir',
      quantity: 12,
      snapshot: {
        name: 'Chaise Cannes',
        category: 'chair',
        sku: 'CHR-001',
        imageUrl: 'https://img/p1-noir.jpg',
        basePriceHt: 89,
        ecoContribution: 1.5,
      },
    })
    // The snapshot must never carry net partner pricing fields.
    expect(Object.keys(item.snapshot)).not.toContain('netPriceHt')
  })

  it('falls back to the product image and clamps quantity to >= 1', () => {
    const item = buildSelectionItemInput(product, null, 0)
    expect(item.variantId).toBeNull()
    expect(item.snapshot.imageUrl).toBe('https://img/p1.jpg')
    expect(item.quantity).toBe(1)
  })
})

describe('catalogSelectionEntries', () => {
  it('yields one entry per variant with stable keys', () => {
    const withVariants = {
      ...product,
      variants: [variant, { id: 'v-blanc', name: 'Blanc' }],
    } as unknown as Product
    const entries = catalogSelectionEntries([withVariants])
    expect(entries).toHaveLength(2)
    expect(entries[0]?.key).toBe(selectionEntryKey('p1', 'v-noir'))
    expect(entries[1]?.key).toBe(selectionEntryKey('p1', 'v-blanc'))
    expect(entries[0]?.variant?.id).toBe('v-noir')
  })

  it('yields a single variant-less entry when a product has no variants', () => {
    const noVariants = { ...product, variants: [] } as unknown as Product
    const entries = catalogSelectionEntries([noVariants])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.key).toBe(selectionEntryKey('p1', null))
    expect(entries[0]?.variant).toBeNull()
  })
})

describe('selection totals', () => {
  const items = [
    buildSelectionItemInput(product, null, 10),
    buildSelectionItemInput(product, variant, 5),
  ]

  it('sums the public price HT', () => {
    expect(selectionPublicTotalHt(items)).toBe(89 * 15)
  })

  it('sums the units', () => {
    expect(selectionTotalUnits(items)).toBe(15)
  })

  it('sums the eco contribution', () => {
    expect(selectionEcoTotal(items)).toBe(1.5 * 15)
  })
})

describe('quoteReference', () => {
  it('derives a stable PI- reference from the selection id', () => {
    expect(quoteReference('22222222-aaaa-0000-0000-000000000002')).toBe(
      'PI-22222222',
    )
  })
})
