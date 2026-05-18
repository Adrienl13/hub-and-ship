import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import { buildReservationDraft } from './draft'
import {
  LOCAL_RESERVATION_HISTORY_KEY,
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

    expect(record.id).toBe('local-CC-2026-001-20260518-0001')
    expect(record.status).toBe('pending_reservation_fee')
    expect(readLocalReservationHistory(storage)).toHaveLength(1)
  })

  it('deduplicates records by reference', () => {
    const storage = createMemoryStorage()
    const draft = createDraft()

    saveReservationDraftToLocalHistory({ storage, draft, persisted: false })
    saveReservationDraftToLocalHistory({ storage, draft, persisted: true })

    const records = readLocalReservationHistory(storage)
    expect(records).toHaveLength(1)
    expect(records[0]?.status).toBe('reserved')
  })

  it('ignores malformed storage payloads', () => {
    const storage = createMemoryStorage('{bad json')

    expect(readLocalReservationHistory(storage)).toEqual([])
  })
})
