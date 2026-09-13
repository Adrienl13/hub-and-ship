/* global Bun, process, Response, URL, console */
// Standalone development preview: loopback only, read-only, no app/DB environment.
import { fileURLToPath } from 'node:url'
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
    if (path === '/catalogue')
      return Response.redirect('http://localhost:5190/catalogue', 302)
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
