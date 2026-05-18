import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getAvailableStockLines } from '@/lib/stock'
import { buildStockRequestDraft } from '@/lib/stock-requests'
import { useStockRequestCreation } from './useStockRequestCreation'

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
    })
  })
})
