import {
  calculateOrderPricing,
  type CartLineForPricing,
  type PricedLine,
  type PricingResult,
  type PricingTier,
} from './tiers'

export type ActiveReservationStatus =
  | 'reserved'
  | 'pending_deposit'
  | 'deposit_paid'
  | 'pending_balance'
  | 'paid_full'

export type ReservationStatus =
  | 'cart'
  | ActiveReservationStatus
  | 'cancelled'
  | 'expired'
  | 'refunded'

export interface ReservationForAggregation {
  readonly id: string
  readonly companyId: string
  readonly containerId: string
  readonly status: ReservationStatus
  readonly totalCbm: number
}

export interface AggregatedPricingResult extends PricingResult {
  readonly existingCbm: number
  readonly cumulativeCbm: number
}

export const ACTIVE_RESERVATION_STATUSES: ReadonlyArray<ActiveReservationStatus> =
  [
    'reserved',
    'pending_deposit',
    'deposit_paid',
    'pending_balance',
    'paid_full',
  ] as const

const GHOST_EXISTING_LINE_ID = '__existing__'

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function safeCbm(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function summarizePricedLines(
  lines: ReadonlyArray<PricedLine>,
  fallbackMargin: number,
): Pick<
  PricingResult,
  | 'subtotalHt'
  | 'ecoContributionTotal'
  | 'totalHt'
  | 'totalCbm'
  | 'effectiveMarginPercent'
> {
  const subtotalHt = round2(
    lines.reduce((sum, line) => sum + line.subtotalHt, 0),
  )
  const ecoContributionTotal = round2(
    lines.reduce((sum, line) => sum + line.ecoContributionTotal, 0),
  )
  const totalCbm = round2(lines.reduce((sum, line) => sum + line.cbmTotal, 0))
  const weightedMarginSum = lines.reduce(
    (sum, line) => sum + line.effectiveMargin * line.cbmTotal,
    0,
  )

  return {
    subtotalHt,
    ecoContributionTotal,
    totalHt: subtotalHt,
    totalCbm,
    effectiveMarginPercent:
      totalCbm > 0 ? round2(weightedMarginSum / totalCbm) : fallbackMargin,
  }
}

export function isActiveReservationStatus(
  status: ReservationStatus,
): status is ActiveReservationStatus {
  return ACTIVE_RESERVATION_STATUSES.includes(status as ActiveReservationStatus)
}

export function getCumulativeCbmForCompany(
  reservations: ReadonlyArray<ReservationForAggregation>,
  companyId: string,
  containerId: string,
  excludeReservationId?: string,
): number {
  return round2(
    reservations.reduce((sum, reservation) => {
      const sameScope =
        reservation.companyId === companyId &&
        reservation.containerId === containerId &&
        reservation.id !== excludeReservationId

      if (!sameScope || !isActiveReservationStatus(reservation.status)) {
        return sum
      }

      return sum + safeCbm(reservation.totalCbm)
    }, 0),
  )
}

export function calculatePricingWithExistingCbm(
  newLines: ReadonlyArray<CartLineForPricing>,
  existingCbm: number,
  tiers?: ReadonlyArray<PricingTier>,
): AggregatedPricingResult {
  const safeExistingCbm = round2(safeCbm(existingCbm))
  const ghostLine: CartLineForPricing = {
    productId: GHOST_EXISTING_LINE_ID,
    variantId: null,
    variantCombinationId: null,
    quantity: 1,
    cbmPerUnit: safeExistingCbm,
    costLanded: 0,
    ecoContribution: 0,
  }

  const rawResult =
    safeExistingCbm > 0
      ? calculateOrderPricing([ghostLine, ...newLines], tiers)
      : calculateOrderPricing(newLines, tiers)
  const lines = rawResult.lines.filter(
    (line) => line.productId !== GHOST_EXISTING_LINE_ID,
  )
  const summary = summarizePricedLines(lines, rawResult.effectiveMarginPercent)

  return {
    ...rawResult,
    ...summary,
    lines,
    existingCbm: safeExistingCbm,
    cumulativeCbm: round2(safeExistingCbm + summary.totalCbm),
  }
}

export function calculatePricingWithExistingReservations({
  newLines,
  reservations,
  companyId,
  containerId,
  excludeReservationId,
  tiers,
}: {
  readonly newLines: ReadonlyArray<CartLineForPricing>
  readonly reservations: ReadonlyArray<ReservationForAggregation>
  readonly companyId: string
  readonly containerId: string
  readonly excludeReservationId?: string
  readonly tiers?: ReadonlyArray<PricingTier>
}): AggregatedPricingResult {
  const existingCbm = getCumulativeCbmForCompany(
    reservations,
    companyId,
    containerId,
    excludeReservationId,
  )

  return calculatePricingWithExistingCbm(newLines, existingCbm, tiers)
}
