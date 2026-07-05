import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft } from '@/lib/reservations/draft'
import {
  accountReservationFromLocalRecord,
  calculateAccountReservationKpis,
  getAccountReservationById,
  mergeAccountReservations,
} from './reservations'

const chair = PRODUCTS.find((product) => product.category === 'chair')!

function makeDraft(id: string) {
  const result = buildReservationDraft({
    id,
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

describe('account reservations merging', () => {
  it('returns local-only records when there are no remote reservations', () => {
    const draft = makeDraft('00000000-0000-4000-8000-000000000001')
    const merged = mergeAccountReservations({
      localRecords: [
        {
          id: draft.id,
          status: 'pending_reservation_fee',
          draft,
          paidAmount: 0,
          nextActionLabel: 'A regler',
          updatedAt: draft.cgvAcceptedAt,
        },
      ],
    })

    expect(merged).toHaveLength(1)
    expect(merged[0]?.draft.id).toBe(draft.id)
  })

  it('prefers the remote row when the same id exists locally and remotely', () => {
    const draft = makeDraft('00000000-0000-4000-8000-000000000002')
    const merged = mergeAccountReservations({
      remoteReservations: [
        {
          id: draft.id,
          status: 'reserved',
          draft,
          paidAmount: draft.payment.payNow,
          nextActionLabel: 'Acompte a appeler',
          updatedAt: draft.cgvAcceptedAt,
        },
      ],
      localRecords: [
        {
          id: draft.id,
          status: 'pending_reservation_fee',
          draft,
          paidAmount: 0,
          nextActionLabel: 'A regler (local)',
          updatedAt: draft.cgvAcceptedAt,
        },
      ],
    })

    expect(merged).toHaveLength(1)
    expect(merged[0]?.status).toBe('reserved')
  })

  it('lists remote then local-only when ids do not overlap', () => {
    const remoteDraft = makeDraft('00000000-0000-4000-8000-000000000003')
    const localDraft = makeDraft('00000000-0000-4000-8000-000000000004')
    const merged = mergeAccountReservations({
      remoteReservations: [
        {
          id: remoteDraft.id,
          status: 'reserved',
          draft: remoteDraft,
          paidAmount: remoteDraft.payment.payNow,
          nextActionLabel: 'Acompte',
          updatedAt: remoteDraft.cgvAcceptedAt,
        },
      ],
      localRecords: [
        {
          id: localDraft.id,
          status: 'pending_reservation_fee',
          draft: localDraft,
          paidAmount: 0,
          nextActionLabel: 'A regler',
          updatedAt: localDraft.cgvAcceptedAt,
        },
      ],
    })

    expect(merged.map((r) => r.id)).toEqual([remoteDraft.id, localDraft.id])
  })

  it('finds reservations by id', () => {
    const draft = makeDraft('00000000-0000-4000-8000-000000000005')
    const reservation = accountReservationFromLocalRecord({
      id: draft.id,
      status: 'reserved',
      draft,
      paidAmount: draft.payment.payNow,
      nextActionLabel: 'OK',
      updatedAt: draft.cgvAcceptedAt,
    })

    expect(getAccountReservationById(draft.id, [reservation])).toEqual(
      reservation,
    )
    expect(getAccountReservationById('missing', [reservation])).toBeNull()
  })

  it('finds legacy local reservations by their draft uuid', () => {
    const draft = makeDraft('00000000-0000-4000-8000-000000000015')
    const reservation = accountReservationFromLocalRecord({
      id: `local-${draft.reference}`,
      status: 'pending_reservation_fee',
      draft,
      paidAmount: 0,
      nextActionLabel: 'A regler',
      updatedAt: draft.cgvAcceptedAt,
    })

    expect(getAccountReservationById(draft.id, [reservation])).toEqual(
      reservation,
    )
  })

  it('aggregates KPIs from the merged list', () => {
    const draft = makeDraft('00000000-0000-4000-8000-000000000006')
    const reservation = accountReservationFromLocalRecord({
      id: draft.id,
      status: 'reserved',
      draft,
      paidAmount: draft.payment.payNow,
      nextActionLabel: 'OK',
      updatedAt: draft.cgvAcceptedAt,
    })

    expect(calculateAccountReservationKpis([reservation])).toMatchObject({
      activeCount: 1,
      totalCommittedHt: draft.totals.subtotalHt,
      totalPaid: draft.payment.payNow,
    })
  })
})
