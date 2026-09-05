// GET /sitemap-products.xml — dynamic product sitemap, generated from the
// live catalogue so every product page (/catalogue/p/<slug>) is discoverable
// by crawlers without maintaining the static sitemap by hand.

import { createFileRoute } from '@tanstack/react-router'

import { productPath } from '@/lib/catalogue/product-slug'
import {
  hasPublicImage,
  loadLiveCatalogProducts,
} from '@/lib/catalogue/server-catalog'
import { PRODUCTS, type Product } from '@/lib/products'
import { absoluteUrl } from '@/lib/seo'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildProductsSitemap(
  products: ReadonlyArray<Product>,
): string {
  const urls = products
    .filter(hasPublicImage)
    .map(
      (product) => `  <url>
    <loc>${xmlEscape(absoluteUrl(productPath(product)))}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export const Route = createFileRoute('/sitemap-products.xml')({
  server: {
    handlers: {
      GET: async () => {
        // Jamais le catalogue mock sur un site configuré : une panne DB
        // répond 503 sans cache (le mock ne sert qu'au dev local).
        const live = await loadLiveCatalogProducts()
        const products =
          live ?? (getSupabasePublicConfig().isConfigured ? null : PRODUCTS)
        if (!products) {
          return new Response('Catalogue indisponible, réessayez plus tard.', {
            status: 503,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'retry-after': '600',
              'cache-control': 'no-store',
            },
          })
        }
        return new Response(buildProductsSitemap(products), {
          status: 200,
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            // Cacheable at the edge for an hour — the catalogue moves slowly.
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
