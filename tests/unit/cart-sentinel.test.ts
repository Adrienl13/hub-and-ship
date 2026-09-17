// Régression : la migration v3 du panier écrit une clé sentinelle
// « <produit>::__default__ » pour tout produit sans design choisi. Elle
// survivait à côté de la vraie ligne — /panier affichait « 2 lignes »
// identiques, « Retirer » sur l'une supprimait les deux, et la barre de
// commande, le devis PDF et le brouillon de réservation ADDITIONNAIENT les
// deux clés : la quantité partait au double de ce que l'acheteur avait saisi.
import { beforeEach, describe, expect, it } from 'vitest'

import { PRODUCTS } from '@/lib/products'
import {
  cartLineKey,
  createCartSnapshot,
  useCartStore,
} from '@/stores/cart.store'

const chair = PRODUCTS.find((p) => p.category === 'chair')!
const defaultVariantId = chair.variants[0]!.id

function snapshot(qtyByLine: Record<string, number>) {
  return createCartSnapshot({ qtyByLine, products: PRODUCTS })
}

describe('sentinelle __default__ héritée', () => {
  it('ne double plus la quantité quand la vraie ligne existe aussi', () => {
    const snap = snapshot({
      [cartLineKey(chair.id, '__default__')]: 50,
      [cartLineKey(chair.id, defaultVariantId)]: 60,
    })

    expect(snap.items).toHaveLength(1)
    expect(snap.items[0]!.quantity).toBe(60)
    expect(snap.totalUnits).toBe(60)
  })

  it('garde la quantité de la sentinelle quand elle est la plus haute', () => {
    const snap = snapshot({
      [cartLineKey(chair.id, '__default__')]: 80,
      [cartLineKey(chair.id, defaultVariantId)]: 50,
    })

    expect(snap.items).toHaveLength(1)
    expect(snap.items[0]!.quantity).toBe(80)
  })

  it('résout une sentinelle seule comme le design par défaut', () => {
    const snap = snapshot({ [cartLineKey(chair.id, '__default__')]: 50 })

    expect(snap.items).toHaveLength(1)
    expect(snap.items[0]!.variant.id).toBe(defaultVariantId)
    expect(snap.items[0]!.quantity).toBe(50)
  })

  it('additionne encore deux designs réellement distincts dont un a disparu', () => {
    // Ici les unités sont vraies : l'acheteur a bien choisi deux coloris, et
    // l'un d'eux n'existe plus au catalogue. On ne perd pas ses pièces.
    const snap = snapshot({
      [cartLineKey(chair.id, 'coloris-retire-du-catalogue')]: 30,
      [cartLineKey(chair.id, defaultVariantId)]: 50,
    })

    expect(snap.items).toHaveLength(1)
    expect(snap.items[0]!.quantity).toBe(80)
  })
})

describe('écriture dans le panier', () => {
  beforeEach(() => {
    useCartStore.setState({ qtyByLine: {} })
  })

  it('purge la sentinelle dès la première écriture, pas seulement à zéro', () => {
    useCartStore.setState({
      qtyByLine: { [cartLineKey(chair.id, '__default__')]: 50 },
    })

    useCartStore.getState().setLineQty(chair.id, defaultVariantId, 60)

    const { qtyByLine } = useCartStore.getState()
    expect(qtyByLine[cartLineKey(chair.id, '__default__')]).toBeUndefined()
    expect(qtyByLine[cartLineKey(chair.id, defaultVariantId)]).toBe(60)
  })
})
