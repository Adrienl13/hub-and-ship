// Readiness Studio d'un produit (lot 1) : quatre niveaux emboîtés, chacun
// expliqué par des raisons structurées. Aucun booléen opaque.
//
//   discovery  : peut être montré dans le Studio ;
//   project    : peut entrer dans un projet (dimensions et prix présents) ;
//   quote      : peut figurer sur un devis ferme (prix confirmé, non
//                indicatif, produit public, un design photographié) ;
//   reservation: quote + au moins une voie de fulfillment ouverte (stock
//                réel, production standard ouverte, ou regroupement confirmé).
//
// Studio Ready ≠ Quote Ready ≠ Reservation Ready. Un container ouvert est un
// signal de production parmi d'autres, jamais la condition universelle.
//
// Prix : le prix public actif de la base est une vérité commerciale tant
// qu'il n'est pas marqué « sur demande » (visibility) ou « indicatif »
// (data_quality.price = estimated). Il n'est `pending` que s'il est absent.

import { qualityOf } from './data-quality'
import { stockFor } from './fulfillment'
import type {
  DataQualityField,
  FulfillmentContext,
  StudioProduct,
} from './types'

export const READINESS_LEVELS = [
  'discovery',
  'project',
  'quote',
  'reservation',
] as const
export type ReadinessLevel = (typeof READINESS_LEVELS)[number]

export const READINESS_ISSUE_CODES = [
  'inactive',
  'catalog_only',
  'missing_main_image',
  'missing_dimensions',
  'missing_price',
  'price_unconfirmed',
  'price_indicative',
  'on_request_product',
  'retail_below_base',
  'no_variant_image',
  'no_fulfillment_path',
] as const
export type ReadinessIssueCode = (typeof READINESS_ISSUE_CODES)[number]

export interface ReadinessIssue {
  readonly code: ReadinessIssueCode
  readonly field?: DataQualityField
  readonly detail?: string
}

export interface LevelReadiness {
  readonly ready: boolean
  readonly issues: ReadonlyArray<ReadinessIssue>
}

export interface ProductReadiness {
  readonly discovery: LevelReadiness
  readonly project: LevelReadiness
  readonly quote: LevelReadiness
  readonly reservation: LevelReadiness
}

const EMPTY_CONTEXT: FulfillmentContext = {
  stock: [],
  options: [],
  productionOpen: false,
}

function level(issues: ReadonlyArray<ReadinessIssue>): LevelReadiness {
  return { ready: issues.length === 0, issues }
}

function discoveryIssues(product: StudioProduct): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  if (!product.isActive) issues.push({ code: 'inactive' })
  if (product.studio.studioRole === 'catalog_only') {
    issues.push({ code: 'catalog_only' })
  }
  if (!product.mainImageUrl) {
    issues.push({ code: 'missing_main_image', field: 'media' })
  }
  return issues
}

function projectIssues(product: StudioProduct): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const { l, w, h } = product.dimensions
  if (!(l > 0 && w > 0 && h > 0)) {
    issues.push({ code: 'missing_dimensions', field: 'dimensions' })
  }
  if (!(product.basePriceHt > 0)) {
    issues.push({ code: 'missing_price', field: 'price' })
  }
  return issues
}

function quoteIssues(product: StudioProduct): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const price = qualityOf(product.studio.dataQuality, 'price')
  if (price.status === 'pending') {
    issues.push({ code: 'price_unconfirmed', field: 'price' })
  } else if (price.status === 'estimated') {
    issues.push({ code: 'price_indicative', field: 'price' })
  }
  if (product.visibility === 'on_request') {
    issues.push({ code: 'on_request_product' })
  }
  if (product.retailPriceRef > 0 && product.retailPriceRef < product.basePriceHt) {
    issues.push({
      code: 'retail_below_base',
      field: 'price',
      detail: `${product.retailPriceRef} < ${product.basePriceHt}`,
    })
  }
  if (!product.variants.some((variant) => Boolean(variant.imageUrl))) {
    issues.push({ code: 'no_variant_image', field: 'media' })
  }
  return issues
}

/** Une voie de fulfillment est-elle ouverte pour ce produit ? */
export function describeFulfillmentPaths(
  product: StudioProduct,
  context: FulfillmentContext,
  variantId?: string,
): ReadonlyArray<string> {
  const now = context.now ?? new Date()
  const paths: string[] = []
  const stockLines = variantId
    ? stockFor({ productId: product.id, variantId }, context.stock)
    : context.stock.filter(
        (line) => line.productId === product.id && line.availableUnits > 0,
      )
  if (stockLines.length > 0) paths.push('stock')

  for (const option of context.options) {
    if (option.productId !== product.id || !option.isActive) continue
    if (variantId && option.variantId !== null && option.variantId !== variantId) {
      continue
    }
    if (option.availableFrom && new Date(option.availableFrom) > now) continue
    if (option.expiresAt && new Date(option.expiresAt) <= now) continue
    if (option.mode === 'standard_production' && context.productionOpen) {
      paths.push('standard_production')
    }
    if (option.mode === 'grouped_production' && option.confirmedBy !== null) {
      paths.push('grouped_production')
    }
  }
  return [...new Set(paths)]
}

export function computeReadiness(
  product: StudioProduct,
  context: FulfillmentContext = EMPTY_CONTEXT,
  variantId?: string,
): ProductReadiness {
  const discovery = discoveryIssues(product)
  const project = [...discovery, ...projectIssues(product)]
  const quote = [...project, ...quoteIssues(product)]
  const reservation = [...quote]
  if (product.visibility !== 'on_request') {
    const paths = describeFulfillmentPaths(product, context, variantId)
    if (paths.length === 0) {
      reservation.push({
        code: 'no_fulfillment_path',
        detail: context.productionOpen
          ? 'aucune option de production déclarée ni stock disponible'
          : 'ni stock disponible, ni production ouverte, ni regroupement confirmé',
      })
    }
  }
  return {
    discovery: level(discovery),
    project: level(project),
    quote: level(quote),
    reservation: level(reservation),
  }
}

export function isReadyFor(
  readiness: ProductReadiness,
  target: ReadinessLevel,
): boolean {
  return readiness[target].ready
}
