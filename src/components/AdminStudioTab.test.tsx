import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AdminStudioTab } from './AdminStudioTab'
const mock = vi.hoisted(() => ({
  writes: [] as { table: string; values: Record<string, unknown> }[],
  media: [
    {
      id: 'image',
      product_id: 'a',
      role: 'decision',
      url: 'https://example.test/decision.webp',
      source_url: 'https://example.test/source.png',
      source_hash: 'hash',
      quality_score: 0.8,
      pipeline_version: 'decision-v1',
      status: 'pending',
    },
  ],
}))
vi.mock('@/lib/supabase/env', () => ({ getSupabasePublicConfig: () => ({}) }))
vi.mock('@/lib/studio/repository', () => ({
  fetchStudioCatalog: async () => ({ products: [{ id: 'a' }] }),
}))
vi.mock('@/lib/studio/discovery', () => ({ isDiscoverySeat: () => true }))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-test' } } }) },
    from: (table: string) => ({
      select: () => ({
        range: async () => ({
          data:
            table === 'studio_product_media'
              ? mock.media
              : table === 'products'
                ? [{ id: 'a', name: 'Assise A' }]
                : [],
          error: null,
        }),
      }),
      update: (values: Record<string, unknown>) => {
        const q = {
          eq: () => q,
          then: (resolve: (v: unknown) => void) => {
            mock.writes.push({ table, values })
            resolve({ data: [], error: null })
          },
        }
        return q
      },
      insert: async (values: Record<string, unknown>) => {
        mock.writes.push({ table, values })
        return { data: [], error: null }
      },
    }),
  }),
}))
beforeEach(() => {
  mock.writes = []
})
it('affiche source et normalisée sans publier automatiquement ; validation explicite admin', async () => {
  render(<AdminStudioTab />)
  expect(await screen.findByAltText('Source')).toHaveAttribute(
    'src',
    'https://example.test/source.png',
  )
  expect(screen.getByAltText('Decision Image normalisée')).toHaveAttribute(
    'src',
    'https://example.test/decision.webp',
  )
  expect(mock.writes).toEqual([])
  fireEvent.click(
    screen.getByRole('button', { name: 'Valider l’image et sa vignette' }),
  )
  await waitFor(() => expect(mock.writes).toHaveLength(1))
  expect(mock.writes[0]?.values).toMatchObject({
    status: 'validated',
    validated_by: 'admin-test',
    rejected_reason: null,
  })
  expect(mock.writes[0]?.table).toBe('studio_product_media')
})
it('relancer crée seulement une demande offline, ne modifie aucun produit', async () => {
  render(<AdminStudioTab />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Relancer hors ligne' }),
  )
  await waitFor(() =>
    expect(mock.writes).toEqual([
      { table: 'studio_visual_jobs', values: { product_id: 'a' } },
    ]),
  )
})
