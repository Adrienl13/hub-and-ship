/**
 * Apporteur (referrer) commission logic (LOT 5).
 *
 * Replaces the old fixed 200€/100€ B2C referral credit. The real program:
 * 8% commission on the collected revenue (CA encaissé) of every referred
 * client, for 12 months from the moment the client was first referred
 * (`companies.referred_at`, locked first-touch at the 1st reservation).
 *
 * Ledger entries are written ONLY when a payment is fully collected
 * (decision #3 — never on "won"/"reserved"). This module is the pure,
 * side-effect-free core; the accrual is persisted server-side by the Stripe
 * webhook / admin "paiement reçu" action, idempotently.
 */

import type { CommissionPhase, CommissionStatus } from '@/lib/supabase/types'

export type { CommissionPhase, CommissionStatus }

export const COMMISSION_RATE_PERCENT = 8
export const COMMISSION_WINDOW_MONTHS = 12

export interface CommissionEntryInput {
  readonly partnerCodeId: string
  readonly reservationId: string
  readonly baseAmountHt: number
  readonly referredAt: Date | string
  readonly reservationAt: Date | string
  readonly rate?: number
}

/** DB-ready payload for `commission_ledger` (snake_case). */
export interface CommissionLedgerPayload {
  readonly partner_code_id: string
  readonly reservation_id: string
  readonly base_amount_ht: number
  readonly rate: number
  readonly amount: number
  readonly status: CommissionStatus
  readonly phase: CommissionPhase
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** `referredAt` shifted forward by the commission window (12 months). */
export function commissionWindowExpiry(referredAt: Date | string): Date {
  const base = toDate(referredAt)
  const expiry = new Date(base.getTime())
  expiry.setMonth(expiry.getMonth() + COMMISSION_WINDOW_MONTHS)
  return expiry
}

/**
 * A reservation earns commission when it happens strictly within 12 months of
 * the client's first-touch referral. At/after the expiry instant → no
 * commission ("moins de 12 mois").
 */
export function isWithinCommissionWindow(
  referredAt: Date | string,
  reservationAt: Date | string,
): boolean {
  const reservation = toDate(reservationAt).getTime()
  const referred = toDate(referredAt).getTime()
  if (reservation < referred) return false
  return reservation < commissionWindowExpiry(referredAt).getTime()
}

/** amount = base × rate / 100, rounded to cents. */
export function computeCommissionAmount(
  baseAmountHt: number,
  rate: number = COMMISSION_RATE_PERCENT,
): number {
  return round2((baseAmountHt * rate) / 100)
}

/**
 * Build an accrual ledger payload for a fully-collected reservation, or `null`
 * if the reservation falls outside the 12-month window (no commission due).
 */
export function buildCommissionAccrual(
  input: CommissionEntryInput,
): CommissionLedgerPayload | null {
  if (!isWithinCommissionWindow(input.referredAt, input.reservationAt)) {
    return null
  }
  const rate = input.rate ?? COMMISSION_RATE_PERCENT
  return {
    partner_code_id: input.partnerCodeId,
    reservation_id: input.reservationId,
    base_amount_ht: round2(input.baseAmountHt),
    rate,
    amount: computeCommissionAmount(input.baseAmountHt, rate),
    status: 'accrued',
    phase: 'accrual',
  }
}

/**
 * Build a reversal payload (cancellation/refund): a NEGATIVE-amount row, never
 * a deletion — accounting traceability (decision in LOT 5). `refundedBaseHt`
 * defaults to the full accrued base.
 */
export function buildCommissionReversal(input: {
  readonly partnerCodeId: string
  readonly reservationId: string
  readonly refundedBaseHt: number
  readonly rate?: number
}): CommissionLedgerPayload {
  const rate = input.rate ?? COMMISSION_RATE_PERCENT
  return {
    partner_code_id: input.partnerCodeId,
    reservation_id: input.reservationId,
    base_amount_ht: round2(-Math.abs(input.refundedBaseHt)),
    rate,
    amount: computeCommissionAmount(-Math.abs(input.refundedBaseHt), rate),
    status: 'accrued',
    phase: 'reversal',
  }
}
