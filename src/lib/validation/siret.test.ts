import { describe, expect, it } from 'vitest'

import { cleanSiret, validateSiretChecksum, validateSiretFormat } from './siret'

describe('cleanSiret', () => {
  it('removes whitespace only', () => {
    expect(cleanSiret('732 829 320 00074')).toBe('73282932000074')
  })
})

describe('validateSiretChecksum', () => {
  it('accepts a valid SIRET checksum', () => {
    expect(validateSiretChecksum('73282932000074')).toBe(true)
  })

  it('accepts a valid SIRET with spaces', () => {
    expect(validateSiretChecksum('732 829 320 00074')).toBe(true)
  })

  it('rejects an invalid checksum', () => {
    expect(validateSiretChecksum('73282932000075')).toBe(false)
  })

  it('rejects non-numeric or incorrectly sized input', () => {
    expect(validateSiretChecksum('abc')).toBe(false)
    expect(validateSiretChecksum('123456789')).toBe(false)
    expect(validateSiretChecksum('123456789012345')).toBe(false)
  })
})

describe('validateSiretFormat', () => {
  it('returns valid with cleaned input for a valid SIRET', () => {
    expect(validateSiretFormat('732 829 320 00074')).toEqual({
      valid: true,
      cleaned: '73282932000074',
    })
  })

  it('returns invalid_format for a malformed SIRET', () => {
    expect(validateSiretFormat('123')).toEqual({
      valid: false,
      cleaned: '123',
      reason: 'Le SIRET doit contenir exactement 14 chiffres',
    })
  })

  it('returns invalid_checksum for a 14-digit bad SIRET', () => {
    expect(validateSiretFormat('73282932000075')).toEqual({
      valid: false,
      cleaned: '73282932000075',
      reason: 'Numero SIRET invalide (cle de controle incorrecte)',
    })
  })
})
