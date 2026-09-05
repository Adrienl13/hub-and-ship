import { describe, expect, it, vi } from 'vitest'

import {
  pollReservationPaymentStatus,
  resolvePaymentStatus,
  type ReservationPaymentStatusResult,
  type ReservationPaymentStatusRow,
} from './payment-status'

const SESSION_ID = 'cs_test_a1b2c3d4e5f6'

function makeRow(
  overrides: Partial<ReservationPaymentStatusRow> = {},
): ReservationPaymentStatusRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    status: 'reserved',
    reservation_fee: 150,
    paid_reservation_fee_at: '2026-06-05T12:00:00.000Z',
    stripe_checkout_session_id: SESSION_ID,
    ...overrides,
  }
}

describe('resolvePaymentStatus', () => {
  it('returns found:false when the reservation does not exist', () => {
    expect(resolvePaymentStatus(null, SESSION_ID)).toEqual({ found: false })
  })

  it('returns found:false when the session id does not match', () => {
    expect(resolvePaymentStatus(makeRow(), 'cs_test_other')).toEqual({
      found: false,
    })
  })

  it('returns found:false when no session id is stored on the row yet', () => {
    expect(
      resolvePaymentStatus(
        makeRow({ stripe_checkout_session_id: null }),
        SESSION_ID,
      ),
    ).toEqual({ found: false })
  })

  it('exposes the paid status and fee once the webhook has run', () => {
    expect(resolvePaymentStatus(makeRow(), SESSION_ID)).toEqual({
      found: true,
      status: 'reserved',
      paidAmount: 150,
    })
  })

  it('coerces numeric fees returned as strings', () => {
    expect(
      resolvePaymentStatus(makeRow({ reservation_fee: '150.00' }), SESSION_ID),
    ).toEqual({ found: true, status: 'reserved', paidAmount: 150 })
  })

  it('reports 0 paid while the fee is still pending', () => {
    expect(
      resolvePaymentStatus(
        makeRow({ status: 'pending_reservation_fee', paid_reservation_fee_at: null }),
        SESSION_ID,
      ),
    ).toEqual({ found: true, status: 'pending_reservation_fee', paidAmount: 0 })
  })
})

describe('pollReservationPaymentStatus', () => {
  const pending: ReservationPaymentStatusResult = {
    found: true,
    status: 'pending_reservation_fee',
    paidAmount: 0,
  }
  const paid: ReservationPaymentStatusResult = {
    found: true,
    status: 'reserved',
    paidAmount: 150,
  }

  it('stops at the first settled answer without sleeping', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(paid)
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      pollReservationPaymentStatus({ fetchStatus, sleep }),
    ).resolves.toEqual(paid)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries while the webhook has not flipped the status yet', async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ found: false })
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(paid)
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      pollReservationPaymentStatus({ fetchStatus, sleep, intervalMs: 1500 }),
    ).resolves.toEqual(paid)
    expect(fetchStatus).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1500)
  })

  it('gives up after the configured attempts and returns the last answer', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(pending)
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      pollReservationPaymentStatus({ fetchStatus, sleep, attempts: 4 }),
    ).resolves.toEqual(pending)
    expect(fetchStatus).toHaveBeenCalledTimes(4)
    // Pas d'attente inutile après le dernier essai.
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('treats network failures as retryable and returns null if none succeed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchStatus = vi.fn().mockRejectedValue(new Error('offline'))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      pollReservationPaymentStatus({ fetchStatus, sleep, attempts: 2 }),
    ).resolves.toBeNull()
    expect(fetchStatus).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('recovers from a transient failure on a later attempt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(paid)
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      pollReservationPaymentStatus({ fetchStatus, sleep }),
    ).resolves.toEqual(paid)
    warn.mockRestore()
  })

  it('stops polling once a cancelled status is known', async () => {
    const cancelled: ReservationPaymentStatusResult = {
      found: true,
      status: 'cancelled',
      paidAmount: 0,
    }
    const fetchStatus = vi.fn().mockResolvedValue(cancelled)
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      pollReservationPaymentStatus({ fetchStatus, sleep }),
    ).resolves.toEqual(cancelled)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('bails out when the caller cancels between attempts', async () => {
    let cancelledFlag = false
    const fetchStatus = vi.fn().mockResolvedValue(pending)
    const sleep = vi.fn().mockImplementation(async () => {
      cancelledFlag = true
    })

    await expect(
      pollReservationPaymentStatus({
        fetchStatus,
        sleep,
        isCancelled: () => cancelledFlag,
      }),
    ).resolves.toEqual(pending)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })
})
