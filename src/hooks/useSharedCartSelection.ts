// Reconstruction du panier depuis un `?panier=` — lien de partage, ou
// passage de relais entre le catalogue public (vanilla) et le tunnel React.
//
// Deux règles, apprises de l'audit pré-lancement :
//
//   1. une sélection reçue REMPLACE le panier, elle ne s'y ajoute pas. Ouvrir
//      deux liens à la suite cumulait les lignes : badge « 100 », total faux,
//      taux de remplissage container faux. On vide avec `clearCart()` et non
//      `resetCart()`, qui effacerait aussi les designs déjà choisis ;
//   2. on n'annonce jamais un succès trompeur. Un produit du lien a pu être
//      retiré ou désactivé depuis : le message dit ce qui a réellement été
//      chargé.
//
// Le hook est monté par /catalogue ET /panier : le catalogue public envoie
// directement sur /panier?panier=… pour que l'acheteur atterrisse sur son
// devis, pas sur un second catalogue.

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { getDefaultVariant } from '@/lib/catalogue'
import { decodeCartSelection } from '@/lib/catalogue/share-cart'
import type { Product } from '@/lib/products'
import { useCartStore } from '@/stores/cart.store'

export interface SharedSelectionOutcome {
  readonly requested: number
  readonly applied: number
}

/**
 * Applique les lignes du lien sur le panier. Exportée à part du hook pour
 * être testable sans rendu React.
 */
export function applySharedSelection({
  encoded,
  products,
  clearCart,
  setVariant,
  setLineQty,
}: {
  readonly encoded: string | null
  readonly products: ReadonlyArray<Product>
  readonly clearCart: () => void
  readonly setVariant: (productId: string, variantId: string) => void
  readonly setLineQty: (
    productId: string,
    variantId: string,
    quantity: number,
    options?: { readonly silent?: boolean },
  ) => void
}): SharedSelectionOutcome {
  const entries = decodeCartSelection(encoded)
  if (entries.length === 0) return { requested: 0, applied: 0 }

  // Remplacement, pas cumul : le lien décrit une sélection complète.
  clearCart()

  let applied = 0
  for (const entry of entries) {
    const product = products.find((item) => item.id === entry.productId)
    if (!product) continue
    // Ligne par (produit, design) : un lien peut porter plusieurs designs du
    // même produit — chacun devient sa propre ligne de panier.
    const variantId = product.variants.some((v) => v.id === entry.variantId)
      ? entry.variantId
      : getDefaultVariant(product).id
    setVariant(entry.productId, variantId)
    setLineQty(entry.productId, variantId, entry.qty, { silent: true })
    applied += 1
  }

  return { requested: entries.length, applied }
}

/** Message affiché après application — fidèle à ce qui a été chargé. */
export function describeSharedSelection(
  outcome: SharedSelectionOutcome,
): {
  readonly tone: 'success' | 'warning' | 'error'
  readonly text: string
} | null {
  if (outcome.requested === 0) return null
  if (outcome.applied === 0) {
    return {
      tone: 'error',
      text: 'Les produits de ce lien partagé ne sont plus disponibles au catalogue.',
    }
  }
  if (outcome.applied < outcome.requested) {
    return {
      tone: 'warning',
      text: `Sélection partiellement chargée : ${outcome.requested - outcome.applied} produit(s) du lien ne sont plus disponibles.`,
    }
  }
  return { tone: 'success', text: 'Sélection chargée depuis le lien partagé.' }
}

export function useSharedCartSelection(products: ReadonlyArray<Product>): void {
  const clearCart = useCartStore((state) => state.clearCart)
  const setVariant = useCartStore((state) => state.setVariant)
  const setLineQty = useCartStore((state) => state.setLineQty)
  const applied = useRef(false)

  useEffect(() => {
    if (applied.current || products.length === 0) return
    applied.current = true

    const outcome = applySharedSelection({
      encoded: new URLSearchParams(window.location.search).get('panier'),
      products,
      clearCart,
      setVariant,
      setLineQty,
    })

    const message = describeSharedSelection(outcome)
    if (!message) return
    if (message.tone === 'error') toast.error(message.text)
    else if (message.tone === 'warning') toast.warning(message.text)
    else toast.success(message.text)
  }, [clearCart, products, setLineQty, setVariant])
}
