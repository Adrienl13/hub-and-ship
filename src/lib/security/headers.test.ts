import { describe, expect, it } from 'vitest'

import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  getSecurityHeaders,
} from './headers'

describe('security headers', () => {
  it('builds a CSP compatible with Stripe, Plausible and Supabase', () => {
    const csp = buildContentSecurityPolicy()

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain('https://js.stripe.com')
    expect(csp).toContain('https://*.supabase.co')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it('sets hardening headers by default', () => {
    const headers = getSecurityHeaders()

    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains; preload',
    )
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    )
    expect(headers.get('Permissions-Policy')).toContain('geolocation=()')
  })

  it('supports local or staging usage without HSTS', () => {
    const headers = getSecurityHeaders({ includeHsts: false })

    expect(headers.has('Strict-Transport-Security')).toBe(false)
    expect(headers.has('Content-Security-Policy')).toBe(true)
  })

  it('can emit CSP in report-only mode', () => {
    const headers = getSecurityHeaders({ reportOnly: true })

    expect(headers.has('Content-Security-Policy')).toBe(false)
    expect(headers.has('Content-Security-Policy-Report-Only')).toBe(true)
  })

  it('applies headers while preserving response metadata and existing headers', async () => {
    const response = new Response('ok', {
      status: 201,
      statusText: 'Created',
      headers: {
        'content-type': 'text/plain',
        'x-existing': 'kept',
      },
    })
    const hardened = applySecurityHeaders(response)

    expect(hardened.status).toBe(201)
    expect(hardened.statusText).toBe('Created')
    expect(hardened.headers.get('content-type')).toBe('text/plain')
    expect(hardened.headers.get('x-existing')).toBe('kept')
    expect(hardened.headers.get('X-Frame-Options')).toBe('DENY')
    expect(await hardened.text()).toBe('ok')
  })
})
