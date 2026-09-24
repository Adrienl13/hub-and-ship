import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AdminStudioTab } from './AdminStudioTab'
const mock = vi.hoisted(() => ({
  writes: [] as { table: string; values: Record<string, unknown> }[],
  /** Simule les migrations du module visuel non appliquées en production. */
  visualMissing: false,
  events: [] as Record<string, unknown>[],
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
      select: () => {
        // La lecture d'usage enchaîne .order().order().range() ; le reste de
        // l'onglet appelle .range() directement.
        const query = {
          order: () => query,
          range: async () => {
            if (
              mock.visualMissing &&
              table.startsWith('studio_product_media')
            ) {
              return {
                data: null,
                error: {
                  message: `Could not find the table 'public.${table}' in the schema cache`,
                },
              }
            }
            return {
              data:
                table === 'studio_product_media'
                  ? mock.media
                  : table === 'products'
                    ? [{ id: 'a', name: 'Assise A' }]
                    : table === 'studio_sessions'
                      ? [
                          {
                            id: 'session-1',
                            created_at: '2026-09-22T09:00:00Z',
                          },
                        ]
                      : table === 'studio_events'
                        ? mock.events
                        : [],
              error: null,
            }
          },
        }
        return query
      },
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
  mock.visualMissing = false
  mock.events = []
})
it('sans les tables du module visuel, l’onglet reste utilisable et l’annonce', async () => {
  mock.visualMissing = true
  render(<AdminStudioTab />)
  expect(
    await screen.findByText('Module visuel non activé (migration à appliquer)'),
  ).toBeInTheDocument()
  // Les autres sections continuent de vivre : usage et compatibilité.
  expect(
    await screen.findByRole('region', { name: 'Usage du Studio' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByAltText('Source')).toBeNull()
})
it('affiche l’usage du Studio : sessions, décisions, produits aimés et refusés', async () => {
  mock.events = [
    { session_id: 'session-1', event_type: 'card_liked', product_id: 'a' },
    { session_id: 'session-1', event_type: 'card_liked', product_id: 'a' },
    { session_id: 'session-1', event_type: 'card_disliked', product_id: 'a' },
    { session_id: 'session-1', event_type: 'card_passed', product_id: null },
    {
      session_id: 'session-1',
      event_type: 'finalists_viewed',
      product_id: null,
    },
  ]
  render(<AdminStudioTab />)
  const usage = await screen.findByRole('region', { name: 'Usage du Studio' })
  await waitFor(() => expect(usage).toHaveTextContent('2 / 1 / 1'))
  expect(usage).toHaveTextContent('Décisions (j’aime / pas pour moi / passer)')
  expect(usage).toHaveTextContent('1 · 100 %')
  // Les semaines sont datées au format admin jj/mm/aaaa.
  expect(usage).toHaveTextContent(/Semaine du \d{2}\/\d{2}\/\d{4}/)
  expect(usage).toHaveTextContent('Top 10 produits aimés')
  expect(usage).toHaveTextContent('Assise A')
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
