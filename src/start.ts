import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

// Rebranding Terrassea en deux temps : la marque est déjà Terrassea, mais le
// site reste servi sur prosimport.com jusqu'à la bascule finale. LE JOUR J :
// exécuter scripts/flip-domaine-terrassea.sh (change ce host + toutes les
// URLs) — tous les hôtes connus non canoniques passent alors en 301.
const CANONICAL_HOST: string = 'terrassea.com'
const KNOWN_HOSTS = [
  'prosimport.com',
  'www.prosimport.com',
  'terrassea.com',
  'www.terrassea.com',
]
const LEGACY_HOSTS = new Set(
  KNOWN_HOSTS.filter((host) => host !== CANONICAL_HOST),
)

const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://plausible.io https://www.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://plausible.io https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net https://www.google.com https://www.facebook.com",
  'frame-src https://js.stripe.com https://checkout.stripe.com https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com',
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
  if (!LEGACY_HOSTS.has(url.hostname)) {
    return null
  }

  url.hostname = CANONICAL_HOST
  return url.toString()
}

// Adresses de l'ancien site (TerrasseaHUB, Vercel, jusqu'au 21/09/2026),
// encore dans l'index Google et dans ses rapports : `/produits/<id>`,
// `/produits?categorie=…`, `/projects/new`, `/index.html`. Sur le nouveau
// site elles tombaient dans le vide ; une redirection permanente vers la
// page équivalente récupère les liens entrants et assainit les rapports.
// Les identifiants produits de l'ancien site n'ont aucune correspondance :
// ils vont au catalogue.
const LEGACY_COLLECTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/cordage/i, 'cordage'],
  [/textil/i, 'textilene'],
  [/bistrot|tress|cannage/i, 'bistrot'],
]

export function getLegacyPathRedirect(requestUrl: string): string | null {
  const url = new URL(requestUrl)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (path === '/index.html') return '/'
  if (path === '/produits') {
    const categorie = url.searchParams.get('categorie') ?? ''
    const collection = LEGACY_COLLECTIONS.find(([re]) => re.test(categorie))
    return collection ? `/catalogue?collection=${collection[1]}` : '/catalogue'
  }
  if (path.startsWith('/produits/')) return '/catalogue'
  if (path === '/projects' || path.startsWith('/projects/')) return '/studio'
  return null
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
  if (location) {
    const response = createRedirectResponse(location)
    applySecurityHeaders(response.headers)
    return response
  }

  // 301 et non 308 : l'ancien site n'avait que des GET, et un 301 est ce
  // que les moteurs prennent le plus sûrement pour un déménagement.
  const legacy = getLegacyPathRedirect(ctx.request.url)
  if (legacy) {
    const response = new Response(null, {
      status: 301,
      headers: { Location: new URL(legacy, ctx.request.url).toString() },
    })
    applySecurityHeaders(response.headers)
    return response
  }

  return ctx.next()
})

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next()
    applySecurityHeaders(result.response.headers)
    // HTML documents must always revalidate so a new deploy is picked up
    // immediately (hashed JS/CSS keep their own long-lived cache).
    const contentType = result.response.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      result.response.headers.set('Cache-Control', 'no-cache, must-revalidate')
    }
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
