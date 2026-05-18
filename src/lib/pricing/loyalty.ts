export interface LoyaltyTier {
  readonly minContainers: number
  readonly discountPercent: number
}

export interface LoyaltyDiscountResult {
  readonly discountPercent: number
  readonly discountAmount: number
  readonly totalAfter: number
  readonly activeTier: LoyaltyTier | null
  readonly nextTier: LoyaltyTier | null
  readonly nextGapContainers: number
}

export const DEFAULT_LOYALTY_TIERS: ReadonlyArray<LoyaltyTier> = [
  { minContainers: 2, discountPercent: 2 },
  { minContainers: 3, discountPercent: 3 },
  { minContainers: 5, discountPercent: 4 },
  { minContainers: 10, discountPercent: 5 },
] as const

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeContainersCompleted(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function sortLoyaltyTiers(
  tiers: ReadonlyArray<LoyaltyTier>,
): ReadonlyArray<LoyaltyTier> {
  return [...tiers]
    .filter(
      (tier) =>
        Number.isFinite(tier.minContainers) &&
        Number.isFinite(tier.discountPercent) &&
        tier.minContainers >= 0 &&
        tier.discountPercent >= 0,
    )
    .sort((a, b) => a.minContainers - b.minContainers)
}

export function getLoyaltyDiscount(
  companyContainersCompleted: number,
  tiers: ReadonlyArray<LoyaltyTier> = DEFAULT_LOYALTY_TIERS,
): number {
  const containersCompleted = normalizeContainersCompleted(
    companyContainersCompleted,
  )
  const sortedTiers = sortLoyaltyTiers(tiers)

  const activeTier =
    [...sortedTiers]
      .reverse()
      .find((tier) => containersCompleted >= tier.minContainers) ?? null

  return activeTier?.discountPercent ?? 0
}

export function applyLoyaltyDiscount(
  totalHt: number,
  containersCompleted: number,
  tiers: ReadonlyArray<LoyaltyTier> = DEFAULT_LOYALTY_TIERS,
): LoyaltyDiscountResult {
  const safeTotalHt = Math.max(0, round2(totalHt))
  const safeContainersCompleted =
    normalizeContainersCompleted(containersCompleted)
  const sortedTiers = sortLoyaltyTiers(tiers)
  const activeTier =
    [...sortedTiers]
      .reverse()
      .find((tier) => safeContainersCompleted >= tier.minContainers) ?? null
  const nextTier =
    sortedTiers.find((tier) => safeContainersCompleted < tier.minContainers) ??
    null
  const discountPercent = activeTier?.discountPercent ?? 0
  const discountAmount = round2(safeTotalHt * (discountPercent / 100))

  return {
    discountPercent,
    discountAmount,
    totalAfter: round2(safeTotalHt - discountAmount),
    activeTier,
    nextTier,
    nextGapContainers: nextTier
      ? nextTier.minContainers - safeContainersCompleted
      : 0,
  }
}
