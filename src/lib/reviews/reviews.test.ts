import { describe, expect, it } from 'vitest'

import { aggregateReviews, reviewFromRow } from './reviews'

describe('aggregateReviews', () => {
  it('returns zeroes for no reviews', () => {
    expect(aggregateReviews([])).toEqual({ count: 0, average: 0 })
  })

  it('averages ratings rounded to one decimal', () => {
    expect(aggregateReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual(
      { count: 3, average: 4.3 },
    )
    expect(aggregateReviews([{ rating: 5 }, { rating: 2 }])).toEqual({
      count: 2,
      average: 3.5,
    })
  })
})

describe('reviewFromRow', () => {
  it('maps snake_case row to camelCase review', () => {
    expect(
      reviewFromRow({
        id: 'r1',
        product_id: 'p1',
        author_name: 'Marie D.',
        company_name: 'Bistro X',
        rating: 5,
        title: 'Parfait',
        body: 'Conforme et solide.',
        verified_purchase: true,
        status: 'published',
        created_at: '2026-06-11T00:00:00Z',
        published_at: '2026-06-11T01:00:00Z',
      }),
    ).toEqual({
      id: 'r1',
      productId: 'p1',
      authorName: 'Marie D.',
      companyName: 'Bistro X',
      rating: 5,
      title: 'Parfait',
      body: 'Conforme et solide.',
      verifiedPurchase: true,
      status: 'published',
      createdAt: '2026-06-11T00:00:00Z',
      publishedAt: '2026-06-11T01:00:00Z',
    })
  })
})
