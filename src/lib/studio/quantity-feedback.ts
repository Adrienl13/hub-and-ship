// Retour utilisateur sur une quantité libre (lot 2) : traduit la résolution
// de fulfillment du lot 1 en message clair, SANS jamais bloquer ni arrondir.
// Aucune disponibilité n'est affirmée sans stock réel ou voie confirmée.

import { getQuantityRule } from '@/lib/quantity'
import type { Product } from '@/lib/products'
import { resolveFulfillment, type FulfillmentResolution } from './fulfillment'
import type { FulfillmentContext, StudioProjectItem } from './types'

export type QuantityFeedbackTone = 'confirmed' | 'review' | 'quote'

export interface QuantityFeedback {
  readonly tone: QuantityFeedbackTone
  readonly title: string
  readonly detail: string | null
  /** Règle de série affichée à titre informatif (jamais appliquée). */
  readonly ruleLabel: string
  readonly resolution: FulfillmentResolution
}

export function describeQuantity(
  item: StudioProjectItem,
  product: Product,
  context: FulfillmentContext,
): QuantityFeedback {
  const variant = product.variants.find((entry) => entry.id === item.variantId)
  const ruleLabel = getQuantityRule(product, variant).label
  const resolution = resolveFulfillment(item, product, context)
  const quantity = Math.max(1, Math.trunc(item.requestedQuantity))

  if (resolution.mode === 'stock') {
    return {
      tone: 'confirmed',
      title: 'Disponible en stock',
      detail: `${resolution.stockAvailable} unité${resolution.stockAvailable > 1 ? 's' : ''} disponible${resolution.stockAvailable > 1 ? 's' : ''} pour ce design.`,
      ruleLabel,
      resolution,
    }
  }
  if (resolution.mode === 'standard_production' && resolution.confirmed) {
    return {
      tone: 'confirmed',
      title: 'Production standard confirmée',
      detail: `Série de ${quantity} unités sur une voie de production confirmée.`,
      ruleLabel,
      resolution,
    }
  }
  if (resolution.mode === 'grouped_production') {
    return {
      tone: 'confirmed',
      title: 'Regroupement de production confirmé',
      detail: `Votre quantité de ${quantity} est couverte par un regroupement confirmé.`,
      ruleLabel,
      resolution,
    }
  }
  if (resolution.mode === 'standard_production') {
    return {
      tone: 'quote',
      title: 'Série standard connue, production à confirmer',
      detail: 'Un devis est possible ; la date de production sera confirmée avec vous.',
      ruleLabel,
      resolution,
    }
  }

  const reasons = new Set(resolution.reasons)
  if (reasons.has('custom_colour_requested') || reasons.has('custom_tabletop_requested')) {
    return {
      tone: 'quote',
      title: 'Personnalisation : confirmation usine',
      detail: 'Coloris ou dimensions hors catalogue : nous confirmons la faisabilité avec l’usine.',
      ruleLabel,
      resolution,
    }
  }
  if (reasons.has('on_request_product')) {
    return {
      tone: 'quote',
      title: 'Produit sur demande : devis manuel',
      detail: 'Cette référence est chiffrée sur projet.',
      ruleLabel,
      resolution,
    }
  }
  if (reasons.has('below_moq') || reasons.has('colour_minimum')) {
    const stockNote =
      resolution.stockAvailable > 0
        ? ` ${resolution.stockAvailable} unité${resolution.stockAvailable > 1 ? 's' : ''} en stock, insuffisant pour ${quantity}.`
        : ''
    return {
      tone: 'review',
      title: `Quantité sous le minimum de série (${resolution.minimumRequired}) : nous étudions la faisabilité`,
      detail: `Vous pouvez continuer avec ${quantity}.${stockNote}`,
      ruleLabel,
      resolution,
    }
  }
  if (reasons.has('stock_insufficient')) {
    return {
      tone: 'review',
      title: 'Stock insuffisant pour cette quantité : nous étudions la faisabilité',
      detail: `${resolution.stockAvailable} en stock pour ${quantity} demandées. Vous pouvez continuer.`,
      ruleLabel,
      resolution,
    }
  }
  return {
    tone: 'review',
    title: 'Aucune voie automatique : nous étudions la faisabilité',
    detail: 'Vous pouvez continuer ; nous revenons vers vous avec une proposition.',
    ruleLabel,
    resolution,
  }
}
