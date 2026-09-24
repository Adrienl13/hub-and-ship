import { describe, expect, it } from 'vitest'

import {
  adminListContactRequests,
  adminUpdateContactRequestNote,
  adminUpdateContactRequestStatus,
  countContactRequestsByStatus,
  matchesContactRequestSearch,
  nextContactRequestStatuses,
  toAdminContactRequestRow,
  type ContactRequestAdminClient,
  type ContactRequestListQuery,
  type ContactRequestRow,
  type ContactRequestUpdate,
} from './admin-repository'

function makeRow(
  overrides: Partial<ContactRequestRow> = {},
): ContactRequestRow {
  return {
    id: 'cr-1',
    status: 'new',
    topic: 'devis',
    source: 'catalogue_quick_quote',
    name: 'Contact test',
    email: 'contact@exemple.test',
    company: 'Établissement test',
    phone: '+33 6 00 00 00 00',
    message: 'Message de test suffisamment long.',
    product_sku: 'CHA-CAN-001',
    product_name: 'Chaise CANNES',
    product_design: 'Sable',
    quantity: 40,
    price_label: '60 € HT',
    studio_brief: null,
    utm_source: 'linkedin',
    utm_medium: 'social',
    utm_campaign: 'rentree',
    partner_ref: null,
    internal_note: null,
    created_at: '2026-09-24T09:00:00.000Z',
    updated_at: '2026-09-24T09:00:00.000Z',
    ...overrides,
  }
}

interface CallLog {
  readonly filters: Array<{ column: string; value: string }>
  order: { column: string; ascending: boolean } | null
  limit: number | null
  updates: Array<{ id: string; values: ContactRequestUpdate }>
}

function createClient(
  rows: ReadonlyArray<ContactRequestRow>,
  failWith?: string,
): { client: ContactRequestAdminClient; log: CallLog } {
  const log: CallLog = { filters: [], order: null, limit: null, updates: [] }
  const result = failWith
    ? { data: null, error: { message: failWith } }
    : { data: rows, error: null }

  const query: ContactRequestListQuery = {
    eq: (column, value) => {
      log.filters.push({ column, value })
      return query
    },
    order: (column, options) => {
      log.order = { column, ascending: options.ascending }
      return query
    },
    limit: (count) => {
      log.limit = count
      return query
    },
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  }

  const client: ContactRequestAdminClient = {
    from: () => ({
      select: () => query,
      update: (values) => ({
        eq: (_column, id) => {
          log.updates.push({ id, values })
          return Promise.resolve(
            failWith
              ? { data: null, error: { message: failWith } }
              : { data: null, error: null },
          )
        },
      }),
    }),
  }
  return { client, log }
}

describe('toAdminContactRequestRow', () => {
  it('maps snake_case columns and resolves topic / source labels', () => {
    const row = toAdminContactRequestRow(makeRow())
    expect(row).toMatchObject({
      id: 'cr-1',
      topicLabel: 'Demande de devis',
      sourceLabel: 'Devis rapide catalogue',
      productSku: 'CHA-CAN-001',
      productDesign: 'Sable',
      priceLabel: '60 € HT',
      utmSource: 'linkedin',
      utmCampaign: 'rentree',
      partnerRef: null,
      internalNote: null,
    })
  })

  it('reuses the shared contact source lexicon (product_page, custom_colorway)', () => {
    expect(
      toAdminContactRequestRow(makeRow({ source: 'product_page' })).sourceLabel,
    ).toBe('Fiche produit')
    expect(
      toAdminContactRequestRow(makeRow({ source: 'custom_colorway' }))
        .sourceLabel,
    ).toBe('Coloris sur mesure')
  })

  it('keeps unknown topics and sources readable instead of failing', () => {
    const row = toAdminContactRequestRow(
      makeRow({ topic: 'sujet_inconnu', source: 'landing_x' }),
    )
    expect(row.topicLabel).toBe('sujet_inconnu')
    expect(row.sourceLabel).toBe('landing_x')
  })
})

describe('adminListContactRequests', () => {
  it('lists newest first with the default limit and no filter', async () => {
    const { client, log } = createClient([makeRow()])
    const rows = await adminListContactRequests(client)
    expect(rows).toHaveLength(1)
    expect(log.order).toEqual({ column: 'created_at', ascending: false })
    expect(log.limit).toBe(500)
    expect(log.filters).toEqual([])
  })

  it('applies status and topic filters and a custom limit', async () => {
    const { client, log } = createClient([])
    await adminListContactRequests(client, {
      status: 'quoted',
      topic: 'produit',
      limit: 50,
    })
    expect(log.limit).toBe(50)
    expect(log.filters).toEqual([
      { column: 'status', value: 'quoted' },
      { column: 'topic', value: 'produit' },
    ])
  })

  it('surfaces the database error message', async () => {
    const { client } = createClient([], 'RLS denied')
    await expect(adminListContactRequests(client)).rejects.toThrow('RLS denied')
  })
})

describe('mutations', () => {
  it('updates the status and stamps updated_at', async () => {
    const { client, log } = createClient([])
    await adminUpdateContactRequestStatus(client, 'cr-1', 'contacted')
    expect(log.updates).toHaveLength(1)
    expect(log.updates[0]?.id).toBe('cr-1')
    expect(log.updates[0]?.values.status).toBe('contacted')
    expect(log.updates[0]?.values.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('stores a trimmed note and clears it when emptied', async () => {
    const { client, log } = createClient([])
    await adminUpdateContactRequestNote(client, 'cr-1', '  Rappeler lundi  ')
    await adminUpdateContactRequestNote(client, 'cr-1', '   ')
    expect(log.updates[0]?.values.internal_note).toBe('Rappeler lundi')
    expect(log.updates[1]?.values.internal_note).toBeNull()
  })

  it('throws when the update is refused', async () => {
    const { client } = createClient([], 'RLS denied')
    await expect(
      adminUpdateContactRequestStatus(client, 'cr-1', 'won'),
    ).rejects.toThrow('RLS denied')
  })
})

describe('helpers', () => {
  it('offers the funnel transitions and a reopen from closed states', () => {
    expect(nextContactRequestStatuses('new').map((t) => t.target)).toEqual([
      'contacted',
      'quoted',
      'lost',
    ])
    expect(nextContactRequestStatuses('quoted').map((t) => t.target)).toEqual([
      'won',
      'lost',
    ])
    expect(nextContactRequestStatuses('won')).toEqual([
      { label: 'Rouvrir', target: 'new' },
    ])
    expect(nextContactRequestStatuses('lost')).toEqual([
      { label: 'Rouvrir', target: 'new' },
    ])
  })

  it('counts every status, including empty ones', () => {
    const rows = [
      makeRow({ id: 'a' }),
      makeRow({ id: 'b', status: 'won' }),
      makeRow({ id: 'c', status: 'won' }),
    ].map(toAdminContactRequestRow)
    expect(countContactRequestsByStatus(rows)).toEqual({
      new: 1,
      contacted: 0,
      quoted: 0,
      won: 2,
      lost: 0,
    })
  })

  it('searches name, email, company and product fields case-insensitively', () => {
    const row = toAdminContactRequestRow(makeRow())
    expect(matchesContactRequestSearch(row, '')).toBe(true)
    expect(matchesContactRequestSearch(row, 'ÉTABLISSEMENT')).toBe(true)
    expect(matchesContactRequestSearch(row, 'cha-can')).toBe(true)
    expect(matchesContactRequestSearch(row, 'sable')).toBe(true)
    expect(matchesContactRequestSearch(row, 'introuvable')).toBe(false)
  })
})
