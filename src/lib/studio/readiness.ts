// Readiness Studio d'un produit (lot 1) : quatre niveaux emboîtés, chacun
// expliqué par des raisons structurées. Aucun booléen opaque.
//
//   discovery  : peut être montré dans le Studio ;
//   project    : peut entrer dans un projet (dimensions et prix présents) ;
//   quote      : peut figurer sur un devis ferme (prix confirmé, non
//                indicatif, produit public, un design photographié) ;
//   reservation: quote + au moins une voie de fulfillment CONFIRMÉE pour ce
//                produit (stock réel disponible, production standard
//                confirmée par un admin, ou regroupement confirmé par un
//                admin). Voir fulfillment.ts : confirmedFulfillmentPaths.
//
// Studio Ready ≠ Quote Ready ≠ Reservation Ready. Aucun signal global (MOQ,
// option semée, container ouvert) ne confirme la production d'un produit.
//
// Prix : le prix public actif de la base est une vérité commerciale tant
// qu'il n'est pas marqué « sur demande » (visibility) ou « indicatif »
// (data_quality.price = estimated). Il n'est `pending` que s'il est absent.

import { qualityOf } from './data-quality'
import {
  confirmedFulfillmentPaths,
  type ConfirmedFulfillmentPath,
} from './fulfillment'
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

const EMPTY_CONTEXT: FulfillmentContext = { stock: [], options: [] }

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

/** Voies CONFIRMÉES pour ce produit (ou ce coloris). Une option non
 *  confirmée, un MOQ ou un container ouvert n'y figurent jamais. */
export function describeFulfillmentPaths(
  product: StudioProduct,
  context: FulfillmentContext,
  variantId?: string,
): ReadonlyArray<ConfirmedFulfillmentPath> {
  return confirmedFulfillmentPaths(product.id, context, variantId)
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
        detail:
          'ni stock disponible, ni production standard confirmée, ni regroupement confirmé',
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
