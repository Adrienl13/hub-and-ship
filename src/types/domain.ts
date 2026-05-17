export interface PricingTier {
  readonly minCbm: number
  readonly maxCbm: number | null
  readonly marginPercent: number
}
