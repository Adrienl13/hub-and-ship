import { describe, expect, it } from 'vitest'

import {
  describeStalledCallback,
  parseMagicLinkCallback,
} from '@/lib/auth/magic-link-callback'

describe('retour de lien magique', () => {
  it('lit une erreur posée en fragment (forme historique de Supabase)', () => {
    const result = parseMagicLinkCallback(
      '',
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    )
    expect(result.failure?.code).toBe('otp_expired')
    expect(result.failure?.title).toBe('Ce lien a expiré.')
  })

  it('lit la même erreur posée en query', () => {
    const result = parseMagicLinkCallback(
      '?error=access_denied&error_code=otp_expired',
      '',
    )
    expect(result.failure?.code).toBe('otp_expired')
  })

  it("reprend la description de Supabase quand le code n'est pas connu", () => {
    const result = parseMagicLinkCallback(
      '?error=server_error&error_description=Database+error+saving+new+user',
      '',
    )
    expect(result.failure?.detail).toBe('Database error saving new user')
  })

  it('reconnaît un lien token_hash, vérifiable depuis un autre appareil', () => {
    const result = parseMagicLinkCallback(
      '?token_hash=abc123&type=magiclink&returnTo=%2Faccount',
      '',
    )
    expect(result).toMatchObject({
      failure: null,
      tokenHash: 'abc123',
      otpType: 'magiclink',
      hasPkceCode: false,
    })
  })

  it('ignore un type d’OTP inconnu plutôt que de le transmettre', () => {
    const result = parseMagicLinkCallback('?token_hash=abc&type=sms', '')
    expect(result.tokenHash).toBe('abc')
    expect(result.otpType).toBeNull()
  })

  it('signale un échange PKCE en cours', () => {
    const result = parseMagicLinkCallback('?code=pkce-code', '')
    expect(result).toMatchObject({
      failure: null,
      tokenHash: null,
      hasPkceCode: true,
    })
  })

  it('ne voit ni erreur ni jeton sur une URL nue', () => {
    expect(parseMagicLinkCallback('', '')).toEqual({
      failure: null,
      tokenHash: null,
      otpType: null,
      hasPkceCode: false,
    })
  })

  it('nomme le cas multi-appareil quand le délai de garde expire avec un code', () => {
    const failure = describeStalledCallback(true)
    expect(failure.code).toBe('pkce_verifier_missing')
    expect(failure.title).toContain('autre appareil')
  })

  it('reste générique quand le délai expire sans code', () => {
    expect(describeStalledCallback(false).code).toBe('callback_timeout')
  })
})
