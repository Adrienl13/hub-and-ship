import { describe, expect, it } from 'vitest'
import { getCanonicalRedirectLocation } from './start'

describe('getCanonicalRedirectLocation', () => {
  it('keeps apex host requests unchanged', () => {
    expect(
      getCanonicalRedirectLocation('https://prosimport.com/catalogue?audit=1'),
    ).toBeNull()
  })

  it('redirects www host requests to the canonical apex host', () => {
    expect(
      getCanonicalRedirectLocation(
        'https://www.prosimport.com/catalogue?audit=1',
      ),
    ).toBe('https://prosimport.com/catalogue?audit=1')
  })
})
