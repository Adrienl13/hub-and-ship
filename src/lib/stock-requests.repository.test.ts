import { describe, expect, it, vi } from 'vitest'

import { getAvailableStockLines } from './stock'
import { buildStockRequestDraft } from './stock-requests'
import { createStockRequestInSupabase } from './stock-requests.repository'

function createDraft() {
  const line = getAvailableStockLines()[0]
  if (!line) throw new Error('Missing stock fixture')

  const result = buildStockRequestDraft({
    line,
    companyName: 'Hotel Demo',
    contactEmail: 'direction@hotel-demo.fr',
    contactPhone: '+33 6 12 34 56 78',
    requestedQuantity: 20,
  })

  if (!result.ok) throw new Error('Invalid stock draft fixture')
  return result.draft
}

describe('stock request repository', () => {
  it('inserts a stock request and returns the created id', async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: 'stock-request-id', status: 'new' as const },
          error: null,
        })),
      })),
    }))
    const client = {
      from: vi.fn((table: 'stock_requests') => {
        expect(table).toBe('stock_requests')
        return { insert }
      }),
    }

    await expect(
      createStockRequestInSupabase({ client, draft: createDraft() }),
    ).resolves.toEqual({ id: 'stock-request-id', status: 'new' })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        stock_line_id: 'stock-cannes-noir',
        company_name: 'Hotel Demo',
      }),
    )
  })

  it('throws a clear error when Supabase rejects the insert', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { message: 'RLS denied' },
            })),
          })),
        })),
      })),
    }

    await expect(
      createStockRequestInSupabase({ client, draft: createDraft() }),
    ).rejects.toThrow('RLS denied')
  })
})
