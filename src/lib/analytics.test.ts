import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsEvent, track, trackEcommerce } from './analytics'

describe('analytics track()', () => {
  beforeEach(() => {
    window.dataLayer = []
    window.plausible = vi.fn() as unknown as Window['plausible']
  })

  afterEach(() => {
    delete window.dataLayer
    delete window.plausible
  })

  it('sends the same event to Plausible and to the GTM dataLayer', () => {
    track(AnalyticsEvent.ContactSubmit, { topic: 'produit' })

    expect(window.plausible).toHaveBeenCalledWith('contact_submit', {
      props: { topic: 'produit' },
    })
    expect(window.dataLayer).toEqual([
      { event: 'contact_submit', topic: 'produit' },
    ])
  })

  it('pushes GA4 e-commerce payloads after resetting the ecommerce object', () => {
    trackEcommerce('purchase', {
      currency: 'EUR',
      value: 150,
      transaction_id: 'res-1',
    })

    expect(window.dataLayer).toEqual([
      { ecommerce: null },
      {
        event: 'purchase',
        ecommerce: { currency: 'EUR', value: 150, transaction_id: 'res-1' },
      },
    ])
  })

  it('never throws when a destination misbehaves', () => {
    window.plausible = vi.fn(() => {
      throw new Error('boom')
    }) as unknown as Window['plausible']

    expect(() => track(AnalyticsEvent.QuotePdf)).not.toThrow()
  })
})
