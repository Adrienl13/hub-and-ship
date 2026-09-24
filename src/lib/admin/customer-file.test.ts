import { describe, expect, it, vi } from 'vitest'

import {
  assembleCustomerTimeline,
  buildCustomerFile,
  customerTabHref,
  dedupeReservations,
  emailPattern,
  loadCustomerFile,
  summarizeCustomer,
  type CustomerFileClient,
  type CustomerFileData,
} from './customer-file'

const profile = {
  createdAt: '2026-03-01T10:00:00.000Z',
  lastLoginAt: '2026-09-20T08:30:00.000Z',
}

const empty: CustomerFileData = {
  contactRequests: [],
  reservations: [],
  stockRequests: [],
  partnerApplications: [],
  followUps: [],
}

const data: CustomerFileData = {
  contactRequests: [
    {
      id: 'cr-1',
      status: 'new',
      topic: 'devis',
      created_at: '2026-09-22T09:00:00.000Z',
    },
    {
      id: 'cr-2',
      status: 'won',
      topic: 'produit',
      created_at: '2026-04-02T09:00:00.000Z',
    },
    {
      id: 'cr-3',
      status: 'quoted',
      topic: 'autre',
      created_at: '2026-05-02T09:00:00.000Z',
    },
  ],
  reservations: [
    // Trouvée par user_id ET par email : une seule occurrence attendue.
    {
      id: 'r-1',
      reference: 'RES-001',
      status: 'deposit_paid',
      total_ht: '12500.50',
      total_ttc: '15000.60',
      created_at: '2026-06-10T12:00:00.000Z',
      container_id: 'c-1',
    },
    {
      id: 'r-1',
      reference: 'RES-001',
      status: 'deposit_paid',
      total_ht: '12500.50',
      total_ttc: '15000.60',
      created_at: '2026-06-10T12:00:00.000Z',
      container_id: 'c-1',
    },
    // Frais non payés : hors CA.
    {
      id: 'r-2',
      reference: 'RES-002',
      status: 'pending_reservation_fee',
      total_ht: 4000,
      total_ttc: 4800,
      created_at: '2026-09-01T12:00:00.000Z',
      container_id: null,
    },
    // Livrée : comptée dans le CA.
    {
      id: 'r-3',
      reference: 'RES-003',
      status: 'delivered',
      total_ht: 1000,
      total_ttc: 1200,
      created_at: '2025-11-05T12:00:00.000Z',
      container_id: 'c-0',
    },
  ],
  stockRequests: [
    {
      id: 's-1',
      status: 'contacted',
      product_name: 'Fauteuil CASSIS',
      requested_quantity: 12,
      created_at: '2026-07-15T12:00:00.000Z',
    },
  ],
  partnerApplications: [
    {
      id: 'p-1',
      status: 'reviewing',
      company_name: 'Agence Terrasse',
      created_at: '2026-02-01T12:00:00.000Z',
    },
  ],
  followUps: [
    {
      id: 'f-1',
      target_kind: 'contact_request',
      target_id: 'cr-1',
      subject: 'Votre devis Terrassea',
      template: 'devis',
      sent_at: '2026-09-23T14:00:00.000Z',
    },
  ],
}

describe('assembleCustomerTimeline', () => {
  it('sorts every event from newest to oldest with a label and a tab link', () => {
    const timeline = assembleCustomerTimeline(data, profile)

    expect(timeline.map((e) => e.kind)).toEqual([
      'follow_up',
      'contact_request',
      'last_login',
      'reservation',
      'stock_request',
      'reservation',
      'contact_request',
      'contact_request',
      'signup',
      'partner_application',
      'reservation',
    ])
    const dates = timeline.map((e) => new Date(e.at).getTime())
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)

    expect(timeline[0]).toEqual({
      key: 'follow_up:f-1',
      kind: 'follow_up',
      at: '2026-09-23T14:00:00.000Z',
      label: 'Votre devis Terrassea',
      detail: 'Modèle devis · sur demande',
      tab: 'demandes',
    })
    expect(timeline[1]).toMatchObject({
      label: 'Demande de devis',
      detail: 'Nouvelle',
      tab: 'demandes',
    })
    expect(timeline[3]).toMatchObject({
      label: 'Réservation RES-002',
      tab: 'reservations',
    })
    // Intl insère des espaces insécables (fines ou non) : on ne fige pas le
    // caractère exact.
    expect(timeline[3]?.detail).toMatch(/^Frais réservation · 4\s000\s€ HT$/)
    expect(timeline[4]).toMatchObject({
      label: 'Fauteuil CASSIS × 12',
      detail: 'Contacte',
      tab: 'stock-requests',
    })
    expect(timeline[9]).toMatchObject({
      label: 'Agence Terrasse',
      detail: 'En analyse',
      tab: 'partners',
    })
    // Inscription et connexion n'ont pas d'onglet cible.
    expect(timeline[2]).toMatchObject({ kind: 'last_login', tab: null })
    expect(timeline[8]).toMatchObject({
      kind: 'signup',
      at: profile.createdAt,
      tab: null,
    })
  })

  it('keeps a reservation found by user_id and by email only once', () => {
    const timeline = assembleCustomerTimeline(data, profile)
    const reservations = timeline.filter((e) => e.kind === 'reservation')
    expect(reservations.map((e) => e.key)).toEqual([
      'reservation:r-2',
      'reservation:r-1',
      'reservation:r-3',
    ])
    expect(dedupeReservations(data.reservations)).toHaveLength(3)
  })

  it('falls back to the raw status and keeps an unknown follow-up target without tab', () => {
    const timeline = assembleCustomerTimeline(
      {
        ...empty,
        contactRequests: [
          {
            id: 'cr-x',
            status: 'mystery',
            topic: 'devis',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        followUps: [
          {
            id: 'f-x',
            target_kind: 'unknown_kind',
            target_id: 'x',
            subject: 'Relance',
            template: 'libre',
            sent_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      },
      { createdAt: '2025-12-31T00:00:00.000Z', lastLoginAt: null },
    )
    expect(timeline.map((e) => e.kind)).toEqual([
      'follow_up',
      'contact_request',
      'signup',
    ])
    expect(timeline[0]).toMatchObject({ detail: 'Modèle libre', tab: null })
    expect(timeline[1]).toMatchObject({ detail: 'mystery' })
  })

  it('sinks unreadable dates to the bottom instead of throwing', () => {
    const timeline = assembleCustomerTimeline(
      {
        ...empty,
        contactRequests: [
          { id: 'bad', status: 'new', topic: 'devis', created_at: 'n/a' },
        ],
      },
      profile,
    )
    expect(timeline.at(-1)?.key).toBe('contact_request:bad')
  })
})

describe('summarizeCustomer', () => {
  it('counts open requests, unique reservations, paid revenue and last interaction', () => {
    const { timeline, summary } = buildCustomerFile(data, profile)
    expect(summary).toEqual({
      openContactRequests: 2,
      reservations: 3,
      paidRevenueHt: 13500.5,
      lastInteractionAt: '2026-09-23T14:00:00.000Z',
    })
    expect(summary.lastInteractionAt).toBe(timeline[0]?.at)
  })

  it('does not count the account creation as an interaction of a fresh account', () => {
    const timeline = assembleCustomerTimeline(empty, {
      createdAt: '2026-09-24T07:00:00.000Z',
      lastLoginAt: null,
    })
    // L'inscription reste dans la chronologie, mais « dernière interaction »
    // ne parle que des échanges métier.
    expect(timeline.map((event) => event.kind)).toEqual(['signup'])
    expect(summarizeCustomer(empty, timeline)).toEqual({
      openContactRequests: 0,
      reservations: 0,
      paidRevenueHt: 0,
      lastInteractionAt: null,
    })
  })
})

describe('helpers', () => {
  it('escapes ilike wildcards in the email and builds tab links', () => {
    expect(emailPattern('  Jean_Dupont%@exemple.test ')).toBe(
      'Jean\\_Dupont\\%@exemple.test',
    )
    expect(customerTabHref('demandes')).toBe('/admin?tab=demandes')
  })
})

describe('loadCustomerFile', () => {
  function fakeClient(tables: Record<string, ReadonlyArray<unknown>>) {
    const calls: Array<{
      table: string
      columns: string
      filter: [string, string, string]
    }> = []
    const client: CustomerFileClient = {
      from: (table) => ({
        select: (columns) => {
          const call = {
            table,
            columns,
            filter: ['', '', ''] as [string, string, string],
          }
          calls.push(call)
          const query = {
            eq: vi.fn((column: string, value: string) => {
              call.filter = ['eq', column, value]
              return query
            }),
            ilike: vi.fn((column: string, pattern: string) => {
              call.filter = ['ilike', column, pattern]
              return query
            }),
            order: vi.fn(() => query),
            limit: vi.fn(() => query),
            then: (
              resolve: (value: {
                data: ReadonlyArray<unknown>
                error: null
              }) => unknown,
            ) =>
              Promise.resolve(
                resolve({ data: tables[table] ?? [], error: null }),
              ),
          }
          return query as unknown as ReturnType<
            ReturnType<CustomerFileClient['from']>['select']
          >
        },
      }),
    }
    return { client, calls }
  }

  it('queries each table by lowercase-insensitive email or user id and merges reservations', async () => {
    const reservation = data.reservations[0]
    const { client, calls } = fakeClient({
      contact_requests: data.contactRequests,
      reservations: [reservation],
      stock_requests: data.stockRequests,
      partner_applications: data.partnerApplications,
      admin_follow_ups: data.followUps,
    })

    const result = await loadCustomerFile(client, {
      userId: 'u-1',
      email: 'Client@Exemple.test',
    })

    expect(calls.map((c) => [c.table, ...c.filter])).toEqual([
      ['contact_requests', 'ilike', 'email', 'Client@Exemple.test'],
      ['reservations', 'eq', 'user_id', 'u-1'],
      [
        'reservations',
        'ilike',
        'contact_snapshot->>email',
        'Client@Exemple.test',
      ],
      ['stock_requests', 'ilike', 'contact_email', 'Client@Exemple.test'],
      ['partner_applications', 'ilike', 'contact_email', 'Client@Exemple.test'],
      ['admin_follow_ups', 'ilike', 'recipient_email', 'Client@Exemple.test'],
    ])
    expect(calls[5]?.columns).toBe(
      'id,target_kind,target_id,subject,template,sent_at',
    )
    // La même réservation revient par le compte et par l'email : une seule.
    expect(result.reservations).toEqual([reservation])
    expect(result.followUps).toEqual(data.followUps)
  })

  it('surfaces a database error with the table name', async () => {
    const client: CustomerFileClient = {
      from: (table) => ({
        select: () => {
          const query = {
            eq: () => query,
            ilike: () => query,
            order: () => query,
            limit: () => query,
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(
                resolve(
                  table === 'stock_requests'
                    ? { data: null, error: { message: 'RLS' } }
                    : { data: [], error: null },
                ),
              ),
          }
          return query as unknown as ReturnType<
            ReturnType<CustomerFileClient['from']>['select']
          >
        },
      }),
    }
    await expect(
      loadCustomerFile(client, { userId: 'u-1', email: 'a@b.test' }),
    ).rejects.toThrow('Demandes stock 24h : RLS')
  })
})
