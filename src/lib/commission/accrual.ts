import {
  buildCommissionAccrual,
  type CommissionLedgerPayload,
} from '@/lib/pricing/commission'
import type { ReservationStatus } from '@/lib/supabase/types'

/**
 * Reservation states that never earn commission: not-yet-a-real-order and
 * cancelled. Commissions accrue only on collected revenue (decision #3), so the
 * caller triggers accrual at full payment and this guard blocks the rest.
 */
const NON_ACCRUABLE_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  'draft',
  'pending_reservation_fee',
  'cancelled',
])

export function isAccruableStatus(status: ReservationStatus): boolean {
  return !NON_ACCRUABLE_STATUSES.has(status)
}

/**
 * Resolve a partner_code id from a reservation's first-touch `partner_ref`,
 * case-insensitively. `partner_ref` is captured from `?ref=` un-normalized, so
 * `dbp-13` must still match the code `DBP-13` — otherwise commissions would
 * silently never accrue.
 */
export function matchPartnerCodeId(
  codes: ReadonlyArray<{ readonly id: string; readonly code: string }>,
  partnerRef: string | null | undefined,
): string | null {
  if (!partnerRef) return null
  const ref = partnerRef.trim().toLowerCase()
  if (ref.length === 0) return null
  return codes.find((c) => c.code.trim().toLowerCase() === ref)?.id ?? null
}

export interface ReservationAccrualInput {
  readonly reservationId: string
  readonly status: ReservationStatus
  /** Collected revenue base (HT) — the reservation's total_ht. */
  readonly baseAmountHt: number
  /** The partner code carried by the reservation (LOT 2 first-touch `?ref=`). */
  readonly partnerCodeId: string | null
  /** When the reservation happened (its created_at). */
  readonly reservationAt: Date | string
  /**
   * The client's locked first-touch referral date. When null, THIS reservation
   * is the first touch, so the window opens now (referredAt = reservationAt).
   */
  readonly companyReferredAt: Date | string | null
}

export type ReservationAccrualResult =
  | { readonly accrued: true; readonly payload: CommissionLedgerPayload }
  | { readonly accrued: false; readonly reason: AccrualSkipReason }

export type AccrualSkipReason =
  | 'status_not_paid'
  | 'no_partner_code'
  | 'outside_window'

/**
 * Pure decision: should a reservation accrue a commission, and if so, what
 * ledger row? No DB, fully testable. The server handler persists the payload
 * idempotently (unique reservation_id+phase).
 */
export function resolveReservationAccrual(
  input: ReservationAccrualInput,
): ReservationAccrualResult {
  if (!isAccruableStatus(input.status)) {
    return { accrued: false, reason: 'status_not_paid' }
  }
  if (!input.partnerCodeId) {
    return { accrued: false, reason: 'no_partner_code' }
  }

  const referredAt = input.companyReferredAt ?? input.reservationAt
  const payload = buildCommissionAccrual({
    partnerCodeId: input.partnerCodeId,
    reservationId: input.reservationId,
    baseAmountHt: input.baseAmountHt,
    referredAt,
    reservationAt: input.reservationAt,
  })

  if (payload === null) {
    return { accrued: false, reason: 'outside_window' }
  }
  return { accrued: true, payload }
}
