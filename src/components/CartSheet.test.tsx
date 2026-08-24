import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PRODUCTS, type Product } from '@/lib/products'
import { clearCatalogueRegistry } from '@/lib/catalogue/registry'
import { useCartStore } from '@/stores/cart.store'
import { useCatalogStore } from '@/stores/catalog.store'

// Bug prod 07/2026 : icône panier vide alors que des quantités étaient bien
// enregistrées — le panneau résolvait les produits via le registre
// module-level (non réactif), donc un catalogue DB arrivé APRÈS le rendu du
// header ne déclenchait aucun re-render. Le fix branche le panneau sur le
// store catalogue (réactif). Ce test simule exactement cette course.

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}))

import { CartSheet } from '@/components/CartSheet'

const DB_PRODUCT: Product = {
  ...PRODUCTS.find((product) => product.category === 'chair')!,
  id: 'db-chaise-cannes',
  sku: 'CHA-CAN-001',
  name: 'Chaise de terrasse CANNES',
}

describe('CartSheet — résolution réactive des produits', () => {
  beforeEach(() => {
    localStorage.clear()
    clearCatalogueRegistry()
    useCartStore.getState().clearCart()
    // État initial simulé : catalogue pas encore chargé (liste vide, ready
    // pour neutraliser ensureLoaded) mais quantité déjà persistée.
    useCatalogStore.setState({ status: 'ready', products: [], source: 'db' })
  })

  it('affiche le badge dès que le catalogue arrive APRÈS le rendu', async () => {
    useCartStore.setState({
      qtyByLine: { [`${DB_PRODUCT.id}::__default__`]: 50 },
      variantByProduct: {},
    })

    render(<CartSheet />)

    // Avant l'arrivée du catalogue : produit irrésoluble → badge absent.
    expect(
      screen.getByRole('button', { name: /Ma commande — 0 unités/ }),
    ).toBeTruthy()

    // Le catalogue DB répond (comme en prod, quelques centaines de ms après).
    await act(async () => {
      useCatalogStore.setState({ products: [DB_PRODUCT] })
    })

    // Le badge reflète immédiatement la quantité persistée.
    expect(
      screen.getByRole('button', { name: /Ma commande — 50 unités/ }),
    ).toBeTruthy()
  })
})
