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
  it('creates the reservation through the atomic Supabase RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000abc',
        reference: 'CC-2026-001-20260518-0001-000000',
      },
      error: null,
    })
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
    client.rpc = rpc

    await expect(
      createReservationInSupabase({ client, draft: createDraft() }),
    ).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000abc',
      reference: 'CC-2026-001-20260518-0001-000000',
    })

    expect(rpc).toHaveBeenCalledWith(
      'create_reservation_with_items',
      expect.objectContaining({
        payload: expect.objectContaining({
          reservation: expect.objectContaining({
            id: '00000000-0000-4000-8000-000000000abc',
            reference: 'CC-2026-001-20260518-0001-000000',
            status: 'pending_reservation_fee',
          }),
          items: [
            expect.objectContaining({
              reservation_id: '00000000-0000-4000-8000-000000000abc',
              product_id: chair.id,
              quantity: 50,
            }),
          ],
        }),
      }),
    )
    expect(insertReservation).not.toHaveBeenCalled()
    expect(insertItems).not.toHaveBeenCalled()
  })

  it('throws a clear error when the RPC rejects the reservation', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'reservation payload mismatch', code: 'P0001' },
      }),
      from: vi.fn(),
    } as unknown as ReservationRepositoryClient

    await expect(
      createReservationInSupabase({ client, draft: createDraft() }),
    ).rejects.toThrow('reservation payload mismatch')
  })

  it('falls back to legacy inserts only when the RPC migration is missing', async () => {
    const insertReservation = vi
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const insertItems = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message:
            'Could not find the function public.create_reservation_with_items',
          code: 'PGRST202',
        },
      }),
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
      reference: 'CC-2026-001-20260518-0001-000000',
    })

    expect(insertReservation).toHaveBeenCalledOnce()
    expect(insertItems).toHaveBeenCalledOnce()
  })

  it('throws a clear error when legacy reservation insert fails', async () => {
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

  it('throws a clear error when legacy item insert fails', async () => {
    const client = {
      from: vi.fn((table: 'reservations' | 'reservation_items') =>
        table === 'reservations'
          ? {
              insert: vi.fn().mockResolvedValue({ data: null, error: null }),
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
