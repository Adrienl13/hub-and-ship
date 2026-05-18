import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft } from '@/lib/reservations/draft'
import { useReservationCreation } from './useReservationCreation'

const chair = PRODUCTS.find((product) => product.category === 'chair')!

function createDraft() {
  const result = buildReservationDraft({
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

  if (!result.ok) throw new Error('Invalid draft fixture')
  return result.draft
}

describe('useReservationCreation', () => {
  it('returns a non-persisted local success until Supabase env keys are present', async () => {
    const { result } = renderHook(() => useReservationCreation())

    expect(result.current.isConfigured).toBe(false)
    await expect(
      result.current.createReservation(createDraft()),
    ).resolves.toEqual({
      ok: true,
      persisted: false,
      reservation: { reference: 'CC-2026-001-20260518-0001' },
    })
  })
})
