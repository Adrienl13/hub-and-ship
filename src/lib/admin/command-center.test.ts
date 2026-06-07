import { describe, expect, it } from 'vitest'

import {
  loadCommandCenterCounts,
  totalUrgencies,
  type CommandCenterClient,
} from './command-center'

interface QueryLog {
  table: string
  op: 'eq' | 'in'
  column: string
  value: string | ReadonlyArray<string>
}

function createClient(
  counts: Record<string, number>,
  errorTable?: string,
): { client: CommandCenterClient; log: QueryLog[] } {
  const log: QueryLog[] = []
  const result = (table: string) =>
    errorTable === table
      ? { count: null, error: { message: 'RLS denied' } }
      : { count: counts[table] ?? 0, error: null }

  const client: CommandCenterClient = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          log.push({ table, op: 'eq', column, value })
          return Promise.resolve(result(table))
        },
        in: (column: string, value: ReadonlyArray<string>) => {
          log.push({ table, op: 'in', column, value })
          return Promise.resolve(result(table))
        },
      }),
    }),
  }

  return { client, log }
}

describe('command center counts', () => {
  it('aggregates the day urgencies from each table', async () => {
    const { client, log } = createClient({
      stock_requests: 3,
      partner_applications: 2,
      partner_deals: 1,
      reservations: 4,
    })

    const counts = await loadCommandCenterCounts(client)

    expect(counts).toEqual({
      newStockRequests: 3,
      partnerApplicationsToReview: 2,
      partnerDealsToQualify: 1,
      reservationsPendingPayment: 4,
    })
    expect(totalUrgencies(counts)).toBe(10)

    // Applications are filtered with an IN over new/reviewing.
    const appQuery = log.find((q) => q.table === 'partner_applications')
    expect(appQuery).toMatchObject({ op: 'in', column: 'status' })
    expect(appQuery?.value).toEqual(['new', 'reviewing'])
  })

  it('treats a null count as zero', async () => {
    const { client } = createClient({})
    const counts = await loadCommandCenterCounts(client)
    expect(totalUrgencies(counts)).toBe(0)
  })

  it('throws a labelled error when a query fails', async () => {
    const { client } = createClient({}, 'reservations')
    await expect(loadCommandCenterCounts(client)).rejects.toThrow(
      /reservations: RLS denied/,
    )
  })
})
