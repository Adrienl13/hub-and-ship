import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveredContainerCard } from './DeliveredContainerCard'
import type { DeliveredContainer } from '@/lib/delivered-containers/repository'
const container: DeliveredContainer = {
  id: 'test',
  reference: 'TEST-01',
  slug: 'test-01',
  port: 'Test port',
  originPort: null,
  status: 'delivered',
  deliveredAt: '2026-08-01',
  publishedAt: '2026-08-02',
  professionalsServed: 5,
  totalItems: 100,
  savingsTotalEur: 9999,
  savingsPercent: 30,
  plannedDays: 45,
  actualDays: 50,
  photoUrl: null,
  story: null,
  certifications: ['SGS'],
  timeline: [],
  productBreakdown: [],
  gallery: [],
  testimonial: {
    quote: null,
    longQuote: null,
    author: null,
    role: null,
    location: null,
    rating: null,
  },
}
const render = (c = container, hasSgs = false) =>
  renderToStaticMarkup(
    <DeliveredContainerCard
      container={c}
      registry={{ hasSgs, latestDelivered: true, sequence: 1 }}
    />,
  )
describe('existing container card registry presentation', () => {
  it('keeps the historical card variant unchanged', () => {
    expect(
      renderToStaticMarkup(<DeliveredContainerCard container={container} />),
    ).toContain('/livres/test-01')
  })
  it('shows delivered metrics and four real placeholders without invented media or SGS evidence', () => {
    const html = render()
    expect(html).toContain('Livré')
    expect(html).toContain('−30 %')
    expect(html.match(/Photo à venir/g)).toHaveLength(4)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('Contrôle SGS validé')
    expect(html).not.toContain('9999')
    expect(html).not.toContain('Annoncé')
  })
  it('uses the shipping date as an ETA and shows the sea stage', () => {
    const html = render({
      ...container,
      status: 'shipping',
      professionalsServed: null,
      totalItems: null,
      savingsPercent: null,
    })
    expect(html).toContain('Arrivée estimée')
    expect(html).toContain('Suivi du transit')
    expect(html).toContain('aria-current="step"')
    expect(html).not.toContain('pros servis')
  })
  it('only displays the SGS badge with verified public evidence and the testimonial when present', () => {
    const html = render(
      {
        ...container,
        testimonial: {
          ...container.testimonial,
          quote: 'Test quote',
          author: 'Test author',
        },
      },
      true,
    )
    expect(html).toContain('Contrôle SGS validé')
    expect(html).toContain('Test quote')
    expect(html).toContain('Test author')
  })
  it('escapes public text and rejects non-http gallery URLs', () => {
    const html = render({
      ...container,
      port: '<script>alert(1)</script>',
      gallery: [{ url: 'javascript:alert(1)', caption: '' }],
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('javascript:')
  })
})
