// Résolution de la voie de fulfillment d'une ligne de projet (lot 1).
//
// Règles absolues :
// - la quantité demandée est n'importe quel entier positif ; le MOQ ne
//   bloque JAMAIS : une quantité sous le minimum reste un projet valide ;
// - le stock réel (stock_lines) est consulté AVANT de considérer une
//   quantité sous MOQ comme un problème ;
// - aucune disponibilité n'est fabriquée : sans voie automatique, la ligne
//   part en manual_review avec des raisons structurées, jamais en erreur ;
// - coloris ou dimensions hors catalogue = confirmation usine (manual_review)
//   sauf preuve contraire déclarée par un admin (lot 5).

import { getQuantityRule, variantMinimum } from '@/lib/quantity'
import type { Product } from '@/lib/products'
import type {
  CommercialReason,
  FulfillmentContext,
  FulfillmentMode,
  FulfillmentOption,
  PriceBasis,
  StockAvailability,
  StudioProjectItem,
} from './types'

export interface FulfillmentResolution {
  readonly mode: FulfillmentMode
  readonly reasons: ReadonlyArray<CommercialReason>
  readonly priceBasis: PriceBasis
  /** Minimum de série applicable (MOQ ou minimum coloris), à titre informatif. */
  readonly minimumRequired: number
  /** Unités réellement disponibles en stock pour cette ligne. */
  readonly stockAvailable: number
  readonly stockLineIds: ReadonlyArray<string>
  readonly optionId: string | null
}

function isOptionLive(option: FulfillmentOption, now: Date): boolean {
  if (!option.isActive) return false
  if (option.availableFrom && new Date(option.availableFrom) > now) return false
  if (option.expiresAt && new Date(option.expiresAt) <= now) return false
  return true
}

function optionCovers(option: FulfillmentOption, quantity: number): boolean {
  if (option.minQuantity !== null && quantity < option.minQuantity) return false
  if (option.maxQuantity !== null && quantity > option.maxQuantity) return false
  return true
}

function optionsFor(
  item: StudioProjectItem,
  options: ReadonlyArray<FulfillmentOption>,
  now: Date,
): ReadonlyArray<FulfillmentOption> {
  return options.filter(
    (option) =>
      option.productId === item.productId &&
      (option.variantId === null || option.variantId === item.variantId) &&
      isOptionLive(option, now),
  )
}

export function stockFor(
  item: Pick<StudioProjectItem, 'productId' | 'variantId'>,
  stock: ReadonlyArray<StockAvailability>,
): ReadonlyArray<StockAvailability> {
  return stock.filter(
    (line) =>
      line.productId === item.productId &&
      line.variantId === item.variantId &&
      line.availableUnits > 0,
  )
}

export function resolveFulfillment(
  item: StudioProjectItem,
  product: Product,
  context: FulfillmentContext,
): FulfillmentResolution {
  const now = context.now ?? new Date()
  const quantity = Math.max(1, Math.trunc(item.requestedQuantity))
  const variant = product.variants.find((entry) => entry.id === item.variantId)
  const rule = getQuantityRule(product, variant)
  const minimumRequired = Math.max(1, rule.minimum)
  const stockLines = stockFor(item, context.stock)
  const stockAvailable = stockLines.reduce(
    (sum, line) => sum + line.availableUnits,
    0,
  )
  const base = {
    minimumRequired,
    stockAvailable,
    stockLineIds: stockLines.map((line) => line.stockLineId),
  }

  // 1. Demandes hors catalogue : confirmation usine, toujours.
  const customReasons: CommercialReason[] = []
  if (item.customColour) customReasons.push('custom_colour_requested')
  if (item.customDimensions) customReasons.push('custom_tabletop_requested')
  if (customReasons.length > 0) {
    return {
      ...base,
      mode: 'manual_review',
      reasons: customReasons,
      priceBasis: 'container',
      optionId: null,
    }
  }

  // 2. Produit « sur demande » : prix de projet, jamais automatique.
  if (product.visibility === 'on_request') {
    return {
      ...base,
      mode: 'manual_review',
      reasons: ['on_request_product'],
      priceBasis: 'container',
      optionId: null,
    }
  }

  // 3. Le stock réel couvre la demande : aucune contrainte de série.
  if (stockAvailable >= quantity) {
    return {
      ...base,
      mode: 'stock',
      reasons: [],
      priceBasis: 'stock',
      optionId: null,
    }
  }

  const liveOptions = optionsFor(item, context.options, now)
  const shortfallReasons: CommercialReason[] = []
  if (quantity < product.moqUnits) shortfallReasons.push('below_moq')
  if (variantMinimum(variant) > quantity) shortfallReasons.push('colour_minimum')
  if (stockAvailable > 0) shortfallReasons.push('stock_insufficient')

  // 4. Quantité au niveau de la série : production standard.
  if (quantity >= minimumRequired) {
    const standard = liveOptions.find(
      (option) =>
        option.mode === 'standard_production' && optionCovers(option, quantity),
    )
    if (standard) {
      return {
        ...base,
        mode: 'standard_production',
        reasons: context.productionOpen ? [] : ['production_not_open'],
        priceBasis: standard.priceBasis,
        optionId: standard.id,
      }
    }
  }

  // 5. Regroupement confirmé par un admin couvrant la quantité.
  const grouped = liveOptions.find(
    (option) =>
      option.mode === 'grouped_production' &&
      option.confirmedBy !== null &&
      optionCovers(option, quantity),
  )
  if (grouped) {
    return {
      ...base,
      mode: 'grouped_production',
      reasons: [],
      priceBasis: grouped.priceBasis,
      optionId: grouped.id,
    }
  }

  // 6. Aucune voie automatique : étude manuelle, jamais un refus.
  const reasons: CommercialReason[] =
    shortfallReasons.length > 0 ? shortfallReasons : ['no_fulfillment_path']
  return {
    ...base,
    mode: 'manual_review',
    reasons,
    priceBasis: 'container',
    optionId: null,
  }
}
