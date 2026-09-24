import { describe, expect, it, vi } from 'vitest'

import {
  ADMIN_CLAIMS_SELECT,
  listAllClaims,
  toAdminClaimRow,
  updateClaim,
  type AdminClaimsClient,
} from './admin-claims.repository'

// Réclamation brute avec sa réservation jointe, sans donnée client réelle.
const RAW_CLAIM = {
  id: 'claim-1',
  reservation_id: 'res-1',
  category: 'damaged',
  status: 'open',
  quantity: 2,
  message: 'Deux chaises rayées à la livraison',
  admin_response: null,
  created_at: '2026-09-21T09:00:00.000Z',
  updated_at: '2026-09-21T09:00:00.000Z',
  reservations: {
    reference: 'TR-2026-0001',
    siret: '00000000000000',
    contact_snapshot: {
      name: 'Contact Test',
      company: 'Établissement Test',
      email: 'test@example.com',
      phone: '+33 6 00 00 00 00',
    },
  },
}

describe('toAdminClaimRow', () => {
  it('joins the reservation contact snapshot', () => {
    const row = toAdminClaimRow(RAW_CLAIM as never)

    expect(row.reservationReference).toBe('TR-2026-0001')
    expect(row.reservationSiret).toBe('00000000000000')
    expect(row.companyName).toBe('Établissement Test')
    expect(row.contactName).toBe('Contact Test')
    expect(row.contactEmail).toBe('test@example.com')
    expect(row.contactPhone).toBe('+33 6 00 00 00 00')
  })

  it('accepts the array shape of an embedded relation', () => {
    const row = toAdminClaimRow({
      ...RAW_CLAIM,
      reservations: [RAW_CLAIM.reservations],
    } as never)

    expect(row.reservationReference).toBe('TR-2026-0001')
    expect(row.contactEmail).toBe('test@example.com')
  })

  it('falls back to nulls when the reservation or snapshot is missing', () => {
    const noRel = toAdminClaimRow({ ...RAW_CLAIM, reservations: null } as never)
    expect(noRel.reservationReference).toBeNull()
    expect(noRel.companyName).toBeNull()
    expect(noRel.contactPhone).toBeNull()

    const emptySnapshot = toAdminClaimRow({
      ...RAW_CLAIM,
      reservations: { reference: 'TR-2', siret: null, contact_snapshot: null },
    } as never)
    expect(emptySnapshot.reservationReference).toBe('TR-2')
    expect(emptySnapshot.reservationSiret).toBeNull()
    expect(emptySnapshot.contactName).toBeNull()
  })
})

describe('listAllClaims', () => {
  it('requests the reservation join and maps the rows', async () => {
    const select = vi.fn(() => ({
      order: () => ({
        limit: () => Promise.resolve({ data: [RAW_CLAIM], error: null }),
      }),
    }))
    const from = vi.fn(() => ({ select }))
    const client = { from } as unknown as AdminClaimsClient

    const rows = await listAllClaims(client)

    expect(from).toHaveBeenCalledWith('reservation_claims')
    expect(select).toHaveBeenCalledWith(ADMIN_CLAIMS_SELECT)
    expect(ADMIN_CLAIMS_SELECT).toContain('contact_snapshot')
    expect(rows[0]?.companyName).toBe('Établissement Test')
  })

  it('propagates Supabase errors', async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({ data: null, error: { message: 'RLS denied' } }),
          }),
        }),
      }),
    } as unknown as AdminClaimsClient

    await expect(listAllClaims(client)).rejects.toThrow('RLS denied')
  })
})

describe('updateClaim', () => {
  it('trims the response and clears it when empty', async () => {
    const payloads: Array<Record<string, unknown>> = []
    const client = {
      from: () => ({
        update: (payload: Record<string, unknown>) => ({
          eq: () => {
            payloads.push(payload)
            return Promise.resolve({ data: null, error: null })
          },
        }),
      }),
    } as unknown as AdminClaimsClient

    await updateClaim(client, 'claim-1', {
      status: 'in_review',
      adminResponse: '  Pièces renvoyées  ',
    })
    await updateClaim(client, 'claim-1', { adminResponse: '   ' })

    expect(payloads[0]).toMatchObject({
      status: 'in_review',
      admin_response: 'Pièces renvoyées',
    })
    expect(payloads[1]?.admin_response).toBeNull()
    expect(payloads[1]?.status).toBeUndefined()
  })
})
