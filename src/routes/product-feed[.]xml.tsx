// GET /product-feed.xml — Google Merchant-compatible product feed (RSS 2.0,
// g: namespace), generated from the live catalogue. One feed serves them all:
// Google Merchant Center, Bing/Microsoft, and the AI shopping surfaces that
// ingest merchant feeds (chatgpt.com/merchants accepts the same fields).
// Prices are the public direct-pro grid — never the partner nets.

import { createFileRoute } from '@tanstack/react-router'

import { productPath } from '@/lib/catalogue/product-slug'
import {
  hasPublicImage,
  loadLiveCatalogProducts,
} from '@/lib/catalogue/server-catalog'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import { absoluteUrl } from '@/lib/seo'

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Une précommande Merchant exige une date de disponibilité. Le modèle
// container est un achat groupé (~3 mois rendu port) : on annonce une date
// glissante à +90 jours au format ISO 8601 (date seule).
function defaultAvailabilityDate(now: Date = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + 90)
  return date.toISOString().slice(0, 10)
}

export function buildProductFeed(
  products: ReadonlyArray<Product>,
  availabilityDate: string = defaultAvailabilityDate(),
): string {
  // Une fiche sans photo serait refusée par Merchant (image_link vide).
  const items = products
    .filter(hasPublicImage)
    .map((product) => {
      const link = absoluteUrl(productPath(product))
      // image_link DOIT être absolu (Merchant rejette les chemins relatifs).
      const image = absoluteUrl(product.mainImageUrl)
      return `    <item>
      <g:id>${xmlEscape(product.sku)}</g:id>
      <g:title>${xmlEscape(product.name)}</g:title>
      <g:description>${xmlEscape(product.description)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:price>${product.basePriceHt.toFixed(2)} EUR</g:price>
      <g:availability>preorder</g:availability>
      <g:availability_date>${xmlEscape(availabilityDate)}</g:availability_date>
      <g:condition>new</g:condition>
      <g:brand>Terrassea</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${xmlEscape(CATEGORY_LABEL[product.category])}</g:product_type>
      <g:min_handling_time>30</g:min_handling_time>
      <g:minimum_order_quantity>${product.moqUnits}</g:minimum_order_quantity>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Terrassea — mobilier outdoor professionnel</title>
    <link>${absoluteUrl('/catalogue')}</link>
    <description>Mobilier CHR en direct usine par container mutualisé. Prix HT professionnels, MOQ par produit, contrôle qualité SGS.</description>
${items}
  </channel>
</rss>
`
}

export const Route = createFileRoute('/product-feed.xml')({
  server: {
    handlers: {
      GET: async () => {
        // Jamais le catalogue mock ici : un feed est ingéré par Merchant et
        // les surfaces IA — mieux vaut un 503 (retenter plus tard) que des
        // produits fictifs annoncés publiquement.
        const products = await loadLiveCatalogProducts()
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
        return new Response(buildProductFeed(products), {
          status: 200,
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
