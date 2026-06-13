import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

const CANONICAL_HOST = 'prosimport.com'
const WWW_HOST = `www.${CANONICAL_HOST}`

const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://plausible.io",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://plausible.io",
  'frame-src https://js.stripe.com https://checkout.stripe.com',
  "form-action 'self' https://checkout.stripe.com",
].join('; ')

function createRedirectResponse(location: string): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: location,
    },
  })
}

export function getCanonicalRedirectLocation(
  requestUrl: string,
): string | null {
  const url = new URL(requestUrl)
  if (url.hostname !== WWW_HOST) {
    return null
  }

  url.hostname = CANONICAL_HOST
  return url.toString()
}

function applySecurityHeaders(headers: Headers): void {
  headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  )
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set(
    'Content-Security-Policy-Report-Only',
    CONTENT_SECURITY_POLICY_REPORT_ONLY,
  )
}

const canonicalHostMiddleware = createMiddleware().server(async (ctx) => {
  const location = getCanonicalRedirectLocation(ctx.request.url)
  if (!location) {
    return ctx.next()
  }

  const response = createRedirectResponse(location)
  applySecurityHeaders(response.headers)
  return response
})

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next()
    applySecurityHeaders(result.response.headers)
    return result
  },
)

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [
    securityHeadersMiddleware,
    canonicalHostMiddleware,
    csrfMiddleware,
  ],
}))
