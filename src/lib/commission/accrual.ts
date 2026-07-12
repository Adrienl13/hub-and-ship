import {
  buildCommissionAccrual,
  type CommissionLedgerPayload,
} from '@/lib/pricing/commission'
import type { ReservationStatus } from '@/lib/supabase/types'

/**
 * La commission est calculée sur le CA RÉELLEMENT ENCAISSÉ (décision #3). La
 * base d'accrual est le total_ht complet : elle n'est donc légitime QUE lorsque
 * le solde a été payé, c.-à-d. avant expédition. Seuls `in_transit` et
 * `delivered` garantissent 100 % encaissé.
 *
 * Les statuts intermédiaires n'encaissent qu'une fraction :
 *  - `reserved`        = frais de réservation payés (≈ 3 %, plancher 150 €)
 *  - `deposit_called` / `deposit_paid` = acompte 30 %
 *  - `in_production`   = solde pas encore appelé
 * Les accruer commissionnerait 100 % du CA pour 3-30 % encaissé → interdit.
 */
const NON_ACCRUABLE_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  'draft',
  'pending_reservation_fee',
  'reserved',
  'deposit_called',
  'deposit_paid',
  'in_production',
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
