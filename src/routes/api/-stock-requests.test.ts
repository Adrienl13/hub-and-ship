import { describe, expect, it, vi } from 'vitest'

import { handleCreateStockRequest } from './stock-requests'

function createRequest(body: unknown): Request {
  return new Request('https://container-club.test/api/stock-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createClient() {
  const single = vi.fn(async () => ({
    data: { id: 'stock-request-id', status: 'new' as const },
    error: null,
  }))
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn((table: 'stock_requests') => {
    expect(table).toBe('stock_requests')
    return { insert }
  })

  return {
    client: { from },
    insert,
  }
}

describe('stock request API route', () => {
  it('rebuilds and persists a stock request from the stock line id', async () => {
    const { client, insert } = createClient()

    const response = await handleCreateStockRequest(
      createRequest({
        stockLineId: 'stock-cannes-noir',
        companyName: 'Restaurant Audit',
        contactEmail: 'ACHAT@RESTAURANT-AUDIT.FR',
        contactPhone: '+33 6 00 00 00 00',
        requestedQuantity: 999,
        customerNote: 'Besoin terrasse immédiat.',
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: true,
      persisted: true,
      request: { id: 'stock-request-id', status: 'new' },
    })
    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        stock_line_id: 'stock-cannes-noir',
        product_name: 'Chaise Cannes Empilable',
        requested_quantity: 86,
        estimated_total_ht: 9374,
        contact_email: 'achat@restaurant-audit.fr',
      }),
    )
  })

  it('rejects unknown stock lines before persistence', async () => {
    const { client, insert } = createClient()

    const response = await handleCreateStockRequest(
      createRequest({
        stockLineId: 'missing-line',
        companyName: 'Restaurant Audit',
        contactEmail: 'achat@restaurant-audit.fr',
        contactPhone: '+33 6 00 00 00 00',
        requestedQuantity: 12,
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Stock line not found',
    })
    expect(response.status).toBe(404)
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns a controlled 503 when persistence fails', async () => {
    const single = vi.fn(async () => ({
      data: null,
      error: { message: 'service role missing' },
    }))
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single })),
        })),
      })),
    }
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const response = await handleCreateStockRequest(
      createRequest({
        stockLineId: 'stock-cannes-noir',
        companyName: 'Restaurant Audit',
        contactEmail: 'achat@restaurant-audit.fr',
        contactPhone: '+33 6 00 00 00 00',
        requestedQuantity: 12,
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'service role missing',
    })
    expect(response.status).toBe(503)

    consoleError.mockRestore()
  })

  it('rejects browser posts from another origin', async () => {
    const { client, insert } = createClient()

    const response = await handleCreateStockRequest(
      new Request('https://container-club.test/api/stock-requests', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://malicious.example',
        },
        body: JSON.stringify({
          stockLineId: 'stock-cannes-noir',
          companyName: 'Restaurant Audit',
          contactEmail: 'achat@restaurant-audit.fr',
          contactPhone: '+33 6 00 00 00 00',
          requestedQuantity: 12,
        }),
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Forbidden origin',
    })
    expect(response.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects non-POST requests', async () => {
    const { client } = createClient()

    const response = await handleCreateStockRequest(
      new Request('https://container-club.test/api/stock-requests'),
      client,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
