// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  STUDIO_PREVIEW_COOKIE,
  signStudioPreviewToken,
} from './preview-cookie'
import {
  handleStudioPreviewRequest,
  isSecureRequest,
  readStudioPreviewSecret,
  requestHasValidStudioPreview,
} from './preview-server'

const SECRET = 'cle-de-preview-de-test-0123456789'
const NOW = 1_800_000_000
const allow = () => ({ allowed: true })

function request(query: string, init?: RequestInit): Request {
  return new Request(`https://prosimport.com/studio/preview${query}`, init)
}

describe('secret de preview', () => {
  it('exige STUDIO_PREVIEW_KEY côté serveur, jamais une variable VITE_*', () => {
    expect(readStudioPreviewSecret({})).toBeNull()
    expect(readStudioPreviewSecret({ STUDIO_PREVIEW_KEY: 'court' })).toBeNull()
    expect(readStudioPreviewSecret({ STUDIO_PREVIEW_KEY: ` ${SECRET} ` })).toBe(SECRET)
  })

  it('détecte HTTPS pour poser Secure', () => {
    expect(isSecureRequest(new Request('https://x.test/'), false)).toBe(true)
    expect(isSecureRequest(new Request('http://localhost:5173/'), false)).toBe(false)
    expect(isSecureRequest(new Request('http://localhost:5173/'), true)).toBe(true)
  })
})

describe('GET /studio/preview', () => {
  it('répond 404 sans secret configuré, même avec une clé', async () => {
    const response = await handleStudioPreviewRequest(request('?key=abc'), {
      secret: null,
      nowSeconds: NOW,
      secure: true,
      rateLimit: allow,
    })
    expect(response.status).toBe(404)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('répond 404 sans cookie pour une mauvaise clé ou une clé absente', async () => {
    for (const query of ['', '?key=', '?key=mauvaise', `?key=${SECRET}x`]) {
      const response = await handleStudioPreviewRequest(request(query), {
        secret: SECRET,
        nowSeconds: NOW,
        secure: true,
        rateLimit: allow,
      })
      expect(response.status, query).toBe(404)
      expect(response.headers.get('set-cookie')).toBeNull()
    }
  })

  it('pose un cookie signé valable 7 jours et redirige vers /studio', async () => {
    const response = await handleStudioPreviewRequest(request(`?key=${SECRET}`), {
      secret: SECRET,
      nowSeconds: NOW,
      secure: true,
      rateLimit: allow,
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/studio')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${STUDIO_PREVIEW_COOKIE}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/studio')
    expect(cookie).not.toContain(SECRET)

    const token = cookie.split(';')[0]?.split('=')[1] ?? ''
    expect(token).toContain(`${NOW + 7 * 24 * 3600}.`)
    const follow = new Request('https://prosimport.com/studio', {
      headers: { cookie: `${STUDIO_PREVIEW_COOKIE}=${token}` },
    })
    expect(await requestHasValidStudioPreview(follow, SECRET, NOW + 100)).toBe(true)
    expect(await requestHasValidStudioPreview(follow, SECRET, NOW + 8 * 24 * 3600)).toBe(false)
    expect(await requestHasValidStudioPreview(follow, 'autre-secret-suffisamment-long', NOW)).toBe(false)
    expect(await requestHasValidStudioPreview(follow, null, NOW)).toBe(false)
  })

  it('efface le cookie avec ?clear=1', async () => {
    const response = await handleStudioPreviewRequest(request('?clear=1'), {
      secret: SECRET,
      nowSeconds: NOW,
      secure: false,
      rateLimit: allow,
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('respecte le limiteur de débit avant toute comparaison', async () => {
    const response = await handleStudioPreviewRequest(request(`?key=${SECRET}`), {
      secret: SECRET,
      nowSeconds: NOW,
      secure: true,
      rateLimit: () => ({ allowed: false, response: new Response('slow', { status: 429 }) }),
    })
    expect(response.status).toBe(429)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('refuse les méthodes autres que GET', async () => {
    const response = await handleStudioPreviewRequest(
      request(`?key=${SECRET}`, { method: 'POST' }),
      { secret: SECRET, nowSeconds: NOW, secure: true, rateLimit: allow },
    )
    expect(response.status).toBe(404)
  })

  it("un cookie forgé sans le secret n'ouvre rien", async () => {
    const forged = await signStudioPreviewToken('secret-devine-par-un-attaquant', NOW + 60)
    const follow = new Request('https://prosimport.com/studio', {
      headers: { cookie: `${STUDIO_PREVIEW_COOKIE}=${forged}` },
    })
    expect(await requestHasValidStudioPreview(follow, SECRET, NOW)).toBe(false)
  })
})
