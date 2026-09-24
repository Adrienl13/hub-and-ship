import { describe, expect, it } from 'vitest'

import {
  ACTIVE_RESERVATION_STATUSES,
  PAID_RESERVATION_STATUSES,
  businessWindowStart,
  lastMonthKeys,
  loadAdminBusiness,
  loadAdminOverview,
  monthKeyOf,
  summarizeBusiness,
  summarizeOverview,
  type AdminBusinessClient,
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

// ============================================================================
// Agrégats business
// ============================================================================

const NOW = new Date('2026-09-24T10:00:00Z')

describe('fenêtre de 12 mois', () => {
  it('commence au premier jour du mois, onze mois avant', () => {
    expect(businessWindowStart(NOW).toISOString()).toBe(
      '2025-10-01T00:00:00.000Z',
    )
    expect(lastMonthKeys(NOW)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ])
  })

  it('passe l’année sans se tromper de mois', () => {
    expect(lastMonthKeys(new Date('2026-01-15T00:00:00Z'), 3)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ])
  })

  it('lit la clé de mois en UTC et refuse une date illisible', () => {
    expect(monthKeyOf('2026-09-30T23:30:00Z')).toBe('2026-09')
    expect(monthKeyOf('2026-10-01T00:00:00+02:00')).toBe('2026-09')
    expect(monthKeyOf(null)).toBeNull()
    expect(monthKeyOf('n/a')).toBeNull()
  })
})

describe('summarizeBusiness', () => {
  it('cumule le CA HT des réservations payées par mois et le panier moyen', () => {
    const kpis = summarizeBusiness(
      {
        reservations: [
          {
            total_ht: '1200.50',
            status: 'reserved',
            reserved_at: '2026-09-02T09:00:00Z',
            created_at: '2026-08-30T09:00:00Z',
          },
          {
            total_ht: 800,
            status: 'delivered',
            reserved_at: null,
            created_at: '2026-08-12T09:00:00Z',
          },
          // Frais de réservation encore en attente : pas encaissée.
          {
            total_ht: 5000,
            status: 'pending_reservation_fee',
            reserved_at: null,
            created_at: '2026-09-10T09:00:00Z',
          },
          // Hors fenêtre : ignorée même si payée.
          {
            total_ht: 999,
            status: 'in_transit',
            reserved_at: '2025-01-10T09:00:00Z',
            created_at: '2025-01-10T09:00:00Z',
          },
        ],
        profiles: [],
        stockRequests: [],
        partnerDeals: [],
        contactRequests: [],
      },
      { now: NOW },
    )

    expect(kpis.revenueHt).toBe(2000.5)
    expect(kpis.paidReservations).toBe(2)
    expect(kpis.averageBasketHt).toBe(1000.25)
    expect(kpis.months).toHaveLength(12)
    expect(kpis.months.at(-1)).toEqual({
      month: '2026-09',
      label: 'sept. 2026',
      revenueHt: 1200.5,
      reservations: 1,
      accounts: 0,
      requests: 0,
    })
    expect(kpis.months.at(-2)).toMatchObject({
      month: '2026-08',
      label: 'août 2026',
      revenueHt: 800,
      reservations: 1,
    })
  })

  it('compte les comptes créés et les demandes reçues par mois', () => {
    const kpis = summarizeBusiness(
      {
        reservations: [],
        profiles: [
          { created_at: '2026-09-01T00:00:00Z' },
          { created_at: '2026-09-15T00:00:00Z' },
          { created_at: '2026-07-15T00:00:00Z' },
          { created_at: '2024-01-01T00:00:00Z' },
        ],
        stockRequests: [{ status: 'new', created_at: '2026-09-03T00:00:00Z' }],
        partnerDeals: [],
        contactRequests: [
          { status: 'new', created_at: '2026-09-04T00:00:00Z' },
          { status: 'won', created_at: '2026-06-04T00:00:00Z' },
        ],
      },
      { now: NOW },
    )

    expect(kpis.accountsCreated).toBe(3)
    const byMonth = Object.fromEntries(
      kpis.months.map((m) => [m.month, m] as const),
    )
    expect(byMonth['2026-09']).toMatchObject({ accounts: 2, requests: 2 })
    expect(byMonth['2026-07']).toMatchObject({ accounts: 1, requests: 0 })
    expect(byMonth['2026-06']).toMatchObject({ accounts: 0, requests: 1 })
  })

  it('calcule les taux de conversion et la répartition des demandes de contact', () => {
    const kpis = summarizeBusiness(
      {
        reservations: [],
        profiles: [],
        stockRequests: [
          { status: 'converted', created_at: '2026-09-03T00:00:00Z' },
          { status: 'new', created_at: '2026-09-03T00:00:00Z' },
          { status: 'closed', created_at: '2026-09-03T00:00:00Z' },
          { status: 'converted', created_at: '2026-09-03T00:00:00Z' },
        ],
        partnerDeals: [
          { status: 'won' },
          { status: 'lost' },
          { status: 'submitted' },
        ],
        contactRequests: [
          { status: 'new', created_at: '2026-09-04T00:00:00Z' },
          { status: 'new', created_at: '2026-09-04T00:00:00Z' },
          { status: 'quoted', created_at: '2026-09-04T00:00:00Z' },
          { status: 'lost', created_at: '2026-09-04T00:00:00Z' },
          // Statut inconnu (ajouté côté base plus tard) : compté au total seulement.
          { status: 'archived', created_at: '2026-09-04T00:00:00Z' },
        ],
      },
      { now: NOW },
    )

    expect(kpis.stockRequestConversion).toEqual({ won: 2, total: 4, rate: 50 })
    expect(kpis.partnerDealConversion.won).toBe(1)
    expect(kpis.partnerDealConversion.total).toBe(3)
    expect(kpis.partnerDealConversion.rate).toBeCloseTo(33.33, 1)
    expect(kpis.contactRequestsByStatus).toEqual({
      new: 2,
      contacted: 0,
      quoted: 1,
      won: 0,
      lost: 1,
    })
    expect(kpis.contactRequestsTotal).toBe(5)
  })

  it('reste à zéro sans aucune donnée, sans division par zéro', () => {
    const kpis = summarizeBusiness(
      {
        reservations: [],
        profiles: [],
        stockRequests: [],
        partnerDeals: [],
        contactRequests: [],
      },
      { now: NOW },
    )
    expect(kpis.averageBasketHt).toBe(0)
    expect(kpis.stockRequestConversion.rate).toBe(0)
    expect(kpis.partnerDealConversion.rate).toBe(0)
    expect(kpis.months.every((m) => m.revenueHt === 0)).toBe(true)
  })
})

describe('loadAdminBusiness', () => {
  interface BusinessLog {
    table: string
    columns: string
    filters: string[]
    range: [number, number]
  }

  function createBusinessClient(
    pages: Record<
      string,
      ReadonlyArray<ReadonlyArray<Record<string, unknown>>>
    >,
    errorTable?: string,
  ): { client: AdminBusinessClient; log: BusinessLog[] } {
    const log: BusinessLog[] = []
    const client: AdminBusinessClient = {
      from: (table) => ({
        select: (columns) => {
          const filters: string[] = []
          const query = {
            in: (column: string, values: ReadonlyArray<string>) => {
              filters.push(`in ${column} [${values.join(',')}]`)
              return query
            },
            gte: (column: string, value: string) => {
              filters.push(`gte ${column} ${value}`)
              return query
            },
            order: (column: string, options: { ascending: boolean }) => {
              filters.push(
                `order ${column} ${options.ascending ? 'asc' : 'desc'}`,
              )
              return query
            },
            range: (from: number, to: number) => {
              log.push({ table, columns, filters, range: [from, to] })
              return query
            },
            then: <R>(
              resolve: (value: {
                data: ReadonlyArray<Record<string, unknown>> | null
                error: { message: string } | null
              }) => R,
            ) => {
              const last = log.at(-1)
              const index = last ? Math.floor(last.range[0] / 1000) : 0
              return Promise.resolve(
                errorTable === table
                  ? { data: null, error: { message: 'RLS denied' } }
                  : { data: pages[table]?.[index] ?? [], error: null },
              ).then(resolve)
            },
          }
          return query as unknown as ReturnType<
            ReturnType<AdminBusinessClient['from']>['select']
          >
        },
      }),
    }
    return { client, log }
  }

  it('lit les cinq tables avec les bons filtres, page par page', async () => {
    const firstPage = Array.from({ length: 1000 }, () => ({
      created_at: '2026-09-01T00:00:00Z',
    }))
    const { client, log } = createBusinessClient({
      reservations: [
        [
          {
            total_ht: 100,
            status: 'reserved',
            reserved_at: '2026-09-01T00:00:00Z',
            created_at: '2026-09-01T00:00:00Z',
          },
        ],
      ],
      users_profile: [firstPage, [{ created_at: '2026-09-02T00:00:00Z' }]],
      stock_requests: [[{ status: 'converted', created_at: '2026-09-01' }]],
      partner_deals: [[{ status: 'won' }]],
      contact_requests: [[{ status: 'new', created_at: '2026-09-01' }]],
    })

    const kpis = await loadAdminBusiness(client, { now: NOW })

    expect(kpis.revenueHt).toBe(100)
    expect(kpis.accountsCreated).toBe(1001)
    expect(kpis.stockRequestConversion).toEqual({ won: 1, total: 1, rate: 100 })
    expect(kpis.partnerDealConversion.rate).toBe(100)
    expect(kpis.contactRequestsByStatus.new).toBe(1)

    const reservations = log.find((q) => q.table === 'reservations')
    expect(reservations?.columns).toBe('total_ht,status,reserved_at,created_at')
    expect(reservations?.filters).toEqual([
      `in status [${PAID_RESERVATION_STATUSES.join(',')}]`,
      'gte created_at 2025-10-01T00:00:00.000Z',
      'order created_at asc',
      'order id asc',
    ])
    expect(log.find((q) => q.table === 'users_profile')?.filters).toEqual([
      'gte created_at 2025-10-01T00:00:00.000Z',
      'order created_at asc',
      'order id asc',
    ])
    expect(log.filter((q) => q.table === 'users_profile')).toHaveLength(2)
    // Chaque table paginée est triée de façon stable (date puis id).
    for (const query of log) {
      expect(query.filters.slice(-2)).toEqual([
        'order created_at asc',
        'order id asc',
      ])
    }
    expect(log.find((q) => q.table === 'contact_requests')?.columns).toBe(
      'status,created_at',
    )
  })

  it('remonte une erreur nommant la table', async () => {
    const { client } = createBusinessClient({}, 'contact_requests')
    await expect(loadAdminBusiness(client)).rejects.toThrow(
      /contact_requests: RLS denied/,
    )
  })
})
