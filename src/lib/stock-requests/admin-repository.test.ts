import { describe, expect, it, vi } from 'vitest'

import {
  describeStockRequestOrigin,
  listAllStockRequests,
  toStockRequestAdminRow,
  type StockRequestAdminClient,
} from './admin-repository'

// Ligne brute complète, sans donnée client réelle.
const BASE_ROW = {
  id: 'sr-1',
  status: 'new',
  stock_line_id: 'line-1',
  product_id: 'p1',
  sku: 'CH-001',
  product_name: 'Chaise bistrot',
  variant_id: 'v1',
  variant_name: 'Vert forêt',
  requested_quantity: 12,
  available_units_snapshot: 40,
  unit_price_ht: 25,
  estimated_total_ht: '300.00',
  company_name: 'Établissement Test',
  contact_email: 'test@example.com',
  contact_phone: '+33 6 00 00 00 00',
  location: 'Entrepôt Lyon',
  customer_note: null,
  internal_note: null,
  product_snapshot: {},
  source: 'stock_24h_page',
  utm_source: 'newsletter',
  utm_medium: 'email',
  utm_campaign: 'septembre',
  partner_ref: null,
  created_at: '2026-09-20T09:00:00.000Z',
  updated_at: '2026-09-20T09:00:00.000Z',
}

describe('toStockRequestAdminRow', () => {
  it('maps source, UTM and partner ref', () => {
    const row = toStockRequestAdminRow(BASE_ROW as never)

    expect(row.source).toBe('stock_24h_page')
    expect(row.utmSource).toBe('newsletter')
    expect(row.utmMedium).toBe('email')
    expect(row.utmCampaign).toBe('septembre')
    expect(row.partnerRef).toBeNull()
    expect(row.location).toBe('Entrepôt Lyon')
    expect(row.estimatedTotalHt).toBe(300)
  })

  it('tolerates legacy rows without the marketing columns', () => {
    const row = toStockRequestAdminRow({
      ...BASE_ROW,
      source: undefined,
      utm_source: '',
      utm_medium: undefined,
      utm_campaign: null,
      partner_ref: '  ',
    } as never)

    expect(row.source).toBe('')
    expect(row.utmSource).toBeNull()
    expect(row.utmMedium).toBeNull()
    expect(row.utmCampaign).toBeNull()
    expect(row.partnerRef).toBeNull()
  })
})

describe('describeStockRequestOrigin', () => {
  it('prefers partner ref, then UTM, then the readable capture source', () => {
    expect(
      describeStockRequestOrigin({
        source: 'stock_24h_page',
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: null,
        partnerRef: 'REF-42',
      }),
    ).toBe('Partenaire REF-42 · newsletter / email')
    expect(
      describeStockRequestOrigin({
        source: 'stock_24h_page',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        partnerRef: null,
      }),
    ).toBe('Page stock 24h')
    // Source inconnue du lexique : valeur brute plutôt qu'un silence.
    expect(
      describeStockRequestOrigin({
        source: 'landing_x',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        partnerRef: null,
      }),
    ).toBe('landing_x')
    expect(
      describeStockRequestOrigin({
        source: '',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        partnerRef: null,
      }),
    ).toBe('Direct')
  })
})

describe('listAllStockRequests', () => {
  it('maps every row and propagates errors', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        order: () => Promise.resolve({ data: [BASE_ROW], error: null }),
      }),
    }))
    const client = { from } as unknown as StockRequestAdminClient

    const rows = await listAllStockRequests(client)

    expect(from).toHaveBeenCalledWith('stock_requests')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.utmCampaign).toBe('septembre')

    const failing = {
      from: () => ({
        select: () => ({
          order: () =>
            Promise.resolve({ data: null, error: { message: 'RLS denied' } }),
        }),
      }),
    } as unknown as StockRequestAdminClient
    await expect(listAllStockRequests(failing)).rejects.toThrow('RLS denied')
  })
})
