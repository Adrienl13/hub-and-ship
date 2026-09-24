import { describe, expect, it, vi } from 'vitest'

import {
  describeReservationOrigin,
  deliveryModeLabel,
  listAllReservations,
  listReservationItems,
  reservationPeriodSince,
  toAdminReservationRow,
  type AdminReservationsClient,
} from './admin-reservations.repository'

interface CapturedQuery {
  table: string
  filters: Array<{ op: string; column: string; value: unknown }>
  limit: number | null
}

function createListClient(
  rows: ReadonlyArray<Record<string, unknown>>,
  error: { message: string } | null = null,
): { client: AdminReservationsClient; queries: CapturedQuery[] } {
  const queries: CapturedQuery[] = []
  const from = vi.fn((table: string) => {
    const captured: CapturedQuery = { table, filters: [], limit: null }
    queries.push(captured)
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: (value: number) => {
        captured.limit = value
        return builder
      },
      gte: (column: string, value: unknown) => {
        captured.filters.push({ op: 'gte', column, value })
        return builder
      },
      eq: (column: string, value: unknown) => {
        captured.filters.push({ op: 'eq', column, value })
        return builder
      },
      then: (resolve: (result: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: error ? null : rows, error }).then(resolve),
    }
    return builder
  })
  return { client: { from } as unknown as AdminReservationsClient, queries }
}

// Ligne brute complète, sans donnée client réelle.
const BASE_ROW = {
  id: 'res-1',
  reference: 'TR-2026-0001',
  container_reference: 'CC-2026-001',
  container_id: null,
  user_id: null,
  company_id: null,
  siret: '00000000000000',
  contact_snapshot: {
    name: 'Contact Test',
    company: 'Établissement Test',
    email: 'test@example.com',
    phone: '+33 6 00 00 00 00',
    partner_context: { slug: 'chr-conseil', display_name: 'CHR Conseil' },
  },
  delivery_mode: 'door_delivery',
  delivery_note: 'Livraison le matin uniquement',
  delivery_fee: 0,
  subtotal_ht: 1000,
  eco_contribution_total: 0,
  referral_code: 'PARRAIN-1',
  referral_discount: 0,
  volume_discount: 0,
  total_ht: '1000.00',
  vat_rate: 20,
  vat_amount: 200,
  total_ttc: '1200.00',
  total_cbm: '2.50',
  reservation_fee: 150,
  pay_now: 150,
  deposit_amount: 300,
  pay_at_80_percent: 300,
  balance_amount: 550,
  status: 'reserved',
  cgv_version_accepted: '2026-05-18',
  cgv_accepted_at: '2026-09-01T10:00:00.000Z',
  reserved_at: '2026-09-01T10:05:00.000Z',
  cancelled_at: null,
  cancellation_reason: null,
  admin_notes: null,
  stripe_payment_intent_id: 'pi_test',
  stripe_customer_id: null,
  stripe_checkout_session_id: null,
  paid_reservation_fee_at: '2026-09-01T10:05:00.000Z',
  partner_deal_id: null,
  partner_application_id: null,
  partner_attribution_reason: null,
  partner_attribution_snapshot: null,
  payment_reminder_count: 2,
  payment_reminder_last_at: '2026-09-10T08:00:00.000Z',
  created_at: '2026-09-01T09:59:00.000Z',
  updated_at: '2026-09-10T08:00:00.000Z',
  requested_container_type: null,
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'terrasse-2026',
  partner_ref: 'REF-42',
}

describe('toAdminReservationRow', () => {
  it('maps the collected-but-invisible columns', () => {
    const row = toAdminReservationRow(BASE_ROW as never)

    expect(row.contactPhone).toBe('+33 6 00 00 00 00')
    expect(row.deliveryMode).toBe('door_delivery')
    expect(row.deliveryNote).toBe('Livraison le matin uniquement')
    expect(row.referralCode).toBe('PARRAIN-1')
    expect(row.utmSource).toBe('google')
    expect(row.utmMedium).toBe('cpc')
    expect(row.utmCampaign).toBe('terrasse-2026')
    expect(row.partnerRef).toBe('REF-42')
    expect(row.totalTtc).toBe(1200)
    expect(row.totalHt).toBe(1000)
    expect(row.paymentReminderCount).toBe(2)
    expect(row.paymentReminderLastAt).toBe('2026-09-10T08:00:00.000Z')
    expect(row.partnerLinkSlug).toBe('chr-conseil')
  })

  it('normalizes empty strings and missing numerics', () => {
    const row = toAdminReservationRow({
      ...BASE_ROW,
      delivery_note: '   ',
      referral_code: '',
      utm_source: null,
      partner_ref: undefined,
      total_ttc: null,
      payment_reminder_count: undefined,
    } as never)

    expect(row.deliveryNote).toBeNull()
    expect(row.referralCode).toBeNull()
    expect(row.utmSource).toBeNull()
    expect(row.partnerRef).toBeNull()
    expect(row.totalTtc).toBe(0)
    expect(row.paymentReminderCount).toBe(0)
  })
})

describe('describeReservationOrigin', () => {
  it('combines partner ref and UTM, falling back to Direct', () => {
    expect(
      describeReservationOrigin({
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: null,
        partnerRef: 'REF-42',
      }),
    ).toBe('Partenaire REF-42 · google / cpc')
    expect(
      describeReservationOrigin({
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        partnerRef: null,
      }),
    ).toBe('Direct')
  })
})

describe('deliveryModeLabel', () => {
  it('translates known modes and keeps a dash for null', () => {
    expect(deliveryModeLabel('pickup_at_port')).toBe(
      'Enlèvement en zone de stockage',
    )
    expect(deliveryModeLabel(null)).toBe('—')
  })
})

describe('reservationPeriodSince', () => {
  it('returns null for "all" and an ISO lower bound otherwise', () => {
    const now = new Date('2026-09-24T12:00:00.000Z')
    expect(reservationPeriodSince(null, now)).toBeNull()
    expect(reservationPeriodSince(30, now)).toBe('2026-08-25T12:00:00.000Z')
  })
})

describe('listAllReservations', () => {
  it('applies the 500 limit and no date filter by default', async () => {
    const { client, queries } = createListClient([BASE_ROW])

    const rows = await listAllReservations(client)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.reference).toBe('TR-2026-0001')
    expect(queries[0]).toMatchObject({ table: 'reservations', limit: 500 })
    expect(queries[0]?.filters).toHaveLength(0)
  })

  it('filters on created_at when a period is requested', async () => {
    const { client, queries } = createListClient([])
    const now = new Date('2026-09-24T12:00:00.000Z')

    await listAllReservations(client, { periodDays: 90, now })

    expect(queries[0]?.filters).toEqual([
      { op: 'gte', column: 'created_at', value: '2026-06-26T12:00:00.000Z' },
    ])
  })

  it('propagates Supabase errors', async () => {
    const { client } = createListClient([], { message: 'RLS denied' })
    await expect(listAllReservations(client)).rejects.toThrow('RLS denied')
  })
})

describe('listReservationItems', () => {
  it('loads the items of one reservation and maps amounts to numbers', async () => {
    const { client, queries } = createListClient([
      {
        id: 'item-1',
        reservation_id: 'res-1',
        product_id: 'p1',
        sku: 'CH-001',
        product_name: 'Chaise bistrot',
        category: 'chair',
        variant_id: 'v1',
        variant_name: 'Vert forêt',
        quantity: 40,
        unit_price_ht: '25.00',
        unit_eco_contribution: 0,
        subtotal_ht: '1000.00',
        eco_contribution_total: '4.00',
        cbm_total: '2.5',
        product_snapshot: {},
        created_at: '2026-09-01T09:59:00.000Z',
      },
    ])

    const items = await listReservationItems(client, 'res-1')

    expect(queries[0]).toMatchObject({ table: 'reservation_items' })
    expect(queries[0]?.filters).toEqual([
      { op: 'eq', column: 'reservation_id', value: 'res-1' },
    ])
    expect(items).toEqual([
      {
        id: 'item-1',
        sku: 'CH-001',
        productName: 'Chaise bistrot',
        category: 'chair',
        variantName: 'Vert forêt',
        quantity: 40,
        unitPriceHt: 25,
        subtotalHt: 1000,
        ecoContributionTotal: 4,
        cbmTotal: 2.5,
      },
    ])
  })
})
