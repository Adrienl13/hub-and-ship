import { describe, expect, it } from 'vitest'

import {
  isPaymentDue,
  primaryActionReservation,
  reservationsAwaitingPayment,
} from './dashboard'
import type {
  AccountReservation,
  AccountReservationStatus,
} from '@/lib/account/reservations'

function res(
  id: string,
  status: AccountReservationStatus,
  updatedAt: string,
): AccountReservation {
  return {
    id,
    status,
    updatedAt,
    paidAmount: 0,
    nextActionLabel: '',
    draft: { id, reference: id } as unknown as AccountReservation['draft'],
  }
}

describe('reservationsAwaitingPayment', () => {
  it('keeps only payment-due statuses', () => {
    const list = [
      res('a', 'pending_reservation_fee', '2026-06-01'),
      res('b', 'deposit_called', '2026-06-02'),
      res('c', 'in_production', '2026-06-03'),
      res('d', 'delivered', '2026-06-04'),
    ]
    expect(reservationsAwaitingPayment(list).map((r) => r.id)).toEqual([
      'a',
      'b',
    ])
  })
})

describe('primaryActionReservation', () => {
  it('prioritizes a pending reservation fee over in-progress ones', () => {
    const list = [
      res('progress', 'in_production', '2026-06-10'),
      res('pay', 'pending_reservation_fee', '2026-06-01'),
    ]
    expect(primaryActionReservation(list)?.id).toBe('pay')
  })

  it('breaks ties on the most recently updated', () => {
    const list = [
      res('old', 'in_transit', '2026-06-01'),
      res('new', 'in_transit', '2026-06-09'),
    ]
    expect(primaryActionReservation(list)?.id).toBe('new')
  })

  it('returns null when everything is terminal', () => {
    const list = [
      res('x', 'delivered', '2026-06-01'),
      res('y', 'cancelled', '2026-06-02'),
    ]
    expect(primaryActionReservation(list)).toBeNull()
  })
})

describe('isPaymentDue', () => {
  it('is true for deposit_called', () => {
    expect(isPaymentDue(res('a', 'deposit_called', '2026-06-01'))).toBe(true)
  })
  it('is false for reserved', () => {
    expect(isPaymentDue(res('a', 'reserved', '2026-06-01'))).toBe(false)
  })
})
