import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft, createReservationReference } from './draft'

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
  // id fixe → jeton d'unicité de la référence déterministe pour les tests.
  id: '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9',
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

  it('appends a uniqueness token so same-day references never collide', () => {
    const args = {
      containerReference: 'CC-2026-001',
      now: new Date('2026-05-18T10:00:00.000Z'),
      sequence: 1,
    }
    const refA = createReservationReference({
      ...args,
      token: 'aaaaaaaa-1111',
    })
    const refB = createReservationReference({
      ...args,
      token: 'bbbbbbbb-2222',
    })
    expect(refA).toBe('CC-2026-001-20260518-0001-AAAAAA')
    expect(refA).not.toBe(refB)
  })

  it('gives two distinct reservations distinct references (anti-collision)', () => {
    const items = [
      { product: chair, variant: getDefaultVariant(chair), quantity: 50 },
    ]
    const a = buildReservationDraft({
      ...baseInput,
      id: undefined,
      items,
    })
    const b = buildReservationDraft({
      ...baseInput,
      id: undefined,
      items,
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.draft.reference).not.toBe(b.draft.reference)
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

    expect(result.draft.reference).toBe('CC-2026-001-20260518-0012-0A1B2C')
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

  it('captures the checkout code for attribution without discounting pay-now (LOT 5 apporteur model)', () => {
    const result = buildReservationDraft({
      ...baseInput,
      referralCode: 'DBP-13',
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

    // The apporteur benefit is an 8% commission to the referrer, not a discount
    // to the referred client — pay-now stays the full reservation fee.
    expect(result.draft.payment.payNow).toBe(result.draft.payment.reservationFee)
    expect(result.draft.referral).toMatchObject({
      code: 'DBP-13',
      status: 'none',
      discountAmount: 0,
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
