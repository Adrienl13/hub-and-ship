// GET /sitemap-products.xml — dynamic product sitemap, generated from the
// live catalogue so every product page (/catalogue/p/<slug>) is discoverable
// by crawlers without maintaining the static sitemap by hand.

import { createFileRoute } from '@tanstack/react-router'

import { productPath } from '@/lib/catalogue/product-slug'
import { loadCatalogProducts } from '@/lib/catalogue/server-catalog'
import { absoluteUrl } from '@/lib/seo'

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function buildProductsSitemap(): Promise<string> {
  const products = await loadCatalogProducts()
  const urls = products
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
      GET: async () =>
        new Response(await buildProductsSitemap(), {
          status: 200,
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            // Cacheable at the edge for an hour — the catalogue moves slowly.
            'cache-control': 'public, max-age=3600',
          },
        }),
    },
  },
})
