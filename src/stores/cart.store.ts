import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getDefaultVariant } from '@/lib/catalogue'
import {
  calculateContainerFill,
  calculateOrder,
  type CartItem,
  type OrderTotals,
} from '@/lib/order'
import { CURRENT_CONTAINER, PRODUCTS, type Product } from '@/lib/products'
import { getQuantityRule, sanitizeOrderQuantity } from '@/lib/quantity'

export type ProductVariantSelection = Record<string, string>
export type ProductQuantitySelection = Record<string, number>

export interface CartSnapshot {
  items: CartItem[]
  totals: OrderTotals
  fill: ReturnType<typeof calculateContainerFill>
  totalUnits: number
}

interface CartStoreState {
  variantByProduct: ProductVariantSelection
  qtyByProduct: ProductQuantitySelection
  setQty: (productId: string, quantity: number) => void
  setVariant: (productId: string, variantId: string) => void
  resetCart: () => void
}

function createDefaultVariantByProduct(
  products: Product[] = PRODUCTS,
): ProductVariantSelection {
  return Object.fromEntries(
    products.map((product) => [product.id, getDefaultVariant(product).id]),
  )
}

function createDefaultQtyByProduct(): ProductQuantitySelection {
  return {
    p1: 50,
    p3: 10,
  }
}

export function createCartSnapshot({
  qtyByProduct,
  variantByProduct,
  products = PRODUCTS,
  capacityCbm = CURRENT_CONTAINER.capacityCbm,
}: {
  qtyByProduct: ProductQuantitySelection
  variantByProduct: ProductVariantSelection
  products?: Product[]
  capacityCbm?: number
}): CartSnapshot {
  const items = products.flatMap((product) => {
    const quantity = qtyByProduct[product.id] ?? 0
    if (quantity <= 0) return []

    const variantId =
      variantByProduct[product.id] ?? getDefaultVariant(product).id
    const variant =
      product.variants.find((item) => item.id === variantId) ??
      getDefaultVariant(product)

    return [{ product, variant, quantity }]
  })

  const totals = calculateOrder(items)
  const fill = calculateContainerFill(items, capacityCbm)
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    items,
    totals,
    fill,
    totalUnits,
  }
}

export const useCartStore = create<CartStoreState>()(
  persist(
    (set) => ({
      variantByProduct: createDefaultVariantByProduct(),
      qtyByProduct: createDefaultQtyByProduct(),
      setQty: (productId, quantity) =>
        set((previous) => {
          const product = PRODUCTS.find((item) => item.id === productId)
          if (!product) return previous

          return {
            qtyByProduct: {
              ...previous.qtyByProduct,
              [productId]: sanitizeOrderQuantity(
                quantity,
                getQuantityRule(product),
              ),
            },
          }
        }),
      setVariant: (productId, variantId) =>
        set((previous) => ({
          variantByProduct: {
            ...previous.variantByProduct,
            [productId]: variantId,
          },
        })),
      resetCart: () =>
        set({
          variantByProduct: createDefaultVariantByProduct(),
          qtyByProduct: createDefaultQtyByProduct(),
        }),
    }),
    {
      name: 'container-club-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        variantByProduct: state.variantByProduct,
        qtyByProduct: state.qtyByProduct,
      }),
    },
  ),
)

export interface UseCartOptions {
  /**
   * Catalogue to compute cart items + totals against. Defaults to the mock
   * `PRODUCTS` for backwards compatibility — callers that have a live DB
   * catalogue (via `useCatalog()`) should pass it here so the displayed
   * cart matches what the admin published.
   */
  readonly products?: Product[]
  /** Container capacity for the fill bar. Defaults to the mock capacity. */
  readonly capacityCbm?: number
}

export function useCart(options: UseCartOptions = {}) {
  const variantByProduct = useCartStore((state) => state.variantByProduct)
  const qtyByProduct = useCartStore((state) => state.qtyByProduct)
  const setQty = useCartStore((state) => state.setQty)
  const setVariant = useCartStore((state) => state.setVariant)

  const products = options.products
  const capacityCbm = options.capacityCbm

  const snapshot = useMemo(
    () =>
      createCartSnapshot({
        qtyByProduct,
        variantByProduct,
        products,
        capacityCbm,
      }),
    [qtyByProduct, variantByProduct, products, capacityCbm],
  )

  return {
    ...snapshot,
    variantByProduct,
    qtyByProduct,
    setQty,
    setVariant,
  }
}
