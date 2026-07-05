import { describe, expect, it } from 'vitest'

import {
  PARTNER_CONTEXT_STORAGE_KEY,
  buildPartnerSharePath,
  capturePartnerLinkContextFromUrl,
  createPartnerLinkContext,
  normalizePartnerSlug,
  readPartnerLinkContext,
  type PartnerContextStorage,
} from '@/lib/partners/link'

function createStorage(): PartnerContextStorage & {
  readonly entries: Map<string, string>
} {
  const entries = new Map<string, string>()
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

describe('partner link context', () => {
  it('normalizes partner slugs for shareable URLs', () => {
    expect(normalizePartnerSlug(' CHR Conseil Sud ')).toBe('chr-conseil-sud')
    expect(normalizePartnerSlug('Réseau Hôtelier')).toBe('reseau-hotelier')
    expect(normalizePartnerSlug('---')).toBeNull()
    expect(buildPartnerSharePath({ slug: 'CHR Conseil' })).toBe(
      '/p/chr-conseil',
    )
    expect(
      buildPartnerSharePath({ slug: 'CHR Conseil', selectionId: 'terrasse-80' }),
    ).toBe('/p/chr-conseil?selection=terrasse-80')
  })

  it('creates a 120 day partner context without exposing net pricing', () => {
    const context = createPartnerLinkContext({
      slug: 'chr-conseil',
      sourcePath: '/p/chr-conseil?selection=terrasse-80',
      selectionId: 'terrasse-80',
      now: new Date('2026-06-07T08:00:00.000Z'),
    })

    expect(context).toEqual({
      slug: 'chr-conseil',
      displayName: 'CHR Conseil',
      sourcePath: '/p/chr-conseil?selection=terrasse-80',
      selectionId: 'terrasse-80',
      capturedAt: '2026-06-07T08:00:00.000Z',
      expiresAt: '2026-10-05T08:00:00.000Z',
    })
  })

  it('captures partner context from /p/:slug and query campaign URLs', () => {
    const storage = createStorage()
    const context = capturePartnerLinkContextFromUrl({
      storage,
      url: new URL('https://prosimport.com/p/chr-conseil?selection=terrasse'),
      now: new Date('2026-06-07T08:00:00.000Z'),
    })

    expect(context?.slug).toBe('chr-conseil')
    expect(storage.entries.has(PARTNER_CONTEXT_STORAGE_KEY)).toBe(true)

    const campaign = capturePartnerLinkContextFromUrl({
      storage,
      url: new URL('https://prosimport.com/catalogue?partner=reseau-chr-sud'),
      now: new Date('2026-06-07T09:00:00.000Z'),
    })

    expect(campaign?.slug).toBe('reseau-chr-sud')
    expect(campaign?.sourcePath).toBe('/catalogue?partner=reseau-chr-sud')
  })

  it('drops expired partner context', () => {
    const storage = createStorage()
    const context = createPartnerLinkContext({
      slug: 'chr-conseil',
      sourcePath: '/p/chr-conseil',
      now: new Date('2026-06-07T08:00:00.000Z'),
    })
    expect(context).not.toBeNull()
    if (!context) return

    storage.setItem(PARTNER_CONTEXT_STORAGE_KEY, JSON.stringify(context))

    expect(
      readPartnerLinkContext({
        storage,
        now: new Date('2026-10-06T08:00:00.000Z'),
      }),
    ).toBeNull()
    expect(storage.entries.has(PARTNER_CONTEXT_STORAGE_KEY)).toBe(false)
  })
})
