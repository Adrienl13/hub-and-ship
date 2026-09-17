// GET /sitemap-livres.xml — registre des containers livrés.
//
// Ces fiches sont le contenu de preuve le plus différenciant du site, et
// elles n'étaient annoncées nulle part : absentes du sitemap statique, et
// servies en `noindex` par un `head` qui lisait la mauvaise source. Le head
// est corrigé (résolution dans le loader) ; il restait à les déclarer.
//
// Le sitemap est dynamique parce que la liste bouge à chaque container
// publié : une liste tenue à la main aurait divergé dès la première
// publication.

import { createFileRoute } from '@tanstack/react-router'

import { listPublishedContainerSlugs } from '@/lib/delivered-containers/server-registry'
import { absoluteUrl } from '@/lib/seo'

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildRegistrySitemap(
  containers: ReadonlyArray<{
    readonly slug: string
    readonly deliveredAt: string | null
  }>,
): string {
  const urls = containers
    .filter((container) => container.slug.length > 0)
    .map(
      (container) => `  <url>
    <loc>${xmlEscape(absoluteUrl(`/livres/${container.slug}`))}</loc>${
      container.deliveredAt
        ? `\n    <lastmod>${xmlEscape(container.deliveredAt.slice(0, 10))}</lastmod>`
        : ''
    }
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export const Route = createFileRoute('/sitemap-livres.xml')({
  server: {
    handlers: {
      GET: async () => {
        const containers = await listPublishedContainerSlugs()
        return new Response(buildRegistrySitemap(containers), {
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
