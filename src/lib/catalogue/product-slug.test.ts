import { describe, expect, it } from 'vitest'

import {
  findProductBySlug,
  productPath,
  productSlug,
  slugifyProductName,
} from './product-slug'

const CHAIR = { name: 'Chaise Bistrot Rotin Naturel', sku: 'ZF2000C' }
const TABLE = { name: 'Table Ronde Ø70 émaillée', sku: 'TB-104' }

describe('productSlug', () => {
  it('builds an accent-free, sku-suffixed slug', () => {
    expect(productSlug(CHAIR)).toBe('chaise-bistrot-rotin-naturel-zf2000c')
    expect(productSlug(TABLE)).toBe('table-ronde-70-emaillee-tb-104')
    expect(productPath(CHAIR)).toBe(
      '/catalogue/p/chaise-bistrot-rotin-naturel-zf2000c',
    )
  })

  it('falls back to the sku alone for an unslugifiable name', () => {
    expect(productSlug({ name: '———', sku: 'X1' })).toBe('x1')
    expect(slugifyProductName('  Éléphant & Co.  ')).toBe('elephant-co')
  })
})

describe('findProductBySlug', () => {
  const products = [CHAIR, TABLE]

  it('resolves an exact slug', () => {
    expect(
      findProductBySlug(products, 'chaise-bistrot-rotin-naturel-zf2000c'),
    ).toBe(CHAIR)
  })

  it('keeps old links working after a rename (sku suffix match)', () => {
    expect(findProductBySlug(products, 'ancien-nom-produit-zf2000c')).toBe(
      CHAIR,
    )
    expect(findProductBySlug(products, 'zf2000c')).toBe(CHAIR)
  })

  it('returns null for an unknown slug', () => {
    expect(findProductBySlug(products, 'inconnu-999')).toBeNull()
    expect(findProductBySlug(products, '')).toBeNull()
  })
})
