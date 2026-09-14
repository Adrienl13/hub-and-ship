/* global Bun, process, Response, URL, console */
// Standalone development preview: loopback only, fixed anonymous public API reads, no writes.
import { fileURLToPath } from 'node:url'
import { readCatalogue } from '../terrassea-catalogue/api.mjs'
import { readRegistry } from '../terrassea-livres/api.tsx'
let registryCache = null
let registryShared = null
const catalogueRoot = fileURLToPath(
  new URL('../terrassea-catalogue/', import.meta.url),
)
let catalogueCache = null
let catalogueRead = null
async function catalogueData() {
  if (catalogueCache && Date.now() - catalogueCache.at < 60000)
    return catalogueCache.data
  if (!catalogueRead)
    catalogueRead = readCatalogue()
      .then((data) => {
        catalogueCache = { data, at: Date.now() }
        return data
      })
      .finally(() => {
        catalogueRead = null
      })
  return catalogueRead
}
const base = fileURLToPath(new URL('./', import.meta.url))
const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url))
if (process.env.NODE_ENV === 'production')
  throw new Error('Local prototype only')
const allowed = new Set([
  'index.html',
  'styles.css',
  'source-styles.css',
  'app.js',
  'bindings.js',
  'model.js',
  'config.js',
  'project.js',
])
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 5192,
  async fetch(req) {
    if (!['GET', 'HEAD'].includes(req.method))
      return new Response('No writes in local preview', { status: 403 })
    const path = decodeURIComponent(new URL(req.url).pathname)
    if (path.includes('..') || path.includes('\\'))
      return new Response('Forbidden', { status: 403 })
    if (path === '/livres') return Response.redirect('/livres/', 302)
    if (path === '/livres/api') {
      try {
        if (!registryCache || Date.now() - registryCache.at > 60000)
          registryCache = { at: Date.now(), data: await readRegistry() }
        return Response.json(registryCache.data, {
          headers: { 'Cache-Control': 'no-store' },
        })
      } catch {
        return Response.json(
          { error: 'Registre indisponible' },
          { status: 503 },
        )
      }
    }
    if (path === '/livres/shared.js') {
      if (!registryShared) {
        const built = await Bun.build({
          entrypoints: [
            fileURLToPath(
              new URL('../terrassea-livres/shared.ts', import.meta.url),
            ),
          ],
          target: 'browser',
          minify: true,
        })
        if (!built.success) return new Response('Build failed', { status: 500 })
        registryShared = await built.outputs[0].text()
      }
      return new Response(registryShared, {
        headers: {
          'Content-Type': 'text/javascript',
          'Cache-Control': 'no-store',
        },
      })
    }
    if (path.startsWith('/livres/')) {
      const name = path.slice(8) || 'index.html'
      if (
        !['index.html', 'source-styles.css', 'styles.css', 'app.js'].includes(
          name,
        )
      )
        return new Response('Not found', { status: 404 })
      return new Response(
        Bun.file(
          fileURLToPath(
            new URL('../terrassea-livres/' + name, import.meta.url),
          ),
        ),
        { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
      )
    }
    if (path === '/partenaires') return Response.redirect('/partenaires/', 302)
    if (path.startsWith('/partenaires/')) {
      const name = path.slice(13) || 'index.html'
      if (
        ![
          'index.html',
          'source-styles.css',
          'styles.css',
          'model.js',
          'app.js',
          'config.js',
        ].includes(name)
      )
        return new Response('Not found', { status: 404 })
      return new Response(
        Bun.file(
          fileURLToPath(
            new URL('../terrassea-partenaires/' + name, import.meta.url),
          ),
        ),
        { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
      )
    }
    if (path === '/prix') return Response.redirect('/prix/', 302)
    if (path.startsWith('/prix/')) {
      const name = path.slice(6) || 'index.html'
      if (
        ![
          'index.html',
          'foundation.css',
          'source-styles.css',
          'styles.css',
          'model.js',
          'app.js',
          'config.js',
        ].includes(name)
      )
        return new Response('Not found', { status: 404 })
      return new Response(
        Bun.file(
          fileURLToPath(new URL('../terrassea-prix/' + name, import.meta.url)),
        ),
        { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
      )
    }
    if (path === '/terrassea-catalogue/data.js')
      return new Response(Bun.file(catalogueRoot + 'data.js'))
    if (path === '/catalogue') return Response.redirect('/catalogue/', 302)
    if (path === '/catalogue/api') {
      try {
        return Response.json(await catalogueData(), {
          headers: { 'Cache-Control': 'no-store' },
        })
      } catch {
        return Response.json(
          { error: 'Catalogue indisponible' },
          { status: 503 },
        )
      }
    }
    const catalogueFile =
      path === '/catalogue/'
        ? 'index.html'
        : path.startsWith('/catalogue/')
          ? path.slice(11)
          : null
    if (
      catalogueFile &&
      [
        'index.html',
        'app.js',
        'data.js',
        'model.js',
        'styles.css',
        'source-styles.css',
      ].includes(catalogueFile)
    )
      return new Response(Bun.file(catalogueRoot + catalogueFile), {
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      })
    if (path === '/terrassea-accueil-v3/bindings.js')
      return new Response(Bun.file(base + 'bindings.js'))
    const file = path === '/' ? 'index.html' : path.slice(1)
    const asset =
      /^\/(catalogue|brand)\/.+\.(webp|png|jpg|jpeg|svg)$/.test(path) ||
      /^\/studio\/materials\/[a-z0-9-]+\.webp$/.test(path)
    if (!allowed.has(file) && !asset)
      return new Response('Not found', { status: 404 })
    const content = Bun.file((asset ? publicRoot : base) + file)
    if (!(await content.exists()))
      return new Response('Not found', { status: 404 })
    return new Response(content, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
})
console.log(`Terrassea V3: http://localhost:${server.port}/`)
