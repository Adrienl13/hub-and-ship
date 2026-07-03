import { beforeEach, describe, expect, it } from 'vitest'

import {
  ATTRIBUTION_STORAGE_KEY,
  ATTRIBUTION_TTL_MS,
  captureFirstTouchAttribution,
  getAttributionFields,
  isAttributionExpired,
  parseAttributionFromSearch,
  parseStoredAttribution,
  readStoredAttribution,
  resolveFirstTouch,
  type StoredAttribution,
} from './attribution'

const NOW = new Date('2026-07-02T10:00:00.000Z').getTime()

const PARTNER_SEARCH =
  '?ref=DBP-13&utm_source=partner&utm_medium=qr&utm_campaign=corner_depot'

beforeEach(() => {
  window.localStorage.clear()
})

describe('parseAttributionFromSearch', () => {
  it('extracts utm params and maps ref → partner_ref', () => {
    expect(parseAttributionFromSearch(PARTNER_SEARCH)).toEqual({
      utm_source: 'partner',
      utm_medium: 'qr',
      utm_campaign: 'corner_depot',
      partner_ref: 'DBP-13',
    })
  })

  it('works without a leading question mark', () => {
    expect(parseAttributionFromSearch('utm_source=linkedin')).toEqual({
      utm_source: 'linkedin',
      utm_medium: null,
      utm_campaign: null,
      partner_ref: null,
    })
  })

  it('returns null when no tracked params are present', () => {
    expect(parseAttributionFromSearch('?page=2&sort=price')).toBeNull()
    expect(parseAttributionFromSearch('')).toBeNull()
  })

  it('treats blank values as absent', () => {
    expect(parseAttributionFromSearch('?utm_source=&ref=')).toBeNull()
  })
})

describe('isAttributionExpired', () => {
  const base: StoredAttribution = {
    utm_source: 'partner',
    utm_medium: 'qr',
    utm_campaign: 'corner_depot',
    partner_ref: 'DBP-13',
    captured_at: NOW,
  }

  it('is not expired within the 90 day window', () => {
    expect(isAttributionExpired(base, NOW + ATTRIBUTION_TTL_MS - 1)).toBe(false)
  })

  it('is expired at/after the TTL', () => {
    expect(isAttributionExpired(base, NOW + ATTRIBUTION_TTL_MS)).toBe(true)
  })
})

describe('resolveFirstTouch (first-touch wins)', () => {
  const stored: StoredAttribution = {
    utm_source: 'partner',
    utm_medium: 'qr',
    utm_campaign: 'corner_depot',
    partner_ref: 'DBP-13',
    captured_at: NOW,
  }

  it('keeps an existing non-expired attribution over a new one', () => {
    const incoming = parseAttributionFromSearch('?utm_source=google')
    const later = NOW + 1000
    expect(resolveFirstTouch(stored, incoming, later)).toBe(stored)
  })

  it('captures incoming attribution when nothing is stored', () => {
    const incoming = parseAttributionFromSearch(PARTNER_SEARCH)
    expect(resolveFirstTouch(null, incoming, NOW)).toEqual({
      ...incoming,
      captured_at: NOW,
    })
  })

  it('replaces an expired attribution with the incoming one', () => {
    const incoming = parseAttributionFromSearch('?utm_source=google')
    const later = NOW + ATTRIBUTION_TTL_MS
    expect(resolveFirstTouch(stored, incoming, later)).toEqual({
      utm_source: 'google',
      utm_medium: null,
      utm_campaign: null,
      partner_ref: null,
      captured_at: later,
    })
  })

  it('stores nothing when there is neither a valid record nor incoming params', () => {
    expect(resolveFirstTouch(null, null, NOW)).toBeNull()
  })
})

describe('parseStoredAttribution', () => {
  it('rejects corrupt or incomplete payloads', () => {
    expect(parseStoredAttribution(null)).toBeNull()
    expect(parseStoredAttribution('{bad json')).toBeNull()
    expect(parseStoredAttribution('{"utm_source":"x"}')).toBeNull()
    expect(parseStoredAttribution('42')).toBeNull()
  })

  it('parses a well-formed record', () => {
    const raw = JSON.stringify({
      utm_source: 'partner',
      utm_medium: null,
      utm_campaign: null,
      partner_ref: 'DBP-13',
      captured_at: NOW,
    })
    expect(parseStoredAttribution(raw)).toMatchObject({
      utm_source: 'partner',
      partner_ref: 'DBP-13',
      captured_at: NOW,
    })
  })
})

describe('captureFirstTouchAttribution (localStorage)', () => {
  it('persists first-touch attribution on first visit', () => {
    const result = captureFirstTouchAttribution(PARTNER_SEARCH, NOW)
    expect(result).toMatchObject({ partner_ref: 'DBP-13', captured_at: NOW })

    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    expect(parseStoredAttribution(raw)).toMatchObject({ utm_source: 'partner' })
  })

  it('never overwrites an existing attribution (first-touch wins)', () => {
    captureFirstTouchAttribution(PARTNER_SEARCH, NOW)
    captureFirstTouchAttribution('?utm_source=google&utm_medium=cpc', NOW + 5000)

    expect(getAttributionFields(NOW + 5000)).toMatchObject({
      utm_source: 'partner',
      partner_ref: 'DBP-13',
    })
  })

  it('does not write anything when the URL has no tracking params', () => {
    captureFirstTouchAttribution('?page=2', NOW)
    expect(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)).toBeNull()
  })

  it('re-captures once the stored attribution has expired', () => {
    captureFirstTouchAttribution(PARTNER_SEARCH, NOW)
    const later = NOW + ATTRIBUTION_TTL_MS
    captureFirstTouchAttribution('?utm_source=google', later)

    expect(getAttributionFields(later)).toMatchObject({
      utm_source: 'google',
      partner_ref: null,
    })
  })
})

describe('readStoredAttribution / getAttributionFields', () => {
  it('returns empty fields when nothing is stored', () => {
    expect(getAttributionFields(NOW)).toEqual({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      partner_ref: null,
    })
  })

  it('ignores an expired stored record', () => {
    captureFirstTouchAttribution(PARTNER_SEARCH, NOW)
    expect(readStoredAttribution(NOW + ATTRIBUTION_TTL_MS)).toBeNull()
  })
})
