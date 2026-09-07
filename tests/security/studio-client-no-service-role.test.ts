// Lot 2 Studio — aucun module Studio livré au navigateur n'importe le client
// admin (service_role) ni ne lit un secret serveur. Seule la route API
// /api/studio/events (serveur) touche getSupabaseAdmin. Garde statique ;
// le scan du build (check-bundle-budget.mjs) complète côté bundle.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const root = process.cwd()
const clientFiles = [
  ...walk(join(root, 'src', 'components', 'studio')),
  ...walk(join(root, 'src', 'lib', 'studio')).filter((file) => !file.endsWith('events-server.ts')),
  ...walk(join(root, 'src', 'hooks')).filter((file) => /useStudio/.test(file)),
  join(root, 'src', 'stores', 'studio.store.ts'),
  ...walk(join(root, 'src', 'routes')).filter((file) => /studio[^/]*\.tsx$/.test(file)),
].filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file))

describe('Studio : aucun service_role côté client', () => {
  it('couvre bien les modules Studio livrés au navigateur', () => {
    expect(clientFiles.length).toBeGreaterThan(20)
    expect(clientFiles.some((file) => file.endsWith('studio.assises.tsx'))).toBe(true)
    expect(clientFiles.some((file) => file.endsWith('events-client.ts'))).toBe(true)
  })

  it.each(clientFiles.map((file) => file.replace(`${root}/`, '')))('%s', (relative) => {
    const source = readFileSync(join(root, relative), 'utf8')
    expect(source).not.toMatch(/@\/lib\/supabase\/admin/)
    expect(source).not.toMatch(/getSupabaseAdmin/)
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role/)
    expect(source).not.toMatch(/STUDIO_PREVIEW_KEY\s*[:=]/)
    expect(source).not.toMatch(/\.select\(\s*['"`]\*['"`]\s*\)/)
  })

  it("la route API est la seule à utiliser le client admin, et n'expose aucun secret", () => {
    const api = readFileSync(join(root, 'src', 'routes', 'api', 'studio', 'events.ts'), 'utf8')
    expect(api).toMatch(/getSupabaseAdmin/)
    expect(api).toMatch(/enforceApiRateLimit/)
    expect(api).toMatch(/isSameOriginRequest/)
    expect(api).toMatch(/parseStudioEventsBatch/)
    expect(api).toMatch(/method !== 'POST'/)
    expect(api).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
  })
})
