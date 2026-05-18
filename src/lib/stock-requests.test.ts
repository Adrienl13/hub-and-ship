import { describe, expect, it } from 'vitest'

import { getAvailableStockLines } from './stock'
import {
  LOCAL_STOCK_REQUESTS_KEY,
  buildStockRequestDraft,
  readLocalStockRequests,
  saveStockRequestToLocalHistory,
  toStockRequestInsertPayload,
} from './stock-requests'

function createStorage(initial?: string) {
  const state = new Map<string, string>()
  if (initial) state.set(LOCAL_STOCK_REQUESTS_KEY, initial)

  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value)
    },
  }
}

describe('stock request drafts', () => {
  it('builds a deterministic stock request draft', () => {
    const line = getAvailableStockLines()[0]
    if (!line) throw new Error('Missing stock fixture')

    const result = buildStockRequestDraft({
      line,
      companyName: 'Hotel Demo',
      contactEmail: 'Direction@Hotel-Demo.fr',
      contactPhone: '+33 6 12 34 56 78',
      requestedQuantity: 20,
      now: new Date('2026-05-18T18:00:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: true,
      draft: {
        localId: 'stock-stock-cannes-noir-20260518180000',
        requestedQuantity: 20,
        estimatedTotalHt: 2180,
        contactEmail: 'direction@hotel-demo.fr',
      },
    })
  })

  it('caps requested quantity to the available stock snapshot', () => {
    const line = getAvailableStockLines()[4]
    if (!line) throw new Error('Missing stock fixture')

    const result = buildStockRequestDraft({
      line,
      companyName: 'Brasserie Test',
      contactEmail: 'achat@brasserie-test.fr',
      contactPhone: '+33 1 22 33 44 55',
      requestedQuantity: 99,
    })

    expect(result.ok && result.draft.requestedQuantity).toBe(9)
  })

  it('maps drafts to Supabase insert payloads', () => {
    const line = getAvailableStockLines()[0]
    if (!line) throw new Error('Missing stock fixture')

    const result = buildStockRequestDraft({
      line,
      companyName: 'Hotel Demo',
      contactEmail: 'direction@hotel-demo.fr',
      contactPhone: '+33 6 12 34 56 78',
      requestedQuantity: 12,
      customerNote: 'Ouverture terrasse samedi.',
      now: new Date('2026-05-18T18:00:00.000Z'),
    })

    if (!result.ok) throw new Error('Invalid stock draft fixture')

    expect(toStockRequestInsertPayload(result.draft)).toMatchObject({
      stock_line_id: 'stock-cannes-noir',
      product_name: 'Chaise Cannes Empilable',
      requested_quantity: 12,
      estimated_total_ht: 1308,
      company_name: 'Hotel Demo',
      customer_note: 'Ouverture terrasse samedi.',
    })
  })

  it('stores local requests for admin fallback', () => {
    const line = getAvailableStockLines()[0]
    if (!line) throw new Error('Missing stock fixture')

    const result = buildStockRequestDraft({
      line,
      companyName: 'Hotel Demo',
      contactEmail: 'direction@hotel-demo.fr',
      contactPhone: '+33 6 12 34 56 78',
      requestedQuantity: 12,
    })
    if (!result.ok) throw new Error('Invalid stock draft fixture')

    const storage = createStorage()
    saveStockRequestToLocalHistory({ storage, draft: result.draft })

    expect(readLocalStockRequests(storage)).toHaveLength(1)
  })

  it('ignores malformed local payloads', () => {
    expect(readLocalStockRequests(createStorage('{bad'))).toEqual([])
  })
})
