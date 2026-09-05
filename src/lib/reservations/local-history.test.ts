import { describe, expect, it } from 'vitest'

import { accountReservationFromLocalRecord } from '@/lib/account/reservations'
import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft } from './draft'
import {
  LOCAL_RESERVATION_FEE_PAID_LABEL,
  LOCAL_RESERVATION_HISTORY_KEY,
  applyPaymentStatusToLocalHistory,
  isReservationFeeSettled,
  readLocalReservationHistory,
  saveReservationDraftToLocalHistory,
} from './local-history'

function createMemoryStorage(initial?: string) {
  const state = new Map<string, string>()
  if (initial) state.set(LOCAL_RESERVATION_HISTORY_KEY, initial)

  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value)
    },
  }
}

function createDraft(sequence = 1) {
  const product = PRODUCTS[0]
  if (!product) throw new Error('Missing product fixture')

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
    sequence,
    items: [
      {
        product,
        variant: getDefaultVariant(product),
        quantity: 50,
      },
    ],
  })

  if (!result.ok) throw new Error('Invalid draft fixture')
  return result.draft
}

describe('local reservation history', () => {
  it('stores a reservation draft as a local account record', () => {
    const storage = createMemoryStorage()
    const draft = createDraft()

    const record = saveReservationDraftToLocalHistory({
      storage,
      draft,
      persisted: false,
    })

    expect(record.id).toBe(draft.id)
    expect(record.status).toBe('pending_reservation_fee')
    expect(record.paidAmount).toBe(0)
    expect(readLocalReservationHistory(storage)).toHaveLength(1)
  })

  it('deduplicates records by reference without marking payment as settled', () => {
    const storage = createMemoryStorage()
    const draft = createDraft()

    saveReservationDraftToLocalHistory({ storage, draft, persisted: false })
    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })

    const records = readLocalReservationHistory(storage)
    expect(records).toHaveLength(1)
    expect(records[0]?.id).toBe(draft.id)
    expect(records[0]?.status).toBe('pending_reservation_fee')
    expect(records[0]?.paidAmount).toBe(0)
  })

  it('replaces legacy local-reference records for the same draft', () => {
    const draft = createDraft()
    const storage = createMemoryStorage(
      JSON.stringify([
        {
          id: `local-${draft.reference}`,
          status: 'pending_reservation_fee',
          draft,
          paidAmount: 0,
          nextActionLabel: 'Legacy record',
          updatedAt: draft.cgvAcceptedAt,
        },
      ]),
    )

    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })

    const records = readLocalReservationHistory(storage)
    expect(records).toHaveLength(1)
    expect(records[0]?.id).toBe(draft.id)
    expect(records[0]?.nextActionLabel).toBe(
      'Reservation enregistree, paiement a finaliser',
    )
  })

  it('ignores malformed storage payloads', () => {
    const storage = createMemoryStorage('{bad json')

    expect(readLocalReservationHistory(storage)).toEqual([])
  })
})

describe('isReservationFeeSettled', () => {
  it('is false while pending or cancelled, true otherwise', () => {
    expect(isReservationFeeSettled('pending_reservation_fee')).toBe(false)
    expect(isReservationFeeSettled('cancelled')).toBe(false)
    expect(isReservationFeeSettled('reserved')).toBe(true)
    expect(isReservationFeeSettled('deposit_called')).toBe(true)
  })
})

describe('applyPaymentStatusToLocalHistory', () => {
  const now = new Date('2026-06-05T12:00:00.000Z')

  it('marks the matching record as reserved and paid (Stripe return)', () => {
    const storage = createMemoryStorage()
    const draft = createDraft()
    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })

    const updated = applyPaymentStatusToLocalHistory({
      storage,
      reservationId: draft.id,
      status: 'reserved',
      paidAmount: draft.payment.reservationFee,
      now,
    })

    expect(updated).toMatchObject({
      id: draft.id,
      status: 'reserved',
      paidAmount: draft.payment.reservationFee,
      nextActionLabel: LOCAL_RESERVATION_FEE_PAID_LABEL,
      updatedAt: '2026-06-05T12:00:00.000Z',
    })

    // Le storage est bien réécrit : une relecture voit le paiement.
    const records = readLocalReservationHistory(storage)
    expect(records).toHaveLength(1)
    expect(records[0]?.status).toBe('reserved')
    expect(records[0]?.paidAmount).toBe(draft.payment.reservationFee)

    // ...et le merge compte le montant comme "déjà réglé".
    const account = accountReservationFromLocalRecord(records[0]!)
    expect(account.status).toBe('reserved')
    expect(account.paidAmount).toBeGreaterThan(0)
  })

  it('treats any post-payment status as settled', () => {
    const storage = createMemoryStorage()
    const draft = createDraft()
    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })

    const updated = applyPaymentStatusToLocalHistory({
      storage,
      reservationId: draft.id,
      status: 'deposit_called',
      paidAmount: 150,
      now,
    })

    expect(updated?.status).toBe('reserved')
    expect(updated?.paidAmount).toBe(150)
  })

  it('keeps the pending status when the server still says pending', () => {
    const storage = createMemoryStorage()
    const draft = createDraft()
    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })

    const updated = applyPaymentStatusToLocalHistory({
      storage,
      reservationId: draft.id,
      status: 'pending_reservation_fee',
      paidAmount: 0,
      now,
    })

    expect(updated?.status).toBe('pending_reservation_fee')
    expect(updated?.paidAmount).toBe(0)
    expect(updated?.nextActionLabel).toBe(
      'Reservation enregistree, paiement a finaliser',
    )
  })

  it('is a no-op when the reservation is not in the local history', () => {
    const draft = createDraft()
    const storage = createMemoryStorage()
    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })
    const before = storage.getItem(LOCAL_RESERVATION_HISTORY_KEY)

    const updated = applyPaymentStatusToLocalHistory({
      storage,
      reservationId: '00000000-0000-4000-8000-00000000dead',
      status: 'reserved',
      paidAmount: 150,
      now,
    })

    expect(updated).toBeNull()
    expect(storage.getItem(LOCAL_RESERVATION_HISTORY_KEY)).toBe(before)
  })

  it('matches legacy local-reference records through their draft uuid', () => {
    const draft = createDraft()
    const storage = createMemoryStorage(
      JSON.stringify([
        {
          id: `local-${draft.reference}`,
          status: 'pending_reservation_fee',
          draft,
          paidAmount: 0,
          nextActionLabel: 'Legacy record',
          updatedAt: draft.cgvAcceptedAt,
        },
      ]),
    )

    const updated = applyPaymentStatusToLocalHistory({
      storage,
      reservationId: draft.id,
      status: 'reserved',
      paidAmount: 150,
      now,
    })

    expect(updated?.id).toBe(`local-${draft.reference}`)
    expect(updated?.status).toBe('reserved')
  })

  it('only rewrites the targeted record', () => {
    const storage = createMemoryStorage()
    const first = createDraft(1)
    const second = createDraft(2)
    saveReservationDraftToLocalHistory({ storage, draft: first, persisted: true })
    saveReservationDraftToLocalHistory({
      storage,
      draft: second,
      persisted: true,
    })

    applyPaymentStatusToLocalHistory({
      storage,
      reservationId: second.id,
      status: 'reserved',
      paidAmount: 150,
      now,
    })

    const records = readLocalReservationHistory(storage)
    expect(records).toHaveLength(2)
    expect(records.find((r) => r.id === first.id)?.status).toBe(
      'pending_reservation_fee',
    )
    expect(records.find((r) => r.id === second.id)?.status).toBe('reserved')
  })
})
