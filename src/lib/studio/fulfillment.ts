// Résolution de la voie de fulfillment d'une ligne de projet (lot 1).
//
// Règles absolues :
// - la quantité demandée est n'importe quel entier positif ; le MOQ ne
//   bloque JAMAIS : une quantité sous le minimum reste un projet valide ;
// - le stock réel (stock_lines) est consulté AVANT de considérer une
//   quantité sous MOQ comme un problème ;
// - une voie n'est CONFIRMÉE que par (1) du stock réel couvrant la quantité,
//   (2) une standard_production explicitement confirmée par un admin pour ce
//   produit/variant, (3) une grouped_production explicitement confirmée.
//   Un MOQ, une option semée (seed_moq) ou n'importe quel container ouvert ne
//   confirment rien : ils ne produisent jamais reservation_ready ;
// - une standard_production NON confirmée (dont toute option seed_moq) est
//   une information de série : la ligne reste quotable, avec la raison
//   production_unconfirmed, mais n'est pas réservable ;
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
  /** Vrai uniquement si la voie retenue est CONFIRMÉE (stock réel couvrant la
   *  quantité, ou option confirmée par un admin). Jamais vrai en
   *  manual_review ni sur une option non confirmée. */
  readonly confirmed: boolean
  /** Minimum de série applicable (MOQ ou minimum coloris), à titre informatif. */
  readonly minimumRequired: number
  /** Unités réellement disponibles en stock pour cette ligne. */
  readonly stockAvailable: number
  readonly stockLineIds: ReadonlyArray<string>
  readonly optionId: string | null
}

/** Voies confirmées possibles pour un produit (niveau readiness). */
export type ConfirmedFulfillmentPath =
  | 'stock'
  | 'standard_production'
  | 'grouped_production'

export function isOptionLive(option: FulfillmentOption, now: Date): boolean {
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

function optionApplies(
  option: FulfillmentOption,
  productId: string,
  variantId: string | undefined,
): boolean {
  if (option.productId !== productId) return false
  if (variantId === undefined) return true
  return option.variantId === null || option.variantId === variantId
}

function optionsFor(
  item: StudioProjectItem,
  options: ReadonlyArray<FulfillmentOption>,
  now: Date,
): ReadonlyArray<FulfillmentOption> {
  return options.filter(
    (option) =>
      optionApplies(option, item.productId, item.variantId) &&
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

/**
 * Voies CONFIRMÉES existantes pour un produit (ou un de ses coloris),
 * indépendamment d'une quantité : du stock réel disponible, une production
 * standard confirmée par un admin, un regroupement confirmé par un admin.
 * Une option non confirmée n'apparaît jamais ici.
 */
export function confirmedFulfillmentPaths(
  productId: string,
  context: FulfillmentContext,
  variantId?: string,
): ReadonlyArray<ConfirmedFulfillmentPath> {
  const now = context.now ?? new Date()
  const paths = new Set<ConfirmedFulfillmentPath>()
  const stockLines = variantId
    ? stockFor({ productId, variantId }, context.stock)
    : context.stock.filter(
        (line) => line.productId === productId && line.availableUnits > 0,
      )
  if (stockLines.length > 0) paths.add('stock')

  for (const option of context.options) {
    if (!option.isConfirmed) continue
    if (!optionApplies(option, productId, variantId)) continue
    if (!isOptionLive(option, now)) continue
    paths.add(option.mode)
  }
  return [...paths]
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
  const manualReview = (reasons: ReadonlyArray<CommercialReason>): FulfillmentResolution => ({
    ...base,
    mode: 'manual_review',
    reasons,
    priceBasis: 'container',
    confirmed: false,
    optionId: null,
  })

  // 1. Demandes hors catalogue : confirmation usine, toujours.
  const customReasons: CommercialReason[] = []
  if (item.customColour) customReasons.push('custom_colour_requested')
  if (item.customDimensions) customReasons.push('custom_tabletop_requested')
  if (customReasons.length > 0) return manualReview(customReasons)

  // 2. Produit « sur demande » : prix de projet, jamais automatique.
  if (product.visibility === 'on_request') {
    return manualReview(['on_request_product'])
  }

  // 3. Le stock réel couvre la demande : voie confirmée, aucune contrainte
  //    de série (le MOQ ne s'applique pas au stock).
  if (stockAvailable >= quantity) {
    return {
      ...base,
      mode: 'stock',
      reasons: [],
      priceBasis: 'stock',
      confirmed: true,
      optionId: null,
    }
  }

  const liveOptions = optionsFor(item, context.options, now)
  const shortfallReasons: CommercialReason[] = []
  if (quantity < product.moqUnits) shortfallReasons.push('below_moq')
  if (variantMinimum(variant) > quantity) shortfallReasons.push('colour_minimum')
  if (stockAvailable > 0) shortfallReasons.push('stock_insufficient')

  // 4. Quantité au niveau de la série : production standard. Une option
  //    CONFIRMÉE par un admin est une voie de réservation ; une option non
  //    confirmée (seed_moq ou déclarée sans confirmation) reste une base de
  //    devis avec la raison production_unconfirmed.
  if (quantity >= minimumRequired) {
    const standards = liveOptions.filter(
      (option) =>
        option.mode === 'standard_production' && optionCovers(option, quantity),
    )
    const standard =
      standards.find((option) => option.isConfirmed) ?? standards[0]
    if (standard) {
      return {
        ...base,
        mode: 'standard_production',
        reasons: standard.isConfirmed ? [] : ['production_unconfirmed'],
        priceBasis: standard.priceBasis,
        confirmed: standard.isConfirmed,
        optionId: standard.id,
      }
    }
  }

  // 5. Regroupement CONFIRMÉ par un admin couvrant la quantité.
  const grouped = liveOptions.find(
    (option) =>
      option.mode === 'grouped_production' &&
      option.isConfirmed &&
      optionCovers(option, quantity),
  )
  if (grouped) {
    return {
      ...base,
      mode: 'grouped_production',
      reasons: [],
      priceBasis: grouped.priceBasis,
      confirmed: true,
      optionId: grouped.id,
    }
  }

  // 6. Aucune voie automatique : étude manuelle, jamais un refus.
  return manualReview(
    shortfallReasons.length > 0 ? shortfallReasons : ['no_fulfillment_path'],
  )
}
