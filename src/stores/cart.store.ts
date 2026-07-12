import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getDefaultVariant } from '@/lib/catalogue'
import { resolveCatalogueProduct } from '@/lib/catalogue/registry'
import {
  calculateContainerFill,
  calculateOrder,
  type CartItem,
  type OrderTotals,
} from '@/lib/order'
import { getContainerUsableCbm } from '@/lib/container/pricing'
import { CURRENT_CONTAINER, PRODUCTS, type Product } from '@/lib/products'
import { getQuantityRule, sanitizeOrderQuantity } from '@/lib/quantity'
import type { ContainerType } from '@/lib/supabase/types'
import { AnalyticsEvent, track } from '@/lib/analytics'

export type ProductVariantSelection = Record<string, string>
export type ProductQuantitySelection = Record<string, number>
export type ContainerPreferenceSource = 'manual' | 'auto'

export interface CartSnapshot {
  items: CartItem[]
  totals: OrderTotals
  fill: ReturnType<typeof calculateContainerFill>
  totalUnits: number
}

interface CartStoreState {
  variantByProduct: ProductVariantSelection
  qtyByProduct: ProductQuantitySelection
  /** User-chosen container format (null = use the active DB container).
   *  Persisted across reloads so distributors don't lose their pick. */
  preferredContainerType: ContainerType | null
  containerPreferenceSource: ContainerPreferenceSource | null
  setQty: (
    productId: string,
    quantity: number,
    options?: { readonly silent?: boolean },
  ) => void
  setVariant: (productId: string, variantId: string) => void
  setPreferredContainerType: (
    type: ContainerType | null,
    source?: ContainerPreferenceSource,
  ) => void
  resetCart: () => void
  /** Vide complètement le panier (après une réservation confirmée) —
   *  contrairement à resetCart qui restaure le panier de démonstration. */
  clearCart: () => void
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
      preferredContainerType: null,
      containerPreferenceSource: null,
      setQty: (productId, quantity, options) =>
        set((previous) => {
          // Résout via le registre du catalogue live (mock en secours) : sans
          // cela, seuls les 6 produits de démo étaient ajoutables au panier.
          const product = resolveCatalogueProduct(productId)
          if (!product) return previous

          const nextQty = sanitizeOrderQuantity(
            quantity,
            getQuantityRule(product),
          )
          const prevQty = previous.qtyByProduct[productId] ?? 0
          // silent = restauration programmatique (lien partagé) : ouvrir un
          // lien ne constitue pas un ajout au panier de l'utilisateur.
          if (!options?.silent && prevQty === 0 && nextQty > 0) {
            track(AnalyticsEvent.AddToCart, { product: productId })
          }

          return {
            qtyByProduct: {
              ...previous.qtyByProduct,
              [productId]: nextQty,
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
      setPreferredContainerType: (type, source = 'manual') =>
        set({
          preferredContainerType: type,
          containerPreferenceSource: type ? source : null,
        }),
      resetCart: () =>
        set({
          variantByProduct: createDefaultVariantByProduct(),
          qtyByProduct: createDefaultQtyByProduct(),
          preferredContainerType: null,
          containerPreferenceSource: null,
        }),
      clearCart: () =>
        set({
          variantByProduct: {},
          qtyByProduct: {},
          preferredContainerType: null,
          containerPreferenceSource: null,
        }),
    }),
    {
      name: 'container-club-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        variantByProduct: state.variantByProduct,
        qtyByProduct: state.qtyByProduct,
        preferredContainerType: state.preferredContainerType,
        containerPreferenceSource: state.containerPreferenceSource,
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
  const preferredContainerType = useCartStore(
    (state) => state.preferredContainerType,
  )
  const containerPreferenceSource = useCartStore(
    (state) => state.containerPreferenceSource,
  )
  const setQty = useCartStore((state) => state.setQty)
  const setVariant = useCartStore((state) => state.setVariant)
  const setPreferredContainerType = useCartStore(
    (state) => state.setPreferredContainerType,
  )

  const products = options.products
  const capacityCbm = options.capacityCbm
  const baseCapacityCbm = capacityCbm ?? CURRENT_CONTAINER.capacityCbm

  // If the user actively picked a container format (e.g. switched to a
  // 40' GP for a bigger order), its usable cbm overrides the active
  // DB container — so the fill bar, the 3D shell and every downstream
  // KPI see the same target volume.
  const effectiveCapacityCbm = preferredContainerType
    ? getContainerUsableCbm(preferredContainerType)
    : baseCapacityCbm

  const snapshot = useMemo(
    () =>
      createCartSnapshot({
        qtyByProduct,
        variantByProduct,
        products,
        capacityCbm: effectiveCapacityCbm,
      }),
    [qtyByProduct, variantByProduct, products, effectiveCapacityCbm],
  )

  useEffect(() => {
    const usedCbm = snapshot.fill.usedCbm

    if (usedCbm > baseCapacityCbm && preferredContainerType !== '40_hc') {
      setPreferredContainerType('40_hc', 'auto')
      return
    }

    if (
      containerPreferenceSource === 'auto' &&
      preferredContainerType === '40_hc' &&
      usedCbm <= baseCapacityCbm
    ) {
      setPreferredContainerType(null, 'auto')
    }
  }, [
    baseCapacityCbm,
    containerPreferenceSource,
    preferredContainerType,
    setPreferredContainerType,
    snapshot.fill.usedCbm,
  ])

  return {
    ...snapshot,
    variantByProduct,
    qtyByProduct,
    preferredContainerType,
    containerPreferenceSource,
    setQty,
    setVariant,
    setPreferredContainerType,
  }
}
