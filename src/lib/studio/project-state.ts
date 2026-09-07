// État commercial d'un projet Studio (lot 1) : dérivé des lignes, avec des
// raisons structurées par ligne. Aucun état n'interdit la découverte, la
// sélection, la construction, la sauvegarde ni l'envoi d'une demande.
//
//   reservation_ready      : toutes les lignes sont quote-ready ET servies
//                            par une voie CONFIRMÉE (stock réel couvrant la
//                            quantité, production standard confirmée par un
//                            admin, regroupement confirmé par un admin) ;
//   auto_quote_ready       : devis ferme possible, mais aucune voie confirmée
//                            (ex. série standard connue, production non
//                            confirmée : production_unconfirmed) ;
//   feasibility_review     : une quantité ou un stock demande une étude
//                            (below_moq, stock_insufficient, no_fulfillment_path) ;
//   manual_quote_required  : une donnée ou une personnalisation exige un
//                            devis manuel (prix non confirmé/indicatif,
//                            sur demande, coloris/dimensions spéciaux,
//                            compatibilité à confirmer).
// Priorité : manual_quote_required > feasibility_review > auto_quote_ready
// > reservation_ready.

import type { FulfillmentResolution } from './fulfillment'
import type { ProductReadiness } from './readiness'
import type { CommercialReason, ProjectState, StudioProjectItem } from './types'

export interface ProjectLineEvaluation {
  readonly item: StudioProjectItem
  readonly readiness: ProductReadiness
  readonly fulfillment: FulfillmentResolution
}

export interface ProjectLineReasons {
  readonly productId: string
  readonly variantId: string
  readonly reasons: ReadonlyArray<CommercialReason>
}

export interface ProjectStateResult {
  readonly state: ProjectState
  readonly lines: ReadonlyArray<ProjectLineReasons>
  /** Raisons agrégées, dédoublonnées, dans l'ordre de priorité. */
  readonly reasons: ReadonlyArray<CommercialReason>
}

const MANUAL_QUOTE_REASONS: ReadonlySet<CommercialReason> = new Set([
  'on_request_product',
  'price_unconfirmed',
  'price_indicative',
  'dimensions_unconfirmed',
  'compatibility_unconfirmed',
  'custom_colour_requested',
  'custom_tabletop_requested',
])

const FEASIBILITY_REASONS: ReadonlySet<CommercialReason> = new Set([
  'below_moq',
  'colour_minimum',
  'stock_insufficient',
  'no_fulfillment_path',
])

function readinessReasons(readiness: ProductReadiness): CommercialReason[] {
  const reasons: CommercialReason[] = []
  for (const issue of readiness.quote.issues) {
    if (issue.code === 'price_unconfirmed') reasons.push('price_unconfirmed')
    if (issue.code === 'price_indicative') reasons.push('price_indicative')
    if (issue.code === 'on_request_product') reasons.push('on_request_product')
    if (issue.code === 'missing_dimensions') reasons.push('dimensions_unconfirmed')
    if (issue.code === 'missing_price') reasons.push('price_unconfirmed')
    if (
      issue.code === 'inactive' ||
      issue.code === 'catalog_only' ||
      issue.code === 'missing_main_image'
    ) {
      reasons.push('product_not_discoverable')
    }
  }
  return reasons
}

export function lineReasons(line: ProjectLineEvaluation): ReadonlyArray<CommercialReason> {
  const merged = [...readinessReasons(line.readiness), ...line.fulfillment.reasons]
  return [...new Set(merged)]
}

export function computeProjectState(
  lines: ReadonlyArray<ProjectLineEvaluation>,
): ProjectStateResult {
  if (lines.length === 0) {
    return { state: 'feasibility_review', lines: [], reasons: ['empty_project'] }
  }

  const perLine: ProjectLineReasons[] = lines.map((line) => ({
    productId: line.item.productId,
    variantId: line.item.variantId,
    reasons: lineReasons(line),
  }))
  const all = [...new Set(perLine.flatMap((line) => line.reasons))]

  if (all.some((reason) => MANUAL_QUOTE_REASONS.has(reason))) {
    return { state: 'manual_quote_required', lines: perLine, reasons: all }
  }
  if (
    all.some((reason) => FEASIBILITY_REASONS.has(reason)) ||
    lines.some((line) => line.fulfillment.mode === 'manual_review')
  ) {
    return { state: 'feasibility_review', lines: perLine, reasons: all }
  }

  // Règle absolue : reservation_ready = quote-ready + voie CONFIRMÉE pour
  // chaque ligne. `confirmed` n'est vrai que pour du stock réel couvrant la
  // quantité ou une option explicitement confirmée par un admin.
  const everyLineReservable = lines.every(
    (line) =>
      line.readiness.reservation.ready &&
      line.fulfillment.mode !== 'manual_review' &&
      line.fulfillment.confirmed,
  )
  if (everyLineReservable) {
    return { state: 'reservation_ready', lines: perLine, reasons: all }
  }

  const everyLineQuotable = lines.every((line) => line.readiness.quote.ready)
  if (everyLineQuotable) {
    return { state: 'auto_quote_ready', lines: perLine, reasons: all }
  }

  // Un produit non quote-ready sans raison classée ci-dessus (ex. photo de
  // design manquante) : étude manuelle plutôt qu'un devis automatique faux.
  return { state: 'manual_quote_required', lines: perLine, reasons: all }
}
