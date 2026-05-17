/**
 * EXAMPLE DE RÉFÉRENCE — Style de code attendu pour la logique métier
 * 
 * Ce fichier sert d'exemple à Claude Code pour comprendre :
 * - Le style TypeScript strict
 * - La séparation des types et fonctions pures
 * - L'utilisation de fonctions auxiliaires
 * - Les JSDoc explicatives
 * - La précision décimale
 * 
 * À adapter pour l'implémentation finale dans src/lib/pricing/tiers.ts
 */

// ============================================
// TYPES
// ============================================

export interface PricingTier {
  readonly minCbm: number
  readonly maxCbm: number | null  // null = pas de limite supérieure
  readonly marginPercent: number
}

export interface CartLineInput {
  readonly productId: string
  readonly variantId: string | null
  readonly quantity: number
  readonly cbmPerUnit: number
  readonly costLanded: number
  readonly ecoContribution: number
}

export interface PricedLine extends CartLineInput {
  readonly effectiveMargin: number
  readonly unitPriceHt: number
  readonly subtotalHt: number
  readonly ecoContributionTotal: number
  readonly cbmTotal: number
}

export interface PricingResult {
  readonly lines: ReadonlyArray<PricedLine>
  readonly totalCbm: number
  readonly effectiveMarginPercent: number
  readonly subtotalHt: number
  readonly ecoContributionTotal: number
  readonly totalHt: number
}

// ============================================
// CONSTANTES & DEFAULTS
// ============================================

/**
 * Tiers de marge par défaut (Container Club V1.1+)
 * Méthode INCRÉMENTALE : chaque tranche facturée au tier correspondant.
 */
export const DEFAULT_PRICING_TIERS: ReadonlyArray<PricingTier> = [
  { minCbm: 0, maxCbm: 0.80, marginPercent: 35 },
  { minCbm: 0.80, maxCbm: 2.00, marginPercent: 32 },
  { minCbm: 2.00, maxCbm: 4.00, marginPercent: 30 },
  { minCbm: 4.00, maxCbm: 8.00, marginPercent: 27 },
  { minCbm: 8.00, maxCbm: null, marginPercent: 25 },
] as const

// ============================================
// UTILITAIRES PURS
// ============================================

/**
 * Arrondit à 2 décimales (centimes d'euro).
 * Évite les erreurs de précision en virgule flottante.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Calcule la marge effective pondérée pour une ligne donnée,
 * en fonction de la position cumulative dans les tiers.
 */
function calculateLineEffectiveMargin(
  lineCbmStart: number,
  lineCbmEnd: number,
  tiers: ReadonlyArray<PricingTier>,
): number {
  if (lineCbmEnd <= lineCbmStart) {
    return tiers[0]?.marginPercent ?? 0
  }

  let weightedMarginSum = 0
  let cbmAccountedFor = 0

  for (const tier of tiers) {
    const tierStart = tier.minCbm
    const tierEnd = tier.maxCbm ?? Infinity

    const overlapStart = Math.max(lineCbmStart, tierStart)
    const overlapEnd = Math.min(lineCbmEnd, tierEnd)
    const overlap = Math.max(0, overlapEnd - overlapStart)

    if (overlap > 0) {
      weightedMarginSum += overlap * tier.marginPercent
      cbmAccountedFor += overlap
    }
  }

  return cbmAccountedFor > 0
    ? weightedMarginSum / cbmAccountedFor
    : tiers[0]?.marginPercent ?? 0
}

// ============================================
// FONCTION PRINCIPALE
// ============================================

/**
 * Calcule le pricing complet d'une commande avec tiers dégressifs incrémentaux.
 * 
 * Méthode INCRÉMENTALE : chaque tranche de CBM est facturée au tier correspondant.
 * Évite le profit leakage et le fractionnement de commandes.
 * 
 * @param lines - Lignes du panier (triées par ordre d'ajout)
 * @param tiers - Configuration des tiers de marge
 * @returns Résultat complet du pricing
 * 
 * @example
 * const result = calculateOrderPricing([
 *   { productId: 'p1', variantId: 'v1', quantity: 10, cbmPerUnit: 0.08, costLanded: 45, ecoContribution: 0.30 },
 *   { productId: 'p2', variantId: 'v2', quantity: 5, cbmPerUnit: 0.25, costLanded: 95, ecoContribution: 0.80 },
 * ], DEFAULT_PRICING_TIERS)
 */
export function calculateOrderPricing(
  lines: ReadonlyArray<CartLineInput>,
  tiers: ReadonlyArray<PricingTier> = DEFAULT_PRICING_TIERS,
): PricingResult {
  // Cas limite : panier vide
  if (lines.length === 0) {
    return {
      lines: [],
      totalCbm: 0,
      effectiveMarginPercent: tiers[0]?.marginPercent ?? 0,
      subtotalHt: 0,
      ecoContributionTotal: 0,
      totalHt: 0,
    }
  }

  // Tri stable des tiers par CBM minimum
  const sortedTiers = [...tiers].sort((a, b) => a.minCbm - b.minCbm)

  // Accumulateur de CBM cumulatif au fur et à mesure des lignes
  let cbmCumulative = 0
  const pricedLines: PricedLine[] = []

  for (const line of lines) {
    const lineCbmTotal = line.cbmPerUnit * line.quantity
    const cbmStart = cbmCumulative
    const cbmEnd = cbmCumulative + lineCbmTotal

    // Calcul marge effective pour cette ligne (peut chevaucher plusieurs tiers)
    const effectiveMargin = calculateLineEffectiveMargin(cbmStart, cbmEnd, sortedTiers)

    // Calcul du prix de vente unitaire
    const unitPriceHt = round2(
      line.costLanded * (1 + effectiveMargin / 100) + line.ecoContribution,
    )

    const subtotalHt = round2(unitPriceHt * line.quantity)
    const ecoContributionTotal = round2(line.ecoContribution * line.quantity)

    pricedLines.push({
      ...line,
      effectiveMargin,
      unitPriceHt,
      subtotalHt,
      ecoContributionTotal,
      cbmTotal: lineCbmTotal,
    })

    cbmCumulative = cbmEnd
  }

  // Agrégation finale
  const subtotalHt = pricedLines.reduce((sum, l) => sum + l.subtotalHt, 0)
  const ecoContributionTotal = pricedLines.reduce((sum, l) => sum + l.ecoContributionTotal, 0)
  const totalCbm = pricedLines.reduce((sum, l) => sum + l.cbmTotal, 0)

  // Marge effective globale (pondérée par CBM)
  const totalWeightedMargin = pricedLines.reduce(
    (sum, l) => sum + l.effectiveMargin * l.cbmTotal,
    0,
  )
  const effectiveMarginPercent = totalCbm > 0
    ? totalWeightedMargin / totalCbm
    : sortedTiers[0]?.marginPercent ?? 0

  return {
    lines: pricedLines,
    totalCbm: round2(totalCbm),
    effectiveMarginPercent: round2(effectiveMarginPercent),
    subtotalHt: round2(subtotalHt),
    ecoContributionTotal: round2(ecoContributionTotal),
    totalHt: round2(subtotalHt),
  }
}
