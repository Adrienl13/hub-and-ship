import { describe, expect, it } from 'vitest'

import { decodeCartSelection, encodeCartSelection } from './share-cart'

describe('cart selection encode/decode', () => {
  it('round-trips a selection', () => {
    const entries = [
      { productId: 'p1', variantId: 'v-noir', qty: 12 },
      { productId: 'p3', variantId: 'v-teck', qty: 4 },
    ]
    const encoded = encodeCartSelection(entries)
    expect(encoded).toBe('p1~v-noir~12,p3~v-teck~4')
    expect(decodeCartSelection(encoded)).toEqual(entries)
  })

  it('drops zero-quantity entries on encode', () => {
    expect(
      encodeCartSelection([{ productId: 'p1', variantId: 'v', qty: 0 }]),
    ).toBe('')
  })

  it('decodes defensively (bad chunks, dup product, invalid qty)', () => {
    expect(decodeCartSelection('p1~v~3,broken,p1~v~9,p2~w~-1,p3~x~2')).toEqual([
      { productId: 'p1', variantId: 'v', qty: 3 },
      { productId: 'p3', variantId: 'x', qty: 2 },
    ])
  })

  it('returns [] for empty/missing input', () => {
    expect(decodeCartSelection(null)).toEqual([])
    expect(decodeCartSelection('')).toEqual([])
  })

  it('floors fractional quantities', () => {
    expect(decodeCartSelection('p1~v~3.9')).toEqual([
      { productId: 'p1', variantId: 'v', qty: 3 },
    ])
  })
})
