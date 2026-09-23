import { describe, expect, it } from 'vitest'

import {
  DEFAULT_RETURN_TO,
  returnToFromRedirectUrl,
  sanitizeReturnTo,
} from './return-to'

describe('sanitizeReturnTo', () => {
  it('garde un chemin interne avec sa requête et son ancre', () => {
    expect(sanitizeReturnTo('/account/reservations?x=1#top', '/x')).toBe(
      '/account/reservations?x=1#top',
    )
  })

  it('retombe sur la valeur de repli pour tout ce qui sort du site', () => {
    for (const hostile of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      '/account\n//evil.example',
      ' /account',
      'account',
      '',
    ]) {
      expect(sanitizeReturnTo(hostile, '/repli')).toBe('/repli')
    }
    expect(sanitizeReturnTo(undefined, undefined)).toBeUndefined()
    expect(sanitizeReturnTo(null, DEFAULT_RETURN_TO)).toBe('/account')
  })
})

describe('returnToFromRedirectUrl', () => {
  it('lit le returnTo du lien demandé par le navigateur', () => {
    expect(
      returnToFromRedirectUrl(
        'https://terrassea.com/auth/callback?returnTo=%2Faccount%2Ffavoris',
      ),
    ).toBe('/account/favoris')
  })

  it('retombe sur le tableau de bord sans returnTo ou hors site', () => {
    // Supabase remplace une URL non autorisée par la Site URL : plus de returnTo.
    expect(returnToFromRedirectUrl('https://prosimport.com')).toBe('/account')
    expect(
      returnToFromRedirectUrl(
        'https://terrassea.com/auth/callback?returnTo=https%3A%2F%2Fevil.example',
      ),
    ).toBe('/account')
    expect(returnToFromRedirectUrl('pas une url')).toBe('/account')
    expect(returnToFromRedirectUrl(null)).toBe('/account')
  })
})
