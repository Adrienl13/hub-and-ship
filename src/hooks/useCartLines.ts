import { useMemo } from 'react'

import { useCatalog } from '@/hooks/useCatalog'
import { getDefaultVariant } from '@/lib/catalogue'
import { resolveCatalogueProduct } from '@/lib/catalogue/registry'
import type { CartItem } from '@/lib/order'
import { useCartStore } from '@/stores/cart.store'

// Lignes du panier par (produit, design), résolues contre le catalogue
// LIVE — source partagée du CartSheet (header) et de la page /panier.
// Réactif : useCatalog re-rend quand le catalogue arrive après le premier
// paint (bug historique « icône panier vide »).

export function useCartLines(): CartItem[] {
  const qtyByLine = useCartStore((state) => state.qtyByLine)
  const { products } = useCatalog()
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  return useMemo(() => {
    const items: CartItem[] = []
    for (const [key, quantity] of Object.entries(qtyByLine)) {
      if (!quantity || quantity <= 0) continue
      const [productId = '', variantId = ''] = key.split('::')
      const product =
        productById.get(productId) ?? resolveCatalogueProduct(productId)
      if (!product) continue
      const variant =
        product.variants.find((v) => v.id === variantId) ??
        getDefaultVariant(product)
      items.push({ product, variant, quantity })
    }
    return items
  }, [qtyByLine, productById])
}
