export interface SecurityHeaderOptions {
  readonly includeHsts?: boolean
  readonly reportOnly?: boolean
}

export const CONTENT_SECURITY_POLICY_DIRECTIVES: ReadonlyArray<string> = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://plausible.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://plausible.io",
  'frame-src https://js.stripe.com https://hooks.stripe.com',
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
] as const

export const PERMISSIONS_POLICY_DIRECTIVES: ReadonlyArray<string> = [
  'geolocation=()',
  'microphone=()',
  'camera=()',
  'payment=(self "https://js.stripe.com")',
  'usb=()',
  'magnetometer=()',
  'gyroscope=()',
] as const

export function buildContentSecurityPolicy(
  directives: ReadonlyArray<string> = CONTENT_SECURITY_POLICY_DIRECTIVES,
): string {
  return directives.join('; ')
}

export function getSecurityHeaders({
  includeHsts = true,
  reportOnly = false,
}: SecurityHeaderOptions = {}): Headers {
  const headers = new Headers()
  const cspHeader = reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy'

  headers.set(cspHeader, buildContentSecurityPolicy())

  if (includeHsts) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    )
  }

  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', PERMISSIONS_POLICY_DIRECTIVES.join(', '))
  headers.set('X-XSS-Protection', '1; mode=block')

  return headers
}

export function applySecurityHeaders(
  response: Response,
  options?: SecurityHeaderOptions,
): Response {
  const headers = new Headers(response.headers)

  getSecurityHeaders(options).forEach((value, key) => {
    headers.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
