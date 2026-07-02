import { describe, expect, it, vi } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft } from './draft'
import {
  createReservationInSupabase,
  type ReservationRepositoryClient,
} from './repository'

const chair = PRODUCTS.find((product) => product.category === 'chair')!

function createDraft() {
  const result = buildReservationDraft({
    id: '00000000-0000-4000-8000-000000000abc',
    siret: '55208131701750',
    contact: {
      name: 'Adrien Laniez',
      company: 'Hotel Demo',
      email: 'direction@hotel-demo.fr',
      phone: '+33 6 12 34 56 78',
    },
    delivery: { deliveryMode: 'pickup_at_port' },
    cgvAccepted: true,
    cgvVersion: '2026-05-18',
    containerReference: 'CC-2026-001',
    now: new Date('2026-05-18T10:00:00.000Z'),
    items: [
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 50,
      },
    ],
  })

  if (!result.ok) throw new Error('Invalid test draft')
  return result.draft
}

describe('createReservationInSupabase', () => {
  it('inserts the reservation then its item snapshots using the client-side id', async () => {
    const insertReservation = vi
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const insertItems = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      from: vi.fn((table: 'reservations' | 'reservation_items') =>
        table === 'reservations'
          ? { insert: insertReservation }
          : { insert: insertItems },
      ),
    } as unknown as ReservationRepositoryClient

    await expect(
      createReservationInSupabase({ client, draft: createDraft() }),
    ).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000abc',
      reference: 'CC-2026-001-20260518-0001',
    })

    expect(insertReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000abc',
        reference: 'CC-2026-001-20260518-0001',
        status: 'pending_reservation_fee',
      }),
    )
    expect(insertItems).toHaveBeenCalledWith([
      expect.objectContaining({
        reservation_id: '00000000-0000-4000-8000-000000000abc',
        product_id: chair.id,
        quantity: 50,
      }),
    ])
  })

  it('merges first-touch attribution onto the reservation payload', async () => {
    const insertReservation = vi
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const insertItems = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      from: vi.fn((table: 'reservations' | 'reservation_items') =>
        table === 'reservations'
          ? { insert: insertReservation }
          : { insert: insertItems },
      ),
    } as unknown as ReservationRepositoryClient

    await createReservationInSupabase({
      client,
      draft: createDraft(),
      attribution: {
        utm_source: 'partner',
        utm_medium: 'qr',
        utm_campaign: 'corner_depot',
        partner_ref: 'DBP-13',
      },
    })

    expect(insertReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        utm_source: 'partner',
        utm_medium: 'qr',
        utm_campaign: 'corner_depot',
        partner_ref: 'DBP-13',
      }),
    )
  })

  it('defaults attribution to null columns when none is provided', async () => {
    const insertReservation = vi
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const client = {
      from: vi.fn((table: 'reservations' | 'reservation_items') =>
        table === 'reservations'
          ? { insert: insertReservation }
          : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) },
      ),
    } as unknown as ReservationRepositoryClient

    await createReservationInSupabase({ client, draft: createDraft() })

    expect(insertReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        utm_source: null,
        partner_ref: null,
      }),
    )
  })

  it('throws a clear error when reservation insert fails', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'RLS denied insert' },
        }),
      })),
    } as unknown as ReservationRepositoryClient

    await expect(
      createReservationInSupabase({ client, draft: createDraft() }),
    ).rejects.toThrow('RLS denied insert')
  })

  it('throws a clear error when item insert fails', async () => {
    const client = {
      from: vi.fn((table: 'reservations' | 'reservation_items') =>
        table === 'reservations'
          ? {
              insert: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }
          : {
              insert: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'item insert failed' },
              }),
            },
      ),
    } as unknown as ReservationRepositoryClient

    await expect(
      createReservationInSupabase({ client, draft: createDraft() }),
    ).rejects.toThrow('item insert failed')
  })
})
