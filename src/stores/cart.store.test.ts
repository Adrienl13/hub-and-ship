import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { PRODUCTS, type Product } from '@/lib/products'
import {
  clearCatalogueRegistry,
  registerCatalogueProducts,
} from '@/lib/catalogue/registry'
import { createCartSnapshot, useCart, useCartStore } from '@/stores/cart.store'

describe('cart store', () => {
  beforeEach(() => {
    localStorage.clear()
    clearCatalogueRegistry()
    useCartStore.getState().resetCart()
  })

  it('accepts a live DB product whose id is not in the static mock (C1)', () => {
    // A product created by the admin / seeded from a collection has an id
    // outside the mock p1…p6. Before the registry fix, setQty silently no-oped.
    const table = PRODUCTS.find((p) => p.category === 'table')!
    const dbProduct: Product = { ...table, id: 'bistro-bis-001', sku: 'BIS-001' }
    // Not registered yet → cannot resolve → no-op (proves the mechanism).
    useCartStore.getState().setQty('bistro-bis-001', 12)
    expect(
      useCartStore.getState().qtyByProduct['bistro-bis-001'],
    ).toBeUndefined()

    // Registered (as the catalog store does on load) → now addable.
    registerCatalogueProducts([dbProduct])
    useCartStore.getState().setQty('bistro-bis-001', 12)
    expect(useCartStore.getState().qtyByProduct['bistro-bis-001']).toBe(12)
  })

  it('starts from an EMPTY cart — no demo pre-fill inflating the hero gauge', () => {
    const { qtyByProduct, variantByProduct } = useCartStore.getState()
    const snapshot = createCartSnapshot({ qtyByProduct, variantByProduct })

    expect(qtyByProduct).toEqual({})
    expect(snapshot.items).toHaveLength(0)
    expect(snapshot.totalUnits).toBe(0)
    expect(snapshot.fill.percent).toBe(0)
  })

  it('purges the legacy demo cart (p1:50/p3:10) from persisted storage on migrate', async () => {
    localStorage.setItem(
      'container-club-cart',
      JSON.stringify({
        state: {
          qtyByProduct: { p1: 50, p3: 10, p4: 20 },
          variantByProduct: {},
          preferredContainerType: null,
          containerPreferenceSource: null,
        },
        version: 0,
      }),
    )

    await useCartStore.persist.rehydrate()
    const qty = useCartStore.getState().qtyByProduct

    // Les lignes de démo héritées disparaissent, les choix réels restent.
    expect(qty.p1).toBeUndefined()
    expect(qty.p3).toBeUndefined()
    expect(qty.p4).toBe(20)
  })

  it('normalizes chair quantities through the shared business rule', () => {
    useCartStore.getState().setQty('p1', 51)

    expect(useCartStore.getState().qtyByProduct.p1).toBe(60)
  })

  it('keeps table quantities editable by unit', () => {
    useCartStore.getState().setQty('p3', 11)

    expect(useCartStore.getState().qtyByProduct.p3).toBe(11)
  })

  it('updates variants without changing quantities', () => {
    useCartStore.getState().setQty('p1', 50)
    useCartStore.getState().setVariant('p1', 'v1c')
    const state = useCartStore.getState()

    expect(state.variantByProduct.p1).toBe('v1c')
    expect(state.qtyByProduct.p1).toBe(50)
  })

  it('persists cart selections for full page navigation', () => {
    useCartStore.getState().setQty('p1', 60)

    const persisted = JSON.parse(
      localStorage.getItem('container-club-cart') ?? '{}',
    )

    expect(persisted.state.qtyByProduct.p1).toBe(60)
  })

  it('automatically opens a 40 foot container when the cart exceeds the active 20 foot capacity', async () => {
    useCartStore.getState().setQty('p1', 400)

    const { result } = renderHook(() =>
      useCart({ products: PRODUCTS, capacityCbm: 28 }),
    )

    await waitFor(() => {
      expect(result.current.preferredContainerType).toBe('40_hc')
    })
    expect(result.current.containerPreferenceSource).toBe('auto')
    expect(result.current.fill.capacity).toBe(66)
  })

  it('returns to the active 20 foot container when an automatic upgrade is no longer needed', async () => {
    useCartStore.getState().setQty('p1', 400)

    const { result } = renderHook(() =>
      useCart({ products: PRODUCTS, capacityCbm: 28 }),
    )

    await waitFor(() => {
      expect(result.current.preferredContainerType).toBe('40_hc')
    })

    act(() => {
      useCartStore.getState().setQty('p1', 50)
    })

    await waitFor(() => {
      expect(result.current.preferredContainerType).toBeNull()
    })
    expect(result.current.fill.capacity).toBe(28)
  })
})
