import { describe, expect, it } from 'vitest'

import { formatAdminDate, formatAdminDateTime, telHref } from './format'

describe('formatAdminDate', () => {
  it('rend jj/mm/aaaa en heure de Paris', () => {
    expect(formatAdminDate('2026-09-24T09:00:00.000Z')).toBe('24/09/2026')
    // 23:30 UTC le 30 septembre = 01:30 le 1er octobre à Paris.
    expect(formatAdminDate('2026-09-30T23:30:00.000Z')).toBe('01/10/2026')
    expect(formatAdminDate('2026-09-21')).toBe('21/09/2026')
  })

  it('garde les dix premiers caractères d’une date illisible, vide pour null', () => {
    expect(formatAdminDate('2026-13-45Tzz')).toBe('2026-13-45')
    expect(formatAdminDate(null)).toBe('')
    expect(formatAdminDate(undefined)).toBe('')
  })
})

describe('formatAdminDateTime', () => {
  it('rend jj/mm/aaaa hh:mm en heure de Paris', () => {
    expect(formatAdminDateTime('2026-09-24T09:05:00.000Z')).toBe(
      '24/09/2026 11:05',
    )
    expect(formatAdminDateTime('2026-01-15T23:59:00.000Z')).toBe(
      '16/01/2026 00:59',
    )
  })

  it('rend la valeur brute si illisible, vide pour null', () => {
    expect(formatAdminDateTime('n/a')).toBe('n/a')
    expect(formatAdminDateTime(null)).toBe('')
  })
})

describe('telHref', () => {
  it('retire espaces et ponctuation, garde le +', () => {
    expect(telHref('06 00 00 00 00')).toBe('tel:0600000000')
    expect(telHref('+33 6 00.00-00 (00)')).toBe('tel:+33600000000')
  })
})
