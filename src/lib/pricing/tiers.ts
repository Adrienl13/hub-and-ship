import type { PricingTier } from '@/types/domain'

export type { PricingTier } from '@/types/domain'

export interface CartLineForPricing {
  readonly productId: string
  readonly variantId: string | null
  readonly variantCombinationId: string | null
  readonly quantity: number
  readonly cbmPerUnit: number
  readonly costLanded: number
  readonly ecoContribution: number
}

export interface PricedLine extends CartLineForPricing {
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

export const DEFAULT_PRICING_TIERS: ReadonlyArray<PricingTier> = [
  { minCbm: 0, maxCbm: 0.8, marginPercent: 35 },
  { minCbm: 0.8, maxCbm: 2, marginPercent: 32 },
  { minCbm: 2, maxCbm: 4, marginPercent: 30 },
  { minCbm: 4, maxCbm: 8, marginPercent: 27 },
  { minCbm: 8, maxCbm: null, marginPercent: 25 },
] as const

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calculateEffectiveMargin(
  cbmStart: number,
  cbmEnd: number,
  tiers: ReadonlyArray<PricingTier>,
): number {
  if (cbmEnd <= cbmStart) {
    return tiers[0]?.marginPercent ?? 35
  }

  let weightedMarginSum = 0
  let cbmAccountedFor = 0

  for (const tier of tiers) {
    const tierStart = tier.minCbm
    const tierEnd = tier.maxCbm ?? Infinity
    const overlapStart = Math.max(cbmStart, tierStart)
    const overlapEnd = Math.min(cbmEnd, tierEnd)
    const overlap = Math.max(0, overlapEnd - overlapStart)

    if (overlap > 0) {
      weightedMarginSum += overlap * tier.marginPercent
      cbmAccountedFor += overlap
    }
  }

  return cbmAccountedFor > 0
    ? weightedMarginSum / cbmAccountedFor
    : (tiers[0]?.marginPercent ?? 35)
}

export function calculateOrderPricing(
  lines: ReadonlyArray<CartLineForPricing>,
  tiers: ReadonlyArray<PricingTier> = DEFAULT_PRICING_TIERS,
): PricingResult {
  const sortedTiers = [...tiers].sort((a, b) => a.minCbm - b.minCbm)
  const fallbackMargin = sortedTiers[0]?.marginPercent ?? 35

  if (lines.length === 0) {
    return {
      lines: [],
      totalCbm: 0,
      effectiveMarginPercent: fallbackMargin,
      subtotalHt: 0,
      ecoContributionTotal: 0,
      totalHt: 0,
    }
  }

  let cbmCumulative = 0
  const pricedLines: Array<PricedLine> = []

  for (const line of lines) {
    const cbmTotal = line.cbmPerUnit * line.quantity
    const cbmStart = cbmCumulative
    const cbmEnd = cbmStart + cbmTotal
    const effectiveMargin = calculateEffectiveMargin(
      cbmStart,
      cbmEnd,
      sortedTiers,
    )
    const unitPriceHt = round2(
      line.costLanded * (1 + effectiveMargin / 100) + line.ecoContribution,
    )
    const subtotalHt = round2(unitPriceHt * line.quantity)
    const ecoContributionTotal = round2(line.ecoContribution * line.quantity)

    pricedLines.push({
      ...line,
      effectiveMargin: round2(effectiveMargin),
      unitPriceHt,
      subtotalHt,
      ecoContributionTotal,
      cbmTotal: round2(cbmTotal),
    })

    cbmCumulative = cbmEnd
  }

  const subtotalHt = round2(
    pricedLines.reduce((sum, line) => sum + line.subtotalHt, 0),
  )
  const ecoContributionTotal = round2(
    pricedLines.reduce((sum, line) => sum + line.ecoContributionTotal, 0),
  )
  const totalCbm = round2(
    pricedLines.reduce((sum, line) => sum + line.cbmTotal, 0),
  )
  const weightedMarginSum = pricedLines.reduce(
    (sum, line) => sum + line.effectiveMargin * line.cbmTotal,
    0,
  )

  return {
    lines: pricedLines,
    totalCbm,
    effectiveMarginPercent:
      totalCbm > 0 ? round2(weightedMarginSum / totalCbm) : fallbackMargin,
    subtotalHt,
    ecoContributionTotal,
    totalHt: subtotalHt,
  }
}
