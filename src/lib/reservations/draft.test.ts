import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import type { ReferralApplication } from '@/lib/pricing/referral'
import {
  buildReservationDraft,
  createReservationReference,
} from './draft'

const chair = PRODUCTS.find((product) => product.category === 'chair')!
const table = PRODUCTS.find((product) => product.category === 'table')!

const baseInput = {
  siret: '552 081 317 01750',
  contact: {
    name: 'Adrien Laniez',
    company: 'Hotel Demo',
    email: 'direction@hotel-demo.fr',
    phone: '+33 6 12 34 56 78',
  },
  delivery: {
    deliveryMode: 'pickup_at_port' as const,
    deliveryNote: 'Enlevement par notre transporteur.',
  },
  cgvAccepted: true,
  cgvVersion: '2026-05-18',
  containerReference: 'CC-2026-001',
  now: new Date('2026-05-18T10:00:00.000Z'),
  sequence: 12,
}

describe('reservation draft builder', () => {
  it('creates deterministic reservation references', () => {
    expect(
      createReservationReference({
        containerReference: 'CC-2026-001',
        now: new Date('2026-05-18T10:00:00.000Z'),
        sequence: 7,
      }),
    ).toBe('CC-2026-001-20260518-0007')
  })

  it('builds a server-side reservation draft with locked line snapshots', () => {
    const result = buildReservationDraft({
      ...baseInput,
      items: [
        {
          product: chair,
          variant: getDefaultVariant(chair),
          quantity: 50,
        },
        {
          product: table,
          variant: getDefaultVariant(table),
          quantity: 10,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.reference).toBe('CC-2026-001-20260518-0012')
    expect(result.draft.siret).toBe('55208131701750')
    expect(result.draft.lines).toHaveLength(2)
    expect(result.draft.lines[0]).toMatchObject({
      productId: chair.id,
      sku: chair.sku,
      quantity: 50,
      unitPriceHt: chair.basePriceHt,
      cbmTotal: 4,
    })
    expect(result.draft.totals.subtotalHt).toBe(6340)
    expect(result.draft.payment).toMatchObject({
      reservationFee: 190.2,
      payNow: 190.2,
      depositAmount: 1902,
      balanceAmount: 4438,
    })
  })

  it('applies referral discount to pay-now amount without changing order totals', () => {
    const referralApplication: ReferralApplication = {
      status: 'applied',
      code: 'CONTAINER-DEMO',
      referrerLabel: 'Pierre - Hotel Demo',
      discountAmount: 100,
      payNow: 90.2,
      message: 'Remise appliquee',
    }

    const result = buildReservationDraft({
      ...baseInput,
      referralCode: referralApplication.code,
      referralApplication,
      items: [
        {
          product: chair,
          variant: getDefaultVariant(chair),
          quantity: 50,
        },
        {
          product: table,
          variant: getDefaultVariant(table),
          quantity: 10,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.payment.payNow).toBe(90.2)
    expect(result.draft.referral).toMatchObject({
      code: 'CONTAINER-DEMO',
      status: 'applied',
      discountAmount: 100,
    })
    expect(result.draft.totals.subtotalHt).toBe(6340)
  })

  it('rejects empty carts and invalid checkout data', () => {
    const result = buildReservationDraft({
      ...baseInput,
      siret: '123',
      cgvAccepted: false,
      items: [],
    })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['items', 'siret', 'cgvAccepted']),
    )
  })

  it('enforces chair minimum quantity and increment rules', () => {
    const result = buildReservationDraft({
      ...baseInput,
      items: [
        {
          product: chair,
          variant: getDefaultVariant(chair),
          quantity: 55,
        },
      ],
    })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues).toContainEqual({
      path: `items.${chair.id}.quantity`,
      message: `Quantité invalide pour ${chair.name} : Min. 50 puis +10.`,
    })
  })
})
