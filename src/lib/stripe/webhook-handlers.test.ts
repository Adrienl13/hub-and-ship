import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

import {
  markReservationCancelled,
  markReservationReserved,
  type ReservationUpdateBuilder,
  type WebhookReservationClient,
} from './webhook-handlers'

function checkoutSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: 'cs_test_current',
    object: 'checkout.session',
    metadata: {
      reservation_id: '00000000-0000-4000-8000-000000000abc',
    },
    payment_intent: 'pi_test_123',
    customer: 'cus_test_123',
    ...overrides,
  } as Stripe.Checkout.Session
}

function createClient() {
  const eqCalls: Array<readonly [string, string]> = []
  let payload: Record<string, unknown> | null = null

  const builder: ReservationUpdateBuilder = {
    eq: (column, value) => {
      eqCalls.push([column, value])
      return builder
    },
    then: (onfulfilled, onrejected) =>
      Promise.resolve({ error: null }).then(onfulfilled, onrejected),
  }

  const client: WebhookReservationClient = {
    from: (table) => {
      expect(table).toBe('reservations')
      return {
        update: (nextPayload) => {
          payload = nextPayload
          return builder
        },
      }
    },
  }

  return {
    client,
    get payload() {
      return payload
    },
    eqCalls,
  }
}

describe('stripe webhook reservation handlers', () => {
  it('marks a pending reservation as reserved from checkout completion', async () => {
    const state = createClient()

    await markReservationReserved({
      client: state.client,
      session: checkoutSession(),
      now: new Date('2026-06-05T12:00:00.000Z'),
    })

    expect(state.payload).toMatchObject({
      status: 'reserved',
      stripe_payment_intent_id: 'pi_test_123',
      stripe_customer_id: 'cus_test_123',
      stripe_checkout_session_id: 'cs_test_current',
      paid_reservation_fee_at: '2026-06-05T12:00:00.000Z',
    })
    expect(state.eqCalls).toEqual([
      ['id', '00000000-0000-4000-8000-000000000abc'],
      ['status', 'pending_reservation_fee'],
    ])
  })

  it('only cancels the currently tracked checkout session', async () => {
    const state = createClient()

    await markReservationCancelled({
      client: state.client,
      session: checkoutSession(),
      now: new Date('2026-06-05T12:00:00.000Z'),
    })

    expect(state.payload).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'stripe_payment_failed',
      cancelled_at: '2026-06-05T12:00:00.000Z',
    })
    expect(state.eqCalls).toEqual([
      ['id', '00000000-0000-4000-8000-000000000abc'],
      ['status', 'pending_reservation_fee'],
      ['stripe_checkout_session_id', 'cs_test_current'],
    ])
  })

  it('ignores sessions without reservation metadata', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const state = createClient()

    await markReservationReserved({
      client: state.client,
      session: checkoutSession({ metadata: {} }),
    })

    expect(state.payload).toBeNull()
    expect(state.eqCalls).toEqual([])
    expect(warn).toHaveBeenCalledWith(
      'stripe webhook: checkout.session.completed without reservation_id metadata',
      { sessionId: 'cs_test_current' },
    )

    warn.mockRestore()
  })
})
