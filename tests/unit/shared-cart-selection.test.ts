import { describe, expect, it, vi } from 'vitest'

import {
  applySharedSelection,
  describeSharedSelection,
} from '@/hooks/useSharedCartSelection'
import { encodeCartSelection } from '@/lib/catalogue/share-cart'
import type { Product } from '@/lib/products'

function product(id: string, variantIds: ReadonlyArray<string>): Product {
  return {
    id,
    variants: variantIds.map((variantId) => ({ id: variantId })),
  } as unknown as Product
}

function harness(products: ReadonlyArray<Product>) {
  const clearCart = vi.fn()
  const setVariant = vi.fn()
  const setLineQty = vi.fn()
  return {
    clearCart,
    setVariant,
    setLineQty,
    run: (encoded: string | null) =>
      applySharedSelection({
        encoded,
        products,
        clearCart,
        setVariant,
        setLineQty,
      }),
  }
}

const CATALOGUE = [
  product('p1', ['p1-bleu', 'p1-ecru']),
  product('p2', ['p2-sable']),
]

describe('relais de sélection vers le panier', () => {
  it('remplace le panier au lieu de s’y ajouter', () => {
    const h = harness(CATALOGUE)
    const outcome = h.run(
      encodeCartSelection([
        { productId: 'p1', variantId: 'p1-bleu', qty: 30 },
        { productId: 'p2', variantId: 'p2-sable', qty: 12 },
      ]),
    )

    expect(h.clearCart).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ requested: 2, applied: 2 })
    expect(h.setLineQty).toHaveBeenNthCalledWith(1, 'p1', 'p1-bleu', 30, {
      silent: true,
    })
    expect(h.setLineQty).toHaveBeenNthCalledWith(2, 'p2', 'p2-sable', 12, {
      silent: true,
    })
  })

  it('garde une ligne par design du même produit', () => {
    const h = harness(CATALOGUE)
    const outcome = h.run(
      encodeCartSelection([
        { productId: 'p1', variantId: 'p1-bleu', qty: 25 },
        { productId: 'p1', variantId: 'p1-ecru', qty: 25 },
      ]),
    )
    expect(outcome.applied).toBe(2)
    expect(h.setLineQty).toHaveBeenCalledTimes(2)
  })

  it('retombe sur le design par défaut quand l’identifiant est inconnu', () => {
    // Cas réel : le catalogue public fabrique « <id>:principal » pour un
    // produit sans coloris en base — cet identifiant n'existe pas côté React.
    const h = harness(CATALOGUE)
    h.run(
      encodeCartSelection([
        { productId: 'p1', variantId: 'p1:principal', qty: 40 },
      ]),
    )
    expect(h.setLineQty).toHaveBeenCalledWith('p1', 'p1-bleu', 40, {
      silent: true,
    })
  })

  it('ne touche pas au panier quand le lien est vide ou absent', () => {
    const h = harness(CATALOGUE)
    expect(h.run(null)).toEqual({ requested: 0, applied: 0 })
    expect(h.run('')).toEqual({ requested: 0, applied: 0 })
    expect(h.clearCart).not.toHaveBeenCalled()
  })

  it('ignore les produits disparus du catalogue', () => {
    const h = harness(CATALOGUE)
    const outcome = h.run(
      encodeCartSelection([
        { productId: 'p1', variantId: 'p1-bleu', qty: 10 },
        { productId: 'disparu', variantId: 'x', qty: 10 },
      ]),
    )
    expect(outcome).toEqual({ requested: 2, applied: 1 })
  })
})

describe('message de reprise', () => {
  it('reste muet quand aucun lien n’était présent', () => {
    expect(describeSharedSelection({ requested: 0, applied: 0 })).toBeNull()
  })

  it('n’annonce jamais un succès trompeur', () => {
    expect(describeSharedSelection({ requested: 3, applied: 0 })?.tone).toBe(
      'error',
    )
    const partial = describeSharedSelection({ requested: 3, applied: 2 })
    expect(partial?.tone).toBe('warning')
    expect(partial?.text).toContain('1 produit(s)')
    expect(describeSharedSelection({ requested: 3, applied: 3 })?.tone).toBe(
      'success',
    )
  })
})
