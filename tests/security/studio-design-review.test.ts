// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
const launcher = readFileSync('scripts/design-review/start.mjs', 'utf8')
it('le lanceur refuse le mode production avant de lancer un serveur', () => {
  let result: unknown
  try {
    execFileSync('bun', ['scripts/design-review/start.mjs'], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe',
    })
  } catch (e) {
    result = e
  }
  expect(result).toMatchObject({ status: 1 })
  expect(String((result as { stderr: Buffer }).stderr)).toContain(
    'Design review is development only',
  )
})
it('démo limitée à loopback, Supabase local, mutations et analytics neutralisés', () => {
  expect(launcher).toContain("hostname: '127.0.0.1'")
  expect(launcher).toContain('VITE_SUPABASE_URL: origin')
  expect(launcher).toContain("SUPABASE_SERVICE_ROLE_KEY: ''")
  expect(launcher).toContain("VITE_PLAUSIBLE_DOMAIN: ''")
  expect(launcher).toContain("VITE_GTM_ID: ''")
  expect(launcher).toContain("url.pathname.startsWith('/_serverFn')")
  expect(launcher).toContain('writes disabled')
})
it('aucun import du mode de revue dans le code applicatif', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    )
  for (const file of walk('src').filter(
    (f) => /\.(ts|tsx)$/.test(f) && !f.includes('.test.'),
  ))
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /scripts\/design-review|seedReviewProject|__design\/project|design-review-local-only/,
    )
})
