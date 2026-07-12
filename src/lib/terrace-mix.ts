import { getDefaultVariant } from '@/lib/catalogue'
import { calculateOrder, type CartItem, type OrderTotals } from '@/lib/order'
import { getQuantityRule, sanitizeOrderQuantity } from '@/lib/quantity'
import type { Product } from '@/lib/products'

// D4 — configurateur de terrasse : « Votre terrasse : 40 couverts » devient
// un mix chaises + tables chiffré (prix container vs équivalent retail).
// Aucune nouvelle logique de pricing : tout passe par calculateOrder.

export const MIN_COVERS = 10
export const MAX_COVERS = 400
export const DEFAULT_COVERS = 40

/**
 * Couverts par table, déduits des dimensions réelles du plateau : un
 * 140 cm+ de long assoit 6, les formats bistrot (rond 60/70/80, carré)
 * assoient 4. Même règle que les fiches produit (« 6 couverts » sur les
 * 160×80, « 2 à 4 couverts » sur les rondes 80).
 */
export function coversPerTable(table: Product): number {
  return table.dimensions.l >= 140 ? 6 : 4
}

function cheapestOf(
  products: ReadonlyArray<Product>,
  category: Product['category'],
): Product | null {
  let best: Product | null = null
  for (const product of products) {
    if (product.category !== category) continue
    if (!best || product.basePriceHt < best.basePriceHt) best = product
  }
  return best
}

export function pickDefaultChair(
  products: ReadonlyArray<Product>,
): Product | null {
  return cheapestOf(products, 'chair')
}

export function pickDefaultTable(
  products: ReadonlyArray<Product>,
): Product | null {
  return cheapestOf(products, 'table')
}

export interface TerraceMix {
  readonly chair: Product
  readonly table: Product
  /** Couverts demandés par l'utilisateur. */
  readonly covers: number
  /** Chaises réellement commandables (arrondies au MOQ/pas de série). */
  readonly chairUnits: number
  readonly tableUnits: number
  readonly coversPerTable: number
  /** true si la règle de série a arrondi les chaises au-dessus des couverts. */
  readonly chairAdjusted: boolean
  readonly items: ReadonlyArray<CartItem>
  readonly totals: OrderTotals
}

export function buildTerraceMix({
  covers,
  chair,
  table,
}: {
  readonly covers: number
  readonly chair: Product
  readonly table: Product
}): TerraceMix | null {
  const clamped = Math.min(
    MAX_COVERS,
    Math.max(MIN_COVERS, Math.trunc(covers)),
  )
  if (!Number.isFinite(clamped) || clamped <= 0) return null

  const chairUnits = sanitizeOrderQuantity(clamped, getQuantityRule(chair))
  const seats = coversPerTable(table)
  const tableUnits = Math.max(
    1,
    sanitizeOrderQuantity(
      Math.ceil(clamped / seats),
      getQuantityRule(table),
    ),
  )
  if (chairUnits <= 0 || tableUnits <= 0) return null

  const items: CartItem[] = [
    { product: chair, variant: getDefaultVariant(chair), quantity: chairUnits },
    { product: table, variant: getDefaultVariant(table), quantity: tableUnits },
  ]

  return {
    chair,
    table,
    covers: clamped,
    chairUnits,
    tableUnits,
    coversPerTable: seats,
    chairAdjusted: chairUnits > clamped,
    items,
    totals: calculateOrder(items),
  }
}
