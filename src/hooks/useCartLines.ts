import { useMemo } from 'react'

import { useCatalog } from '@/hooks/useCatalog'
import { resolveCatalogueProduct } from '@/lib/catalogue/registry'
import type { CartItem } from '@/lib/order'
import { createCartSnapshot, useCartStore } from '@/stores/cart.store'

// Lignes du panier par (produit, design), résolues contre le catalogue
// LIVE — source partagée du CartSheet (header) et de la page /panier.
// Réactif : useCatalog re-rend quand le catalogue arrive après le premier
// paint (bug historique « icône panier vide »).
//
// La résolution est DÉLÉGUÉE à createCartSnapshot, qui sert déjà la barre de
// commande du catalogue, le devis PDF et le brouillon de réservation. Ce hook
// itérait les clés brutes de son côté : une sentinelle __default__ héritée
// d'un panier v2 apparaissait alors comme une seconde ligne identique sur
// /panier — « 110 pièces · 2 lignes » — et cliquer « Retirer » sur l'une
// supprimait les deux. Une seule source de résolution, plus d'écart possible.

export function useCartLines(): CartItem[] {
  const qtyByLine = useCartStore((state) => state.qtyByLine)
  const { products } = useCatalog()

  return useMemo(() => {
    // Le registre complète le catalogue live : une ligne peut porter un
    // produit retiré du listing mais encore résolvable (lien partagé, panier
    // ouvert avant une désactivation).
    const known = new Map(products.map((product) => [product.id, product]))
    for (const key of Object.keys(qtyByLine)) {
      const productId = key.split('::')[0] ?? ''
      if (known.has(productId)) continue
      const resolved = resolveCatalogueProduct(productId)
      if (resolved) known.set(productId, resolved)
    }

    return createCartSnapshot({
      qtyByLine,
      products: [...known.values()],
    }).items
  }, [qtyByLine, products])
}
