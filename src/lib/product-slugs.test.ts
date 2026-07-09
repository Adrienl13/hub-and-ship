import { describe, expect, it } from 'vitest'

import {
  findProductBySlug,
  productPath,
  productSlug,
  slugify,
} from './product-slugs'
import { PRODUCTS } from './products'

describe('product slugs', () => {
  it('normalizes product names for stable URLs', () => {
    expect(slugify('Chaise de bistrot RIVOLI - chevron blanc / gris')).toBe(
      'chaise-de-bistrot-rivoli-chevron-blanc-gris',
    )
  })

  it('includes the SKU to avoid collisions', () => {
    const product = PRODUCTS.find((item) => item.sku === 'BIS-001')!

    expect(productSlug(product)).toBe(
      'chaise-de-bistrot-rivoli-chevron-blanc-gris-bis-001',
    )
    expect(productPath(product)).toBe(
      '/catalogue/chaise-de-bistrot-rivoli-chevron-blanc-gris-bis-001',
    )
  })

  it('resolves full slugs and legacy SKU links', () => {
    const product = PRODUCTS.find((item) => item.sku === 'BIS-001')!

    expect(findProductBySlug(PRODUCTS, productSlug(product))?.sku).toBe(
      'BIS-001',
    )
    expect(findProductBySlug(PRODUCTS, 'BIS-001')?.sku).toBe('BIS-001')
  })
})
