import { describe, expect, it } from 'vitest'

import {
  ACTIVE_RESERVATION_STATUSES,
  loadAdminOverview,
  summarizeOverview,
  type AdminOverviewClient,
} from './overview'

interface QueryLog {
  table: string
  columns: string
  op: 'eq' | 'in'
  column: string
  value: unknown
}

function createClient(
  data: Record<string, ReadonlyArray<Record<string, unknown>>>,
  counts: Record<string, number> = {},
  errorTable?: string,
): { client: AdminOverviewClient; log: QueryLog[] } {
  const log: QueryLog[] = []
  const result = (table: string) =>
    errorTable === table
      ? { data: null, count: null, error: { message: 'RLS denied' } }
      : { data: data[table] ?? [], count: counts[table] ?? 0, error: null }

  const client: AdminOverviewClient = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string | boolean) => {
          log.push({ table, columns, op: 'eq', column, value })
          return Promise.resolve(result(table))
        },
        in: (column: string, value: ReadonlyArray<string>) => {
          log.push({ table, columns, op: 'in', column, value })
          return Promise.resolve(result(table))
        },
      }),
    }),
  }

  return { client, log }
}

describe('admin overview KPIs', () => {
  it('aggregates live reservations, open container, stock and catalogue', async () => {
    const { client, log } = createClient(
      {
        reservations: [
          { total_ht: '1200.50', total_cbm: '3.2' },
          { total_ht: 800, total_cbm: 2.8 },
        ],
        containers: [
          {
            reference: 'CC-2026-002',
            capacity_cbm: '28',
            expected_close_at: '2026-10-15',
          },
        ],
        stock_lines: [{ available_units: 60 }, { available_units: 22 }],
      },
      { stock_requests: 3, products: 112 },
    )

    const kpis = await loadAdminOverview(client)

    expect(kpis).toEqual({
      activeReservations: 2,
      committedHt: 2000.5,
      reservedCbm: 6,
      openContainer: {
        reference: 'CC-2026-002',
        capacityCbm: 28,
        expectedCloseAt: '2026-10-15',
        fillPercent: (6 / 28) * 100,
      },
      newStockRequests: 3,
      stockAvailableUnits: 82,
      activeProductReferences: 112,
    })

    const reservationQuery = log.find((q) => q.table === 'reservations')
    expect(reservationQuery).toMatchObject({ op: 'in', column: 'status' })
    expect(reservationQuery?.value).toEqual(ACTIVE_RESERVATION_STATUSES)
    expect(log.find((q) => q.table === 'containers')).toMatchObject({
      op: 'eq',
      column: 'status',
      value: 'open',
    })
    expect(log.find((q) => q.table === 'products')).toMatchObject({
      op: 'eq',
      column: 'is_active',
      value: true,
    })
  })

  it('reports no open container instead of inventing a capacity', () => {
    const kpis = summarizeOverview({
      reservations: [{ total_ht: 500, total_cbm: 1 }],
      openContainers: [],
      stockLines: [],
      newStockRequests: 0,
      activeProductReferences: 0,
    })

    expect(kpis.openContainer).toBeNull()
    expect(kpis.reservedCbm).toBe(1)
    expect(kpis.stockAvailableUnits).toBe(0)
  })

  it('caps the fill percentage at 100', () => {
    const kpis = summarizeOverview({
      reservations: [{ total_ht: 0, total_cbm: 40 }],
      openContainers: [
        { reference: 'CC-X', capacity_cbm: 28, expected_close_at: null },
      ],
      stockLines: [],
      newStockRequests: 0,
      activeProductReferences: 0,
    })

    expect(kpis.openContainer?.fillPercent).toBe(100)
  })

  it('throws a labelled error when a query fails', async () => {
    const { client } = createClient({}, {}, 'containers')
    await expect(loadAdminOverview(client)).rejects.toThrow(
      /containers: RLS denied/,
    )
  })
})
