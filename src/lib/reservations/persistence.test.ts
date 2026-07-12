import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { createPartnerLinkContext } from '@/lib/partners/link'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft } from './draft'
import {
  toReservationInsertPayload,
  toReservationItemInsertPayloads,
} from './persistence'

const chair = PRODUCTS.find((product) => product.category === 'chair')!

describe('reservation persistence payloads', () => {
  it('maps a reservation draft to Supabase insert payloads', () => {
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

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(toReservationInsertPayload(result.draft)).toMatchObject({
      reference: 'CC-2026-001-20260518-0001-000000',
      volume_discount: 0,
      status: 'pending_reservation_fee',
      siret: '55208131701750',
      delivery_mode: 'pickup_at_port',
      cgv_version_accepted: '2026-05-18',
      subtotal_ht: 4450,
      reservation_fee: 150,
    })

    expect(
      toReservationItemInsertPayloads({
        draft: result.draft,
        reservationId: 'reservation-id',
      }),
    ).toEqual([
      expect.objectContaining({
        reservation_id: 'reservation-id',
        product_id: chair.id,
        sku: chair.sku,
        quantity: 50,
        unit_price_ht: chair.basePriceHt,
        cbm_total: 4,
      }),
    ])
  })

  it('stores partner link context inside the contact snapshot', () => {
    const partnerContext = createPartnerLinkContext({
      slug: 'chr-conseil',
      sourcePath: '/p/chr-conseil',
      now: new Date('2026-06-07T08:00:00.000Z'),
    })
    expect(partnerContext).not.toBeNull()
    if (!partnerContext) return

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
      now: new Date('2026-06-07T08:00:00.000Z'),
      partnerContext,
      items: [
        {
          product: chair,
          variant: getDefaultVariant(chair),
          quantity: 50,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(toReservationInsertPayload(result.draft).contact_snapshot).toEqual(
      expect.objectContaining({
        email: 'direction@hotel-demo.fr',
        partner_context: {
          slug: 'chr-conseil',
          display_name: 'CHR Conseil',
          source_path: '/p/chr-conseil',
          selection_id: null,
          captured_at: '2026-06-07T08:00:00.000Z',
          expires_at: '2026-10-05T08:00:00.000Z',
        },
      }),
    )
  })
})
