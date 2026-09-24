import { describe, expect, it } from 'vitest'

import {
  listFollowUpsByEmail,
  listFollowUpsForTargets,
  toFollowUpRow,
  type FollowUpDbRow,
  type FollowUpListQuery,
  type FollowUpsClient,
} from './follow-ups.repository'

function makeDbRow(overrides: Partial<FollowUpDbRow> = {}): FollowUpDbRow {
  return {
    id: 'fu-1',
    target_kind: 'contact_request',
    target_id: 'cr-1',
    recipient_email: 'camille@exemple.test',
    subject: 'Votre devis Terrassea',
    body: 'Nous revenons vers vous.',
    template: 'devis',
    sent_by: 'admin-1',
    sent_at: '2026-09-24T09:00:00.000Z',
    delivery_id: 'brevo-1',
    ...overrides,
  }
}

interface Captured {
  readonly filters: Array<{ op: string; column: string; value: unknown }>
  order: { column: string; ascending: boolean } | null
  limit: number | null
}

function createClient(
  rows: ReadonlyArray<FollowUpDbRow>,
  failWith?: string,
): { client: FollowUpsClient; queries: Captured[] } {
  const queries: Captured[] = []
  const client: FollowUpsClient = {
    from: () => ({
      select: () => {
        const captured: Captured = { filters: [], order: null, limit: null }
        queries.push(captured)
        const query: FollowUpListQuery = {
          eq: (column, value) => {
            captured.filters.push({ op: 'eq', column, value })
            return query
          },
          in: (column, values) => {
            captured.filters.push({ op: 'in', column, value: values })
            return query
          },
          ilike: (column, pattern) => {
            captured.filters.push({ op: 'ilike', column, value: pattern })
            return query
          },
          order: (column, options) => {
            captured.order = { column, ascending: options.ascending }
            return query
          },
          limit: (count) => {
            captured.limit = count
            return query
          },
          then: (onfulfilled, onrejected) => {
            // Ne rend que les lignes visées par le filtre `in`, comme la base.
            const inFilter = captured.filters.find((f) => f.op === 'in')
            const wanted = inFilter
              ? new Set(inFilter.value as ReadonlyArray<string>)
              : null
            const data = wanted
              ? rows.filter((row) => wanted.has(row.target_id))
              : rows
            const result = failWith
              ? { data: null, error: { message: failWith } }
              : { data, error: null }
            return Promise.resolve(result).then(onfulfilled, onrejected)
          },
        }
        return query
      },
    }),
  }
  return { client, queries }
}

describe('toFollowUpRow', () => {
  it('maps snake_case columns to the admin row', () => {
    expect(toFollowUpRow(makeDbRow())).toEqual({
      id: 'fu-1',
      targetKind: 'contact_request',
      targetId: 'cr-1',
      recipientEmail: 'camille@exemple.test',
      subject: 'Votre devis Terrassea',
      body: 'Nous revenons vers vous.',
      template: 'devis',
      sentBy: 'admin-1',
      sentAt: '2026-09-24T09:00:00.000Z',
      deliveryId: 'brevo-1',
    })
  })
})

describe('listFollowUpsForTargets', () => {
  it('groups follow-ups by target, filtered on kind and ids', async () => {
    const { client, queries } = createClient([
      makeDbRow({
        id: 'fu-2',
        target_id: 'cr-1',
        sent_at: '2026-09-25T09:00:00Z',
      }),
      makeDbRow({ id: 'fu-1', target_id: 'cr-1' }),
      makeDbRow({ id: 'fu-3', target_id: 'cr-2' }),
      makeDbRow({ id: 'fu-9', target_id: 'cr-absent' }),
    ])

    const map = await listFollowUpsForTargets(client, 'contact_request', [
      'cr-1',
      'cr-2',
      'cr-3',
      'cr-1',
    ])

    expect([...map.keys()].sort()).toEqual(['cr-1', 'cr-2'])
    expect(map.get('cr-1')?.map((row) => row.id)).toEqual(['fu-2', 'fu-1'])
    expect(map.get('cr-2')).toHaveLength(1)
    expect(map.has('cr-3')).toBe(false)

    expect(queries).toHaveLength(1)
    expect(queries[0]!.filters).toEqual([
      { op: 'eq', column: 'target_kind', value: 'contact_request' },
      { op: 'in', column: 'target_id', value: ['cr-1', 'cr-2', 'cr-3'] },
    ])
    expect(queries[0]!.order).toEqual({ column: 'sent_at', ascending: false })
  })

  it('does not query the database for an empty id list', async () => {
    const { client, queries } = createClient([makeDbRow()])
    const map = await listFollowUpsForTargets(client, 'reservation', [])
    expect(map.size).toBe(0)
    expect(queries).toHaveLength(0)
  })

  it('chunks long id lists to keep the request URL short', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `cr-${i}`)
    const { client, queries } = createClient([
      makeDbRow({ target_id: 'cr-0' }),
      makeDbRow({ id: 'fu-2', target_id: 'cr-249' }),
    ])

    const map = await listFollowUpsForTargets(client, 'contact_request', ids)

    expect(queries).toHaveLength(3)
    expect(
      queries.map((q) => (q.filters[1]!.value as string[]).length),
    ).toEqual([100, 100, 50])
    expect(map.has('cr-0')).toBe(true)
    expect(map.has('cr-249')).toBe(true)
  })

  it('surfaces the database error', async () => {
    const { client } = createClient([], 'RLS denied')
    await expect(
      listFollowUpsForTargets(client, 'contact_request', ['cr-1']),
    ).rejects.toThrow('RLS denied')
  })
})

describe('listFollowUpsByEmail', () => {
  it('matches the address case-insensitively, newest first, bounded', async () => {
    const { client, queries } = createClient([makeDbRow()])

    const rows = await listFollowUpsByEmail(client, ' Camille@Exemple.test ')

    expect(rows).toHaveLength(1)
    expect(rows[0]!.recipientEmail).toBe('camille@exemple.test')
    expect(queries[0]!.filters).toEqual([
      { op: 'ilike', column: 'recipient_email', value: 'Camille@Exemple.test' },
    ])
    expect(queries[0]!.order).toEqual({ column: 'sent_at', ascending: false })
    expect(queries[0]!.limit).toBe(200)
  })

  it('escapes LIKE wildcards in the address', async () => {
    const { client, queries } = createClient([])
    await listFollowUpsByEmail(client, 'a_b%c@exemple.test')
    expect(queries[0]!.filters[0]!.value).toBe('a\\_b\\%c@exemple.test')
  })

  it('returns nothing for an empty address without querying', async () => {
    const { client, queries } = createClient([makeDbRow()])
    expect(await listFollowUpsByEmail(client, '   ')).toEqual([])
    expect(queries).toHaveLength(0)
  })

  it('surfaces the database error', async () => {
    const { client } = createClient([], 'RLS denied')
    await expect(
      listFollowUpsByEmail(client, 'camille@exemple.test'),
    ).rejects.toThrow('RLS denied')
  })
})
