import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { PRODUCTS } from '@/lib/products'
import { createCartSnapshot, useCart, useCartStore } from '@/stores/cart.store'

describe('cart store', () => {
  beforeEach(() => {
    localStorage.clear()
    useCartStore.getState().resetCart()
  })

  it('starts with an empty cart', () => {
    const { qtyByProduct, variantByProduct } = useCartStore.getState()
    const snapshot = createCartSnapshot({ qtyByProduct, variantByProduct })

    expect(qtyByProduct).toEqual({})
    expect(snapshot.items).toHaveLength(0)
    expect(snapshot.totalUnits).toBe(0)
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
    useCartStore.getState().setVariant('p1', 'v1c')
    const state = useCartStore.getState()

    expect(state.variantByProduct.p1).toBe('v1c')
    expect(state.qtyByProduct.p1).toBeUndefined()
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
