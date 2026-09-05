import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAvailableStockLines } from '@/lib/stock'
import { buildStockRequestDraft } from '@/lib/stock-requests'
import { useStockRequestCreation } from './useStockRequestCreation'

// Client navigateur factice : l'insert direct échoue toujours (RLS/CHECK),
// ce qui reproduit le cas « site configuré, rien d'enregistré ». Le test
// non configuré ne l'instancie jamais.
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: null,
            error: { message: 'RLS denied' },
          }),
        }),
      }),
    }),
  }),
}))

function createDraft() {
  const line = getAvailableStockLines()[0]
  if (!line) throw new Error('Missing stock fixture')

  const result = buildStockRequestDraft({
    line,
    companyName: 'Hotel Demo',
    contactEmail: 'direction@hotel-demo.fr',
    contactPhone: '+33 6 12 34 56 78',
    requestedQuantity: 20,
    now: new Date('2026-05-18T18:00:00.000Z'),
  })

  if (!result.ok) throw new Error('Invalid stock request fixture')
  return result.draft
}

describe('useStockRequestCreation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('stores a non-persisted request locally until Supabase env keys are present', async () => {
    const { result } = renderHook(() => useStockRequestCreation())

    expect(result.current.isConfigured).toBe(false)
    await expect(
      result.current.createStockRequest(createDraft()),
    ).resolves.toEqual({
      ok: true,
      persisted: false,
      request: {
        localId: 'stock-stock-cannes-noir-20260518180000',
        status: 'new',
      },
      fallbackReason:
        'Supabase public non configuré et route serveur indisponible.',
    })
  })

  // Site configuré : route serveur KO (503) + insert navigateur KO → échec
  // visible, plus de « succès local » qui perdait le lead.
  it('reports a visible failure when Supabase is configured but nothing persisted', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { result } = renderHook(() => useStockRequestCreation())

    expect(result.current.isConfigured).toBe(true)
    await expect(
      result.current.createStockRequest(createDraft()),
    ).resolves.toEqual({ ok: false, error: 'RLS denied' })
  })
})
