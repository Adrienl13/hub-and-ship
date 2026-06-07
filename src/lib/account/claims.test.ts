import { describe, expect, it, vi } from 'vitest'

import {
  buildClaimInsert,
  createReservationClaim,
  listClaimsForReservation,
  type ReservationClaimsClient,
} from './claims'

describe('buildClaimInsert', () => {
  it('trims the message and forces the open status', () => {
    const payload = buildClaimInsert({
      reservationId: 'r1',
      category: 'damaged',
      quantity: 3,
      message: '  Deux chaises cassées  ',
    })
    expect(payload).toEqual({
      reservation_id: 'r1',
      category: 'damaged',
      quantity: 3,
      message: 'Deux chaises cassées',
      status: 'open',
    })
  })

  it('drops a non-positive quantity to null', () => {
    const payload = buildClaimInsert({
      reservationId: 'r1',
      category: 'delay',
      quantity: 0,
      message: 'Livraison en retard de deux semaines',
    })
    expect(payload.quantity).toBeNull()
  })

  it('rejects a too-short message before any DB call', () => {
    expect(() =>
      buildClaimInsert({
        reservationId: 'r1',
        category: 'other',
        quantity: null,
        message: 'x',
      }),
    ).toThrow(/quelques mots/)
  })
})

describe('createReservationClaim', () => {
  it('inserts and propagates errors', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }))
    const client = {
      from: () => ({ insert }),
    } as unknown as ReservationClaimsClient

    await createReservationClaim(client, {
      reservationId: 'r1',
      category: 'missing',
      quantity: 1,
      message: 'Il manque une table',
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ reservation_id: 'r1', status: 'open' }),
    )
  })
})

describe('listClaimsForReservation', () => {
  it('maps rows to claims', async () => {
    const order = vi.fn(async () => ({
      data: [
        {
          id: 'c1',
          reservation_id: 'r1',
          category: 'damaged',
          status: 'open',
          quantity: 2,
          message: 'abîmé',
          admin_response: null,
          created_at: '2026-06-07',
        },
      ],
      error: null,
    }))
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ order }) }) }),
    } as unknown as ReservationClaimsClient

    const claims = await listClaimsForReservation(client, 'r1')
    expect(claims).toHaveLength(1)
    expect(claims[0]).toMatchObject({
      id: 'c1',
      reservationId: 'r1',
      adminResponse: null,
    })
  })
})
