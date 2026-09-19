// POST /api/cron/indexnow — signale à Bing les pages à réindexer.
//
// Déclenché par un scheduler externe avec le header `x-cron-secret`, comme
// /api/cron/payment-reminders.
//
// Deux usages :
//   - corps vide          → soumet les pages clés + toutes les fiches
//     publiques du catalogue. C'est le passage périodique.
//   - {"urls": [...]}     → soumet uniquement celles-là. C'est ce qu'on
//     appelle après avoir corrigé UNE fiche, pour qu'elle reparte en
//     indexation dans l'heure au lieu du mois suivant.
//
// L'endpoint est protégé par CRON_SECRET, pas par la clé IndexNow : cette
// dernière est publique par construction (elle est servie à la racine du
// site pour prouver qu'on contrôle le domaine). Sans ce garde, n'importe
// qui pourrait faire soumettre 10 000 URLs en boucle et nous faire limiter
// par Bing.

import { createFileRoute } from '@tanstack/react-router'

import { productPath } from '@/lib/catalogue/product-slug'
import { loadLiveCatalogProducts } from '@/lib/catalogue/server-catalog'
import { submitToIndexNow } from '@/lib/indexnow'
import { isPubliclyListed } from '@/lib/products'
import { SITE_URL } from '@/lib/seo'
import { timingSafeEqualStr } from '@/lib/security/timing-safe-equal'

/** Pages sans produit qui méritent d'être repassées : elles changent avec le
 *  catalogue (compteurs, sélection mise en avant, prix affichés). */
const KEY_PAGES = [
  '/',
  '/catalogue',
  '/prix',
  '/partenaires',
  '/livres',
  '/stock-24h',
  '/qualite',
]

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

function methodNotAllowed(): Response {
  return jsonResponse(
    { ok: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  )
}

/** Lit un `urls` éventuel sans jamais lever sur un corps malformé. */
async function readRequestedUrls(
  request: Request,
): Promise<ReadonlyArray<string> | null> {
  try {
    const body = (await request.json()) as unknown
    if (
      body &&
      typeof body === 'object' &&
      Array.isArray((body as { urls?: unknown }).urls)
    ) {
      const urls = (body as { urls: unknown[] }).urls
      return urls.filter((url): url is string => typeof url === 'string')
    }
  } catch {
    // Corps vide ou illisible : on retombe sur le catalogue complet.
  }
  return null
}

export async function handleIndexNow(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()

  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return jsonResponse(
      { ok: false, error: 'CRON_SECRET not configured' },
      { status: 503 },
    )
  }
  if (!timingSafeEqualStr(request.headers.get('x-cron-secret') ?? '', secret)) {
    return jsonResponse({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const requested = await readRequestedUrls(request)
  let urls: ReadonlyArray<string>

  if (requested) {
    urls = requested
  } else {
    const products = await loadLiveCatalogProducts()
    // Base injoignable : on ne soumet PAS les seules pages clés en laissant
    // croire que le catalogue a été repassé. Mieux vaut échouer visiblement
    // et réessayer au prochain passage.
    if (products === null) {
      return jsonResponse(
        { ok: false, error: 'catalogue indisponible' },
        { status: 503 },
      )
    }
    urls = [
      ...KEY_PAGES,
      ...products.filter(isPubliclyListed).map((product) => productPath(product)),
    ]
  }

  const result = await submitToIndexNow(SITE_URL, urls)
  return jsonResponse(result, { status: result.ok ? 200 : 502 })
}

export const Route = createFileRoute('/api/cron/indexnow')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handleIndexNow(request),
    },
  },
})
