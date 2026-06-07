// Client dashboard helpers — derive "what should I do now?" from a user's
// reservations. Pure and unit-tested so the /account overview stays predictable.

import type {
  AccountReservation,
  AccountReservationStatus,
} from '@/lib/account/reservations'

/** Statuses where the client still owes a payment action. */
export const PAYMENT_DUE_STATUSES: ReadonlyArray<AccountReservationStatus> = [
  'pending_reservation_fee',
  'deposit_called',
]

/** Lower number = more urgent for the client. cancelled/delivered are terminal. */
const ACTION_PRIORITY: Record<AccountReservationStatus, number> = {
  pending_reservation_fee: 0,
  deposit_called: 1,
  reserved: 2,
  in_production: 3,
  in_transit: 4,
  delivered: 8,
  cancelled: 9,
}

export function reservationsAwaitingPayment(
  reservations: ReadonlyArray<AccountReservation>,
): ReadonlyArray<AccountReservation> {
  return reservations.filter((r) => PAYMENT_DUE_STATUSES.includes(r.status))
}

/**
 * The single reservation that most deserves the client's attention: payment
 * due first, then in-progress, most recently updated breaking ties. Terminal
 * statuses (delivered/cancelled) are excluded. Returns null when nothing is
 * actionable.
 */
export function primaryActionReservation(
  reservations: ReadonlyArray<AccountReservation>,
): AccountReservation | null {
  const actionable = reservations.filter(
    (r) => r.status !== 'cancelled' && r.status !== 'delivered',
  )
  if (actionable.length === 0) return null

  return [...actionable].sort((a, b) => {
    const byPriority = ACTION_PRIORITY[a.status] - ACTION_PRIORITY[b.status]
    if (byPriority !== 0) return byPriority
    return b.updatedAt.localeCompare(a.updatedAt)
  })[0]!
}

export function isPaymentDue(reservation: AccountReservation): boolean {
  return PAYMENT_DUE_STATUSES.includes(reservation.status)
}
