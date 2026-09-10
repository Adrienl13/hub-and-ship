// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { loadVisualLibrary } from './visual-library-repository'
const mock = vi.hoisted(() => ({ fail: true }))
vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({ isConfigured: true }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      select: (columns: string) => {
        expect(columns).not.toContain('*')
        const q = {
          order: () => q,
          range: async () => ({ data: [], error: mock.fail ? {} : null }),
        }
        return q
      },
    }),
  }),
}))
const rows = JSON.parse(
  readFileSync('public/studio/materials/library.json', 'utf8'),
)
afterEach(() => {
  vi.unstubAllGlobals()
  mock.fail = true
})
it('repli public sans aucune association lorsque la base est indisponible', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => rows }),
  )
  expect(await loadVisualLibrary()).toMatchObject({
    source: 'snapshot',
    associations: [],
    items: rows,
  })
})
it('une base vide est autoritaire et ne réactive pas le snapshot', async () => {
  mock.fail = false
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  expect(await loadVisualLibrary()).toEqual({
    source: 'database',
    associations: [],
    items: [],
  })
  expect(fetch).not.toHaveBeenCalled()
})
it('une surface publique enrichie de données privées est refusée', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => [{ ...rows[0], factory_ref: 'private' }],
      }),
  )
  expect(await loadVisualLibrary()).toEqual({
    source: 'unavailable',
    associations: [],
    items: [],
  })
})
it('302 images web sans métadonnées privées ni original embarqué', async () => {
  for (const row of rows)
    for (const path of [row.thumbnail, row.image]) {
      const metadata = await sharp(`public${path}`).metadata()
      expect(metadata.format).toBe('webp')
      expect(metadata.exif).toBeUndefined()
      expect(metadata.xmp).toBeUndefined()
      expect(metadata.iptc).toBeUndefined()
      expect(metadata.icc).toBeUndefined()
    }
})
