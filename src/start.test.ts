import { describe, expect, it } from 'vitest'
import { getCanonicalRedirectLocation } from './start'

describe('getCanonicalRedirectLocation', () => {
  it('keeps apex host requests unchanged', () => {
    expect(
      getCanonicalRedirectLocation('https://terrassea.com/catalogue?audit=1'),
    ).toBeNull()
  })

  it('redirects www host requests to the canonical apex host', () => {
    expect(
      getCanonicalRedirectLocation(
        'https://www.terrassea.com/catalogue?audit=1',
      ),
    ).toBe('https://terrassea.com/catalogue?audit=1')
  })
})
