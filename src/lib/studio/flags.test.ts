import { describe, expect, it } from 'vitest'

import { isStudioEnabled, parseStudioEnabled } from './flags'

describe('feature flag Studio', () => {
  it("est OFF par défaut (absent, vide, valeur inattendue)", () => {
    expect(parseStudioEnabled(undefined)).toBe(false)
    expect(parseStudioEnabled('')).toBe(false)
    expect(parseStudioEnabled('false')).toBe(false)
    expect(parseStudioEnabled('0')).toBe(false)
    expect(parseStudioEnabled('enabled')).toBe(false)
    expect(isStudioEnabled({})).toBe(false)
  })

  it("s'active uniquement sur une valeur vraie explicite", () => {
    expect(parseStudioEnabled('true')).toBe(true)
    expect(parseStudioEnabled(' TRUE ')).toBe(true)
    expect(parseStudioEnabled('1')).toBe(true)
    expect(isStudioEnabled({ VITE_STUDIO_ENABLED: 'true' })).toBe(true)
  })
})
