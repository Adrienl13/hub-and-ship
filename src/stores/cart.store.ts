import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getDefaultVariant } from '@/lib/catalogue'
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
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Json } from '@/lib/supabase/types'

export type ProductVariantSelection = Record<string, string>
export type ProductQuantitySelection = Record<string, number>
export type ContainerPreferenceSource = 'manual' | 'auto'

export interface CartSnapshot {
  items: CartItem[]
  totals: OrderTotals
  fill: ReturnType<typeof calculateContainerFill>
  totalUnits: number
}

type PublicCartLinePrice = {
  readonly product_id: string
  readonly quantity: number
  readonly unit_price_ht: number | string
  readonly tier_applied: string
  readonly parameters_version: number
}

type PublicCartPricingClient = {
  readonly rpc: (
    fn: 'get_public_product_prices_for_lines',
    args: { readonly p_lines: Json },
  ) => PromiseLike<{
    readonly data: ReadonlyArray<PublicCartLinePrice> | null
    readonly error: { readonly message: string } | null
  }>
}

type LinePriceState = Record<
  string,
  {
    readonly quantity: number
    readonly unitPriceHt: number
    readonly tierApplied: string
    readonly parametersVersion: number
  }
>

interface CartStoreState {
  variantByProduct: ProductVariantSelection
  qtyByProduct: ProductQuantitySelection
  /** User-chosen container format (null = use the active DB container).
   *  Persisted across reloads so distributors don't lose their pick. */
  preferredContainerType: ContainerType | null
  containerPreferenceSource: ContainerPreferenceSource | null
  setQty: (productId: string, quantity: number) => void
  setVariant: (productId: string, variantId: string) => void
  setPreferredContainerType: (
    type: ContainerType | null,
    source?: ContainerPreferenceSource,
  ) => void
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
  return {}
}

function isLegacyDemoCart(quantityByProduct: unknown): boolean {
  if (
    !quantityByProduct ||
    typeof quantityByProduct !== 'object' ||
    Array.isArray(quantityByProduct)
  ) {
    return false
  }

  const entries = Object.entries(quantityByProduct)
  return (
    entries.length === 2 &&
    entries.some(([id, quantity]) => id === 'p1' && quantity === 50) &&
    entries.some(([id, quantity]) => id === 'p3' && quantity === 10)
  )
}

function migratePersistedCart(persisted: unknown): unknown {
  if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) {
    return persisted
  }

  const state = persisted as Partial<CartStoreState>
  if (!isLegacyDemoCart(state.qtyByProduct)) return persisted

  return {
    ...state,
    qtyByProduct: createDefaultQtyByProduct(),
    preferredContainerType: null,
    containerPreferenceSource: null,
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
      setQty: (productId, quantity) =>
        set((previous) => {
          const product = PRODUCTS.find((item) => item.id === productId)
          if (!product) return previous

          const nextQty = sanitizeOrderQuantity(
            quantity,
            getQuantityRule(product),
          )
          const prevQty = previous.qtyByProduct[productId] ?? 0
          if (prevQty === 0 && nextQty > 0) {
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
    }),
    {
      name: 'container-club-cart',
      version: 1,
      migrate: migratePersistedCart,
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
  const [linePrices, setLinePrices] = useState<LinePriceState>({})

  const cartPriceLines = useMemo(() => {
    const sourceProducts = products ?? PRODUCTS
    return sourceProducts.flatMap((product) => {
      const quantity = qtyByProduct[product.id] ?? 0
      if (quantity <= 0) return []
      return [{ product_id: product.id, quantity }]
    })
  }, [products, qtyByProduct])

  const cartPriceKey = useMemo(
    () =>
      cartPriceLines
        .map((line) => `${line.product_id}:${line.quantity}`)
        .sort()
        .join('|'),
    [cartPriceLines],
  )

  useEffect(() => {
    if (cartPriceLines.length === 0) {
      setLinePrices({})
      return
    }

    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setLinePrices({})
      return
    }

    let cancelled = false
    async function loadLinePrices() {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as PublicCartPricingClient
      const { data, error } = await client.rpc(
        'get_public_product_prices_for_lines',
        { p_lines: cartPriceLines as unknown as Json },
      )

      if (cancelled) return
      if (error) {
        console.error('useCart: cart pricing fetch failed', error)
        setLinePrices({})
        return
      }

      const next: LinePriceState = {}
      for (const row of (data ?? []) as ReadonlyArray<PublicCartLinePrice>) {
        const unitPriceHt = Number(row.unit_price_ht)
        if (!Number.isFinite(unitPriceHt)) continue
        next[row.product_id] = {
          quantity: row.quantity,
          unitPriceHt,
          tierApplied: row.tier_applied,
          parametersVersion: row.parameters_version,
        }
      }
      setLinePrices(next)
    }

    void loadLinePrices()
    return () => {
      cancelled = true
    }
  }, [cartPriceKey, cartPriceLines])

  const pricedProducts = useMemo(() => {
    const sourceProducts = products ?? PRODUCTS
    return sourceProducts.map((product) => {
      const price = linePrices[product.id]
      const quantity = qtyByProduct[product.id] ?? 0
      if (!price || price.quantity !== quantity) return product
      return { ...product, basePriceHt: price.unitPriceHt }
    })
  }, [linePrices, products, qtyByProduct])

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
        products: pricedProducts,
        capacityCbm: effectiveCapacityCbm,
      }),
    [qtyByProduct, variantByProduct, pricedProducts, effectiveCapacityCbm],
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
    linePrices,
  }
}
