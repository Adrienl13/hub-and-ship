export interface CustomerDiscountTier {
  readonly minUnits: number;
  readonly discountPercent: number;
}

export interface CustomerDiscountStatus {
  readonly activeTier: CustomerDiscountTier | null;
  readonly nextTier: CustomerDiscountTier | null;
  readonly nextGapUnits: number;
  readonly discountPercent: number;
}

export const CUSTOMER_QUANTITY_DISCOUNT_TIERS: ReadonlyArray<CustomerDiscountTier> = [
  { minUnits: 50, discountPercent: 2 },
  { minUnits: 150, discountPercent: 6 },
  { minUnits: 300, discountPercent: 10 },
] as const;

export function getCustomerDiscountStatus(
  totalUnits: number,
  tiers: ReadonlyArray<CustomerDiscountTier> = CUSTOMER_QUANTITY_DISCOUNT_TIERS,
): CustomerDiscountStatus {
  const safeTotalUnits = Math.max(0, Math.trunc(totalUnits));
  const sortedTiers = [...tiers].sort((a, b) => a.minUnits - b.minUnits);
  const activeTier =
    [...sortedTiers].reverse().find((tier) => safeTotalUnits >= tier.minUnits) ?? null;
  const nextTier = sortedTiers.find((tier) => tier.minUnits > safeTotalUnits) ?? null;

  return {
    activeTier,
    nextTier,
    nextGapUnits: nextTier ? nextTier.minUnits - safeTotalUnits : 0,
    discountPercent: activeTier?.discountPercent ?? 0,
  };
}
