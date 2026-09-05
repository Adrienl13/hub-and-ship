import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
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
import { AnalyticsEvent, track, trackEcommerce } from '@/lib/analytics'

export type ProductVariantSelection = Record<string, string>
/** Quantités par LIGNE `${productId}::${variantId}` — deux designs du même
 *  produit sont deux lignes de commande distinctes (essentiel pour la
 *  commande usine : chaque coloris est fabriqué séparément). */
export type LineQuantitySelection = Record<string, number>
export type ContainerPreferenceSource = 'manual' | 'auto'

/** Sentinelle utilisée quand le design n'est pas connu au moment de l'écriture
 *  (migration d'un ancien panier) : résolue en design par défaut à la lecture. */
const DEFAULT_VARIANT_KEY = '__default__'

export function cartLineKey(productId: string, variantId: string): string {
  return `${productId}::${variantId}`
}

function parseLineKey(key: string): { productId: string; variantId: string } {
  const separator = key.indexOf('::')
  if (separator === -1) {
    return { productId: key, variantId: DEFAULT_VARIANT_KEY }
  }
  return {
    productId: key.slice(0, separator),
    variantId: key.slice(separator + 2),
  }
}

export interface CartSnapshot {
  items: CartItem[]
  totals: OrderTotals
  fill: ReturnType<typeof calculateContainerFill>
  totalUnits: number
}

interface CartStoreState {
  variantByProduct: ProductVariantSelection
  qtyByLine: LineQuantitySelection
  /** User-chosen container format (null = use the active DB container).
   *  Persisted across reloads so distributors don't lose their pick. */
  preferredContainerType: ContainerType | null
  containerPreferenceSource: ContainerPreferenceSource | null
  /** Quantité pour le design ACTUELLEMENT sélectionné du produit (celui de
   *  variantByProduct). C'est le geste des cards catalogue : « je choisis un
   *  design, je mets une quantité ». */
  setQty: (
    productId: string,
    quantity: number,
    options?: { readonly silent?: boolean },
  ) => void
  /** Quantité d'une ligne précise (panier latéral, sidebar) : ne dépend pas
   *  du design sélectionné dans le catalogue. */
  setLineQty: (
    productId: string,
    variantId: string,
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
   *  contrairement à resetCart qui restaure aussi les variantes par défaut
   *  du catalogue. Les deux laissent les quantités vides. */
  clearCart: () => void
}

function createDefaultVariantByProduct(
  products: Product[] = PRODUCTS,
): ProductVariantSelection {
  return Object.fromEntries(
    products.map((product) => [product.id, getDefaultVariant(product).id]),
  )
}

// Le panier démarre VIDE : l'ancien panier de démonstration (50 chaises +
// 10 tables pré-remplies) gonflait artificiellement la jauge « Remplissage »
// du hero pour chaque nouveau visiteur — une fausse preuve sociale (audit D7).
function createDefaultQtyByLine(): LineQuantitySelection {
  return {}
}

function resolveVariant(product: Product, variantId: string) {
  if (variantId === DEFAULT_VARIANT_KEY) return getDefaultVariant(product)
  return (
    product.variants.find((item) => item.id === variantId) ??
    getDefaultVariant(product)
  )
}

function selectedVariantId(
  product: Product,
  variantByProduct: ProductVariantSelection,
): string {
  return variantByProduct[product.id] ?? getDefaultVariant(product).id
}

export function createCartSnapshot({
  qtyByLine,
  products = PRODUCTS,
  capacityCbm = CURRENT_CONTAINER.capacityCbm,
}: {
  qtyByLine: LineQuantitySelection
  products?: Product[]
  capacityCbm?: number
}): CartSnapshot {
  const productById = new Map(products.map((product) => [product.id, product]))

  // Une ligne par (produit, design résolu) — la sentinelle __default__ et
  // l'id réel du design par défaut fusionnent sur la même ligne.
  const lines = new Map<string, CartItem>()
  for (const [key, quantity] of Object.entries(qtyByLine)) {
    if (!quantity || quantity <= 0) continue
    const { productId, variantId } = parseLineKey(key)
    const product = productById.get(productId)
    if (!product) continue
    const variant = resolveVariant(product, variantId)
    const resolvedKey = cartLineKey(product.id, variant.id)
    const existing = lines.get(resolvedKey)
    if (existing) {
      existing.quantity += quantity
    } else {
      lines.set(resolvedKey, { product, variant, quantity })
    }
  }

  // Ordre stable : celui du catalogue, puis l'ordre des designs du produit.
  const items = [...lines.values()].sort((a, b) => {
    const productOrder =
      products.indexOf(a.product) - products.indexOf(b.product)
    if (productOrder !== 0) return productOrder
    return (
      a.product.variants.indexOf(a.variant) -
      b.product.variants.indexOf(b.variant)
    )
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

function writeLineQty(
  previous: CartStoreState,
  productId: string,
  variantId: string,
  quantity: number,
  options?: { readonly silent?: boolean },
): Partial<CartStoreState> | CartStoreState {
  // Résout via le registre du catalogue live (mock en secours) : sans
  // cela, seuls les 6 produits de démo étaient ajoutables au panier.
  const product = resolveCatalogueProduct(productId)
  if (!product) return previous

  const variant = resolveVariant(product, variantId)
  const key = cartLineKey(productId, variant.id)
  const nextQty = sanitizeOrderQuantity(quantity, getQuantityRule(product))
  const prevQty = previous.qtyByLine[key] ?? 0

  // silent = restauration programmatique (lien partagé) : ouvrir un
  // lien ne constitue pas un ajout au panier de l'utilisateur.
  if (!options?.silent && prevQty === 0 && nextQty > 0) {
    const lineValue = Math.round(product.basePriceHt * nextQty * 100) / 100
    track(AnalyticsEvent.AddToCart, {
      product: productId,
      sku: product.sku,
      quantity: nextQty,
      value: lineValue,
    })
    trackEcommerce('add_to_cart', {
      currency: 'EUR',
      value: lineValue,
      items: [
        {
          item_id: product.sku,
          item_name: product.name,
          item_variant: variant.name,
          item_category: product.category,
          price: product.basePriceHt,
          quantity: nextQty,
        },
      ],
    })
    // Confirmation explicite : sans elle, l'acheteur ne sait pas que
    // sa quantité est déjà prise en compte (retour client 07/2026).
    toast.success(`Ajouté à votre commande`, {
      description: `${nextQty} × ${product.name} — ${variant.name}`,
    })
  }
  if (!options?.silent && prevQty > 0 && nextQty === 0) {
    toast(`Retiré de votre commande`, {
      description: `${product.name} — ${variant.name}`,
    })
  }

  const qtyByLine = { ...previous.qtyByLine }
  if (nextQty <= 0) {
    delete qtyByLine[key]
    // Purge aussi l'éventuelle ligne sentinelle héritée du même produit.
    delete qtyByLine[cartLineKey(productId, DEFAULT_VARIANT_KEY)]
  } else {
    qtyByLine[key] = nextQty
  }
  return { qtyByLine }
}

export const useCartStore = create<CartStoreState>()(
  persist(
    (set) => ({
      variantByProduct: createDefaultVariantByProduct(),
      qtyByLine: createDefaultQtyByLine(),
      preferredContainerType: null,
      containerPreferenceSource: null,
      setQty: (productId, quantity, options) =>
        set((previous) => {
          const product = resolveCatalogueProduct(productId)
          if (!product) return previous
          const variantId = selectedVariantId(product, previous.variantByProduct)
          return writeLineQty(previous, productId, variantId, quantity, options)
        }),
      setLineQty: (productId, variantId, quantity, options) =>
        set((previous) =>
          writeLineQty(previous, productId, variantId, quantity, options),
        ),
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
          qtyByLine: createDefaultQtyByLine(),
          preferredContainerType: null,
          containerPreferenceSource: null,
        }),
      clearCart: () =>
        set({
          variantByProduct: {},
          qtyByLine: {},
          preferredContainerType: null,
          containerPreferenceSource: null,
        }),
    }),
    {
      name: 'container-club-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        variantByProduct: state.variantByProduct,
        qtyByLine: state.qtyByLine,
        preferredContainerType: state.preferredContainerType,
        containerPreferenceSource: state.containerPreferenceSource,
      }),
      // v3 : le panier passe de « une quantité par produit » à « une quantité
      // par (produit, design) » — deux designs du même produit ne s'écrasent
      // plus (bug commande usine 08/2026). Les anciens paniers migrent vers la
      // ligne du design qui était sélectionné (ou le design par défaut).
      version: 3,
      migrate: (persisted) => {
        const state = persisted as {
          qtyByProduct?: Record<string, number>
          qtyByLine?: LineQuantitySelection
          variantByProduct?: ProductVariantSelection
        } | null
        if (!state) return state
        if (!state.qtyByLine) state.qtyByLine = {}
        if (state.qtyByProduct) {
          for (const [productId, quantity] of Object.entries(
            state.qtyByProduct,
          )) {
            // v2 purgeait les produits de démo — on ne les ressuscite pas.
            if (/^p[1-6]$/.test(productId)) continue
            if (!quantity || quantity <= 0) continue
            const variantId =
              state.variantByProduct?.[productId] ?? DEFAULT_VARIANT_KEY
            state.qtyByLine[cartLineKey(productId, variantId)] = quantity
          }
          delete state.qtyByProduct
        }
        return state
      },
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
  const qtyByLine = useCartStore((state) => state.qtyByLine)
  const preferredContainerType = useCartStore(
    (state) => state.preferredContainerType,
  )
  const containerPreferenceSource = useCartStore(
    (state) => state.containerPreferenceSource,
  )
  const setQty = useCartStore((state) => state.setQty)
  const setLineQty = useCartStore((state) => state.setLineQty)
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
        qtyByLine,
        products,
        capacityCbm: effectiveCapacityCbm,
      }),
    [qtyByLine, products, effectiveCapacityCbm],
  )

  // Quantité du design SÉLECTIONNÉ de chaque produit — c'est la valeur des
  // steppers du catalogue : changer de design affiche la quantité de CE
  // design (0 s'il n'est pas encore au panier), sans toucher aux autres
  // lignes du même produit.
  const qtyByProduct = useMemo(() => {
    const map: Record<string, number> = {}
    const catalog = products ?? PRODUCTS
    for (const product of catalog) {
      const variantId = selectedVariantId(product, variantByProduct)
      const direct = qtyByLine[cartLineKey(product.id, variantId)] ?? 0
      const legacy =
        variantId === getDefaultVariant(product).id
          ? (qtyByLine[cartLineKey(product.id, DEFAULT_VARIANT_KEY)] ?? 0)
          : 0
      const total = direct + legacy
      if (total > 0) map[product.id] = total
    }
    return map
  }, [qtyByLine, variantByProduct, products])

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
    qtyByLine,
    preferredContainerType,
    containerPreferenceSource,
    setQty,
    setLineQty,
    setVariant,
    setPreferredContainerType,
  }
}
