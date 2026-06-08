import { describe, expect, it, vi } from 'vitest'

import {
  issueInvoice,
  listInvoicesForReservation,
  toInvoice,
  type InvoicesClient,
} from './invoices'

const row = {
  id: 'i1',
  reservation_id: 'r1',
  number: 'FAC-000001',
  status: 'issued' as const,
  currency: 'EUR',
  subtotal_ht: '1000.00',
  vat_rate: '20.00',
  vat_amount: '200.00',
  total_ttc: '1200.00',
  issued_at: '2026-06-08T10:00:00Z',
  snapshot: { reference: 'CC-1', siret: '12345678901234' },
}

describe('toInvoice', () => {
  it('maps and coerces numeric strings', () => {
    const invoice = toInvoice(row)
    expect(invoice).toMatchObject({
      id: 'i1',
      reservationId: 'r1',
      number: 'FAC-000001',
      subtotalHt: 1000,
      vatRate: 20,
      vatAmount: 200,
      totalTtc: 1200,
    })
    expect(invoice.snapshot.reference).toBe('CC-1')
  })
})

describe('issueInvoice', () => {
  it('calls the RPC and returns the mapped invoice', async () => {
    const rpc = vi.fn(async () => ({ data: row, error: null }))
    const client = { rpc } as unknown as InvoicesClient
    const invoice = await issueInvoice(client, 'r1')
    expect(rpc).toHaveBeenCalledWith('issue_reservation_invoice', {
      p_reservation_id: 'r1',
    })
    expect(invoice.number).toBe('FAC-000001')
  })

  it('throws on RPC error', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'admin only' } }))
    const client = { rpc } as unknown as InvoicesClient
    await expect(issueInvoice(client, 'r1')).rejects.toThrow('admin only')
  })
})

describe('listInvoicesForReservation', () => {
  it('maps rows', async () => {
    const order = vi.fn(async () => ({ data: [row], error: null }))
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ order }) }) }),
    } as unknown as InvoicesClient
    const invoices = await listInvoicesForReservation(client, 'r1')
    expect(invoices).toHaveLength(1)
    expect(invoices[0]?.number).toBe('FAC-000001')
  })
})
