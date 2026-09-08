import { beforeEach, expect, it, vi } from 'vitest'
import { enrichVisualCatalog } from './visual-repository'
import type { StudioCatalog } from './repository'
import type { StudioProduct } from './types'
const backend = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  selects: [] as string[],
  ranges: [] as number[],
  missing: false,
}))
vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({ isConfigured: true }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: (table: string) => ({
      select: (columns: string) => {
        backend.selects.push(`${table}:${columns}`)
        const q = {
          eq: () => q,
          order: () => q,
          range: (start: number, end: number) => {
            backend.ranges.push(start)
            return Promise.resolve({
              data: (backend.tables[table] ?? []).slice(start, end + 1),
              error: backend.missing ? { message: 'missing view' } : null,
            })
          },
        }
        return q
      },
    }),
  }),
}))
const catalog: StudioCatalog = {
  products: [
    { id: 'a', isActive: true },
    { id: 'b', isActive: true },
    { id: 'inactive', isActive: false },
  ] as StudioProduct[],
  context: { stock: [], options: [] },
  curationSets: [],
  diagnosticPairs: [],
  source: 'db',
}
beforeEach(() => {
  backend.tables = {}
  backend.selects = []
  backend.ranges = []
  backend.missing = false
})
it('pagination au-delà de 1000, whitelist des requêtes, filtre les inactifs et voisins invalides', async () => {
  backend.tables.studio_product_neighbors_public = Array.from(
    { length: 1100 },
    () => ({
      product_id: 'a',
      neighbor_product_id: 'b',
      rank: 1,
      similarity: 0.8,
      model_version: 'test',
    }),
  )
  backend.tables.studio_product_neighbors_public.push(
    {
      product_id: 'inactive',
      neighbor_product_id: 'a',
      rank: 1,
      similarity: 0.8,
      model_version: 'test',
    },
    {
      product_id: 'a',
      neighbor_product_id: 'a',
      rank: 1,
      similarity: 1,
      model_version: 'test',
    },
  )
  const result = await enrichVisualCatalog(catalog)
  expect(result.visual?.neighbors).toHaveLength(1100)
  expect(backend.ranges).toContain(1000)
  expect(backend.selects.join(' ')).not.toMatch(/embedding|validated_by|\*/)
})
it('seules les URLs HTTPS sûres complètent les produits, sans toucher leurs originaux', async () => {
  backend.tables.studio_product_media_public = [
    { product_id: 'a', role: 'decision', url: 'https://example.test/a.webp' },
    { product_id: 'b', role: 'decision', url: 'javascript:alert(1)' },
    { product_id: 'b', role: 'thumb', url: 'broken' },
  ]
  const result = await enrichVisualCatalog(catalog)
  expect(result.products[0]?.decisionImageUrl).toBe(
    'https://example.test/a.webp',
  )
  expect(result.products[1]?.decisionImageUrl).toBeUndefined()
  expect(catalog.products[0]?.decisionImageUrl).toBeUndefined()
})
it('surfaces indisponibles : catalogue conservé, V0 disponible', async () => {
  backend.missing = true
  const result = await enrichVisualCatalog(catalog)
  expect(result.products.map((p) => p.id)).toEqual(
    catalog.products.map((p) => p.id),
  )
  expect(result.visual?.neighbors).toEqual([])
  expect(result.visual?.versions).toEqual([])
})
