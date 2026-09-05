import { describe, expect, it } from 'vitest'

import {
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_MS,
  buildConsentUpdate,
  parseStoredConsent,
  readStoredConsent,
  writeStoredConsent,
} from './consent'

function createStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('cookie consent storage', () => {
  it('round-trips a decision and expires it after six months', () => {
    const storage = createStorage()
    const now = 1_800_000_000_000

    writeStoredConsent(storage, true, now)

    expect(readStoredConsent(storage, now)).toEqual({
      analytics: true,
      decidedAt: now,
    })
    expect(readStoredConsent(storage, now + CONSENT_TTL_MS + 1)).toBeNull()
    expect(storage.getItem(CONSENT_STORAGE_KEY)).toContain('"analytics":true')
  })

  it('ignores malformed or foreign values', () => {
    expect(parseStoredConsent('not json', 0)).toBeNull()
    expect(parseStoredConsent('{"analytics":"yes"}', 0)).toBeNull()
    expect(parseStoredConsent(null, 0)).toBeNull()
  })

  it('only ever grants analytics storage (no advertising cookies)', () => {
    expect(buildConsentUpdate(true)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    expect(buildConsentUpdate(false).analytics_storage).toBe('denied')
  })
})
