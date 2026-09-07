import { describe, expect, it } from 'vitest'

import { isVerified, normalizeDataQualityEntry, parseDataQuality, qualityOf } from './data-quality'

describe('qualité de données granulaire', () => {
  it("une provenance heuristique ne peut jamais être 'verified'", () => {
    for (const source of ['sku_prefix', 'name_heuristic', 'family_mode', 'category', 'pipeline']) {
      expect(normalizeDataQualityEntry({ status: 'verified', source })).toMatchObject({
        status: 'estimated',
        source,
      })
    }
  })

  it("'verified' sans provenance retombe en pending ; admin_input reste verified", () => {
    expect(normalizeDataQualityEntry({ status: 'verified', source: 'none' }).status).toBe('pending')
    expect(normalizeDataQualityEntry({ status: 'verified', source: 'admin_input' }).status).toBe('verified')
    expect(
      normalizeDataQualityEntry({ status: 'verified', source: 'catalogue_public_price' }).status,
    ).toBe('verified')
  })

  it('projection publique : by, note et toute clé inconnue sont ignorés côté client', () => {
    const entry = normalizeDataQualityEntry({
      status: 'verified',
      source: 'admin_input',
      updatedAt: '2026-09-07',
      by: 'uuid-admin',
      note: 'note interne',
      internal_flag: true,
    })
    expect(entry).toEqual({ status: 'verified', source: 'admin_input', updatedAt: '2026-09-07' })
    expect(Object.keys(entry)).not.toContain('by')
    expect(Object.keys(entry)).not.toContain('note')
    const quality = parseDataQuality({ price: { status: 'verified', source: 'admin_input', by: 'x', note: 'y' } })
    expect(JSON.stringify(quality)).not.toMatch(/"by"|"note"|uuid-admin/)
  })

  it('tolère un JSON inconnu ou partiel', () => {
    expect(normalizeDataQualityEntry(null)).toEqual({ status: 'pending', source: 'none' })
    expect(normalizeDataQualityEntry({ status: 'bizarre', source: 'ailleurs' })).toMatchObject({
      status: 'pending',
      source: 'none',
    })
    const quality = parseDataQuality({
      dimensions: { status: 'estimated', source: 'family_mode', by: 'migration' },
      inconnu: { status: 'verified', source: 'admin_input' },
    })
    expect(Object.keys(quality)).toEqual(['dimensions'])
    expect(qualityOf(quality, 'weight')).toEqual({ status: 'pending', source: 'none' })
    expect(isVerified(quality, 'dimensions')).toBe(false)
  })
})
