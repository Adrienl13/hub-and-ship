import { describe, expect, it } from 'vitest'

import {
  computeStats,
  getDeliveredContainerBySlug,
  listPublishedDeliveredContainers,
  type DeliveredContainersClient,
} from './repository'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'id-1',
    reference: 'CC-2025-014',
    port: 'Marseille-Fos',
    capacity_cbm: 28,
    threshold_percent: 80,
    min_series_required: 3,
    expected_close_at: null,
    status: 'delivered',
    delivered_at: '2025-12-12',
    planned_days: 75,
    actual_days: 78,
    photo_url: 'https://example.com/photo.jpg',
    testimonial_quote: 'Qualité au rendez-vous',
    testimonial_author: 'Hôtel Le Lavandou',
    testimonial_location: 'Var',
    testimonial_rating: 5,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    display_series_target: 5,
    display_pros_count: 12,
    display_items_count: 287,
    slug: 'cc-2025-014',
    origin_port: 'Ningbo',
    total_items: 287,
    professionals_served: 8,
    savings_total_eur: '14820.00',
    savings_percent: 36,
    story: 'Story here',
    certifications: ['SGS'],
    timeline: [
      {
        date: '2025-09-22',
        label: 'Clôture',
        description: 'Container plein.',
        status: 'done',
      },
    ],
    product_breakdown: [
      { category: 'chair', units: 180, modelLabel: 'Chaises' },
    ],
    gallery: [{ url: 'https://example.com/g.jpg', caption: 'Inspection' }],
    testimonial_long_quote: 'Long quote',
    testimonial_role: 'Directeur',
    published_at: '2026-05-22T08:04:50.446Z',
    ...overrides,
  }
}

type FakeResult<T> = { data: T | null; error: { message: string } | null }

function makeListClient<T>(result: FakeResult<T>): DeliveredContainersClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  }
  return {
    from: () => chain,
  } as unknown as DeliveredContainersClient
}

describe('listPublishedDeliveredContainers', () => {
  it('returns mapped list items from supabase data', async () => {
    const rows = [makeRow()]
    const client = makeListClient({ data: rows, error: null })

    const list = await listPublishedDeliveredContainers(client)
    expect(list).toHaveLength(1)
    expect(list[0]?.slug).toBe('cc-2025-014')
    expect(list[0]?.savingsTotalEur).toBe(14820)
  })

  it('throws when supabase returns an error', async () => {
    const client = makeListClient({
      data: null,
      error: { message: 'boom' },
    })

    await expect(listPublishedDeliveredContainers(client)).rejects.toThrow(
      'boom',
    )
  })
})

describe('getDeliveredContainerBySlug', () => {
  it('returns null when slug not found', async () => {
    const client = makeListClient({ data: null, error: null })
    const result = await getDeliveredContainerBySlug(client, 'unknown')
    expect(result).toBeNull()
  })

  it('returns null when row is not delivered or not published', async () => {
    const client = makeListClient({
      data: makeRow({ published_at: null }),
      error: null,
    })
    expect(await getDeliveredContainerBySlug(client, 'cc-2025-014')).toBeNull()
  })

  it('maps a full delivered container with timeline and gallery', async () => {
    const client = makeListClient({ data: makeRow(), error: null })
    const container = await getDeliveredContainerBySlug(client, 'cc-2025-014')
    expect(container).not.toBeNull()
    expect(container?.timeline).toHaveLength(1)
    expect(container?.gallery[0]?.caption).toBe('Inspection')
    expect(container?.testimonial.longQuote).toBe('Long quote')
  })
})

describe('computeStats', () => {
  it('returns zeros on empty input', () => {
    expect(computeStats([])).toEqual({
      totalContainers: 0,
      totalPros: 0,
      totalArticles: 0,
      totalSavings: 0,
      onTimeRate: 0,
      avgSavingsPercent: 0,
    })
  })

  it('aggregates pros, articles, savings and on-time rate', () => {
    const stats = computeStats([
      {
        id: '1',
        reference: 'CC-1',
        slug: 'cc-1',
        port: 'p',
        deliveredAt: null,
        professionalsServed: 10,
        totalItems: 100,
        plannedDays: 75,
        actualDays: 70,
        photoUrl: null,
        savingsTotalEur: 10000,
        savingsPercent: 30,
        testimonial: {
          quote: null,
          author: null,
          location: null,
          rating: null,
        },
      },
      {
        id: '2',
        reference: 'CC-2',
        slug: 'cc-2',
        port: 'p',
        deliveredAt: null,
        professionalsServed: 5,
        totalItems: 50,
        plannedDays: 75,
        actualDays: 80,
        photoUrl: null,
        savingsTotalEur: 5000,
        savingsPercent: 40,
        testimonial: {
          quote: null,
          author: null,
          location: null,
          rating: null,
        },
      },
    ])

    expect(stats.totalContainers).toBe(2)
    expect(stats.totalPros).toBe(15)
    expect(stats.totalArticles).toBe(150)
    expect(stats.totalSavings).toBe(15000)
    expect(stats.onTimeRate).toBe(50)
    expect(stats.avgSavingsPercent).toBe(35)
  })
})
