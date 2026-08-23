import { describe, expect, it } from 'vitest'

import { formatProductDimensions } from './products'

describe('formatProductDimensions', () => {
  it('affiche L × l × H pour un produit rectangulaire (ou sans forme)', () => {
    expect(
      formatProductDimensions({ dimensions: { l: 120, w: 70, h: 75 } }),
    ).toBe('120 × 70 × 75 cm')
    expect(
      formatProductDimensions({
        dimensions: { l: 120, w: 70, h: 75 },
        tableShape: 'rectangular',
      }),
    ).toBe('120 × 70 × 75 cm')
    expect(
      formatProductDimensions({
        dimensions: { l: 55, w: 58, h: 85 },
        tableShape: null,
      }),
    ).toBe('55 × 58 × 85 cm')
  })

  it('affiche Ø diamètre × H pour une table ronde (l = diamètre)', () => {
    expect(
      formatProductDimensions({
        dimensions: { l: 80, w: 80, h: 75 },
        tableShape: 'round',
      }),
    ).toBe('Ø 80 × H 75 cm')
  })
})
