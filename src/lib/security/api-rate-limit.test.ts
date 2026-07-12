import { describe, expect, it } from 'vitest'

import { createRateLimitStore } from '@/lib/security/rate-limit'
import {
  clientIpFromRequest,
  enforceApiRateLimit,
  PUBLIC_FORM_RATE_LIMIT,
} from '@/lib/security/api-rate-limit'

function req(ip: string): Request {
  return new Request('https://prosimport.com/api/contact', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
  })
}

describe('public API rate limiting (M15)', () => {
  it('resolves the client IP from proxy headers', () => {
    expect(clientIpFromRequest(req('203.0.113.7'))).toBe('203.0.113.7')
    expect(
      clientIpFromRequest(
        new Request('https://x/api', {
          headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
        }),
      ),
    ).toBe('198.51.100.9')
    expect(
      clientIpFromRequest(new Request('https://x/api')),
    ).toBe('unknown')
  })

  it('blocks after the limit and returns 429 with Retry-After', () => {
    const store = createRateLimitStore()
    const ip = '203.0.113.7'
    for (let i = 0; i < PUBLIC_FORM_RATE_LIMIT.limit; i += 1) {
      const r = enforceApiRateLimit(req(ip), 'contact', PUBLIC_FORM_RATE_LIMIT, store)
      expect(r.allowed).toBe(true)
    }
    const blocked = enforceApiRateLimit(
      req(ip),
      'contact',
      PUBLIC_FORM_RATE_LIMIT,
      store,
    )
    expect(blocked.allowed).toBe(false)
    expect(blocked.response?.status).toBe(429)
    expect(blocked.response?.headers.get('retry-after')).toBeTruthy()
  })

  it('isolates limits per IP and per endpoint scope', () => {
    const store = createRateLimitStore()
    for (let i = 0; i < PUBLIC_FORM_RATE_LIMIT.limit; i += 1) {
      enforceApiRateLimit(req('1.1.1.1'), 'contact', PUBLIC_FORM_RATE_LIMIT, store)
    }
    // Autre IP : non affectée.
    expect(
      enforceApiRateLimit(req('2.2.2.2'), 'contact', PUBLIC_FORM_RATE_LIMIT, store)
        .allowed,
    ).toBe(true)
    // Même IP, autre endpoint : compteur distinct.
    expect(
      enforceApiRateLimit(
        req('1.1.1.1'),
        'stock-requests',
        PUBLIC_FORM_RATE_LIMIT,
        store,
      ).allowed,
    ).toBe(true)
  })
})
