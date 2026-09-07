// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  STUDIO_PREVIEW_COOKIE,
  STUDIO_PREVIEW_TTL_SECONDS,
  buildStudioPreviewClearCookie,
  buildStudioPreviewSetCookie,
  readStudioPreviewToken,
  signStudioPreviewToken,
  verifyStudioPreviewToken,
} from './preview-cookie'

const SECRET = 'une-cle-de-preview-suffisamment-longue'
const NOW = 1_800_000_000

describe('jeton de preview Studio', () => {
  it('signe puis vérifie un jeton valide', async () => {
    const token = await signStudioPreviewToken(SECRET, NOW + 60)
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]+$/)
    expect(token).not.toContain(SECRET)
    const verdict = await verifyStudioPreviewToken(SECRET, token, NOW)
    expect(verdict).toEqual({ valid: true, expiresAtSeconds: NOW + 60 })
  })

  it('rejette un jeton expiré', async () => {
    const token = await signStudioPreviewToken(SECRET, NOW - 1)
    expect(await verifyStudioPreviewToken(SECRET, token, NOW)).toEqual({
      valid: false,
      reason: 'expired',
    })
  })

  it('rejette un jeton dont la date a été prolongée à la main', async () => {
    const token = await signStudioPreviewToken(SECRET, NOW + 60)
    const [, signature] = token.split('.')
    const forged = `${NOW + 999_999}.${signature}`
    expect(await verifyStudioPreviewToken(SECRET, forged, NOW)).toEqual({
      valid: false,
      reason: 'bad_signature',
    })
  })

  it('rejette un jeton signé avec un autre secret (révocation par rotation)', async () => {
    const token = await signStudioPreviewToken('ancien-secret-tres-long-aussi', NOW + 60)
    expect(await verifyStudioPreviewToken(SECRET, token, NOW)).toEqual({
      valid: false,
      reason: 'bad_signature',
    })
  })

  it('rejette les jetons absents ou malformés', async () => {
    expect(await verifyStudioPreviewToken(SECRET, null, NOW)).toEqual({ valid: false, reason: 'missing' })
    expect(await verifyStudioPreviewToken(SECRET, '', NOW)).toEqual({ valid: false, reason: 'missing' })
    expect(await verifyStudioPreviewToken(SECRET, 'abc', NOW)).toEqual({ valid: false, reason: 'malformed' })
    expect(await verifyStudioPreviewToken(SECRET, '12x.sig', NOW)).toEqual({ valid: false, reason: 'malformed' })
    expect(await verifyStudioPreviewToken(SECRET, '.sig', NOW)).toEqual({ valid: false, reason: 'malformed' })
  })
})

describe('cookie de preview Studio', () => {
  it('est HttpOnly, SameSite=Lax, limité à /studio, 7 jours, Secure en prod', () => {
    const header = buildStudioPreviewSetCookie('tok', { secure: true })
    expect(header).toBe(
      `${STUDIO_PREVIEW_COOKIE}=tok; Path=/studio; Max-Age=${STUDIO_PREVIEW_TTL_SECONDS}; HttpOnly; SameSite=Lax; Secure`,
    )
    expect(STUDIO_PREVIEW_TTL_SECONDS).toBe(7 * 24 * 3600)
  })

  it("omet Secure hors HTTPS (dev local) et sait s'effacer", () => {
    expect(buildStudioPreviewSetCookie('tok', { secure: false })).not.toContain('Secure')
    const clear = buildStudioPreviewClearCookie({ secure: true })
    expect(clear).toContain(`${STUDIO_PREVIEW_COOKIE}=;`)
    expect(clear).toContain('Max-Age=0')
  })

  it("lit le jeton dans un en-tête Cookie parmi d'autres cookies", () => {
    expect(readStudioPreviewToken(`a=1; ${STUDIO_PREVIEW_COOKIE}=123.abc; b=2`)).toBe('123.abc')
    expect(readStudioPreviewToken('a=1')).toBeNull()
    expect(readStudioPreviewToken(null)).toBeNull()
    expect(readStudioPreviewToken(`${STUDIO_PREVIEW_COOKIE}=`)).toBeNull()
  })
})
