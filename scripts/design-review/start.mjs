/* global Bun, URL, process, console, Response, Headers, setTimeout, fetch */
// Standalone loopback-only development server. Never imported by the app or its build.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { reviewRows, seedReviewProject } from './fixtures.mjs'
if (process.env.NODE_ENV === 'production')
  throw new Error('Design review is development only')
const root = fileURLToPath(new URL('../../', import.meta.url))
const port = Number(process.env.DESIGN_REVIEW_PORT ?? 5190)
if (!Number.isInteger(port) || port < 1024 || port > 65000)
  throw new Error('Invalid local review port')
const vitePort = port + 1
const origin = `http://localhost:${port}`
const child = spawn(
  'bunx',
  ['vite', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_STUDIO_ENABLED: 'true',
      VITE_SUPABASE_URL: origin,
      VITE_SUPABASE_ANON_KEY: 'design-review-local-only',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      VITE_PLAUSIBLE_DOMAIN: '',
      VITE_GTM_ID: '',
    },
  },
)
child.stdout.on('data', () => {})
child.stderr.on('data', () => {})
child.on('exit', (code) => {
  if (code) {
    console.error(
      'Le serveur local Vite ne peut pas démarrer (port occupé ou erreur de configuration).',
    )
    process.exit(code)
  }
})
let ready = false
for (let n = 0; n < 40; n++) {
  try {
    const r = await fetch(`http://127.0.0.1:${vitePort}/@vite/client`)
    if (r.ok) {
      ready = true
      break
    }
  } catch {
    /* Vite is starting. */
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}
if (!ready) {
  child.kill()
  throw new Error('Local Vite did not start')
}
const seed = `(${seedReviewProject.toString()})();`
const composed = `localStorage.removeItem('terrassea-studio-v1');${seed}const p=JSON.parse(localStorage.getItem('terrassea-studio-v1'));const key=(id)=>JSON.stringify([JSON.stringify(['seat',id,id+'-std']),'seat',id]);p.state.project.customization={ [key('seat-0')]:[{kind:'weave_pattern',value:'PI-TR-007',note:'',requested:true,visual:{public_ref:'PI-TR-007',weave_colors:['Bleu','Ivoire']}},{kind:'structure_color',value:'Ivoire souhaité',note:'',requested:true}], [key('seat-1')]:[{kind:'rope_color',value:'PI-RP-060',note:'',requested:true,visual:{public_ref:'PI-RP-060',weave_colors:[]}}]};localStorage.setItem('terrassea-studio-v1',JSON.stringify(p));`
const empty = `localStorage.removeItem('terrassea-studio-v1');${seed}const p=JSON.parse(localStorage.getItem('terrassea-studio-v1'));p.state.project.items=[];p.state.project.tables=[];delete p.state.project.customization;localStorage.setItem('terrassea-studio-v1',JSON.stringify(p));`
const toolbar = `<aside id="local-design-review" aria-label="Revue locale" style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#20282d;color:#fff;display:flex;justify-content:center;align-items:center;gap:16px;padding:8px 12px;font:11px/1.4 sans-serif;flex-wrap:wrap;border-top:1px solid #68757c"><b>DÉMO · DONNÉES TEST · AUCUN ENVOI RÉEL</b><a style="color:#e1ec82" href="/">Accueil</a><a style="color:#e1ec82" href="/studio">Studio</a><a style="color:#e1ec82" href="/studio/personnalisation">Atelier</a><a style="color:#e1ec82" href="/__design/project">Projet composé</a><a style="color:#e1ec82" href="/__design/reset">Recommencer</a></aside>`
let server
try {
  server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    idleTimeout: 60,
    async fetch(req) {
      const url = new URL(req.url)
      if (
        url.pathname === '/__design/project' ||
        url.pathname === '/__design/reset'
      )
        return new Response(
          `<html><head><meta charset="utf-8"><meta name="robots" content="noindex"></head><body><script>(()=>{${url.pathname.endsWith('project') ? composed : empty}location.replace('${url.pathname.endsWith('project') ? '/studio/personnalisation' : '/studio'}')})()</script></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      if (url.pathname.startsWith('/rest/v1/'))
        return Response.json(reviewRows(url.pathname.split('/').pop()))
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))
        return Response.json({ ok: true, demo: true })
      if (url.pathname.startsWith('/_serverFn'))
        return new Response(
          'Server functions disabled in local design review',
          {
            status: 403,
          },
        )
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return new Response('Local design review: writes disabled', {
          status: 403,
        })
      if (req.headers.get('upgrade'))
        return new Response('Connect to the local Vite HMR port', {
          status: 426,
        })
      const upstream = await fetch(
        `http://127.0.0.1:${vitePort}${url.pathname}${url.search}`,
        { method: req.method, redirect: 'manual' },
      )
      const headers = new Headers(upstream.headers)
      headers.delete('content-encoding')
      headers.delete('content-length')
      if (url.pathname === '/@vite/client')
        return new Response(
          (await upstream.text()).replace(
            'const hmrPort = null;',
            `const hmrPort = ${vitePort};`,
          ),
          { headers },
        )
      if (
        (headers.get('content-type') ?? '').includes('text/html') &&
        req.method === 'GET'
      ) {
        const html = (await upstream.text())
          .replace('<head>', `<head><script>${seed}</script>`)
          .replace('</body>', `${toolbar}</body>`)
        headers.set('X-Robots-Tag', 'noindex, nofollow')
        return new Response(html, { status: upstream.status, headers })
      }
      return new Response(upstream.body, { status: upstream.status, headers })
    },
  })
} catch (error) {
  child.kill()
  throw error
}
const stop = () => {
  server.stop(true)
  child.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
console.log(`Revue locale Pros Import : ${origin}/`)
console.log(
  'Données synthétiques. Formulaires interceptés. Aucune connexion DB distante. Ctrl+C pour arrêter.',
)
