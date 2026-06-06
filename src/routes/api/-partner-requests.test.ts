import { describe, expect, it, vi } from 'vitest'

import type { PartnerSubmissionRepositoryClient } from '@/lib/partners/repository'

import { handleCreatePartnerRequest } from './partner-requests'

function createRequest(body: unknown): Request {
  return new Request('https://container-club.test/api/partner-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createClient() {
  const appSingle = vi.fn(async () => ({
    data: { id: 'application-id', status: 'new' as const },
    error: null,
  }))
  const dealSingle = vi.fn(async () => ({
    data: { id: 'deal-id', status: 'submitted' as const },
    error: null,
  }))

  const appInsert = vi.fn(() => ({
    select: vi.fn(() => ({ single: appSingle })),
  }))
  const dealInsert = vi.fn(() => ({
    select: vi.fn(() => ({ single: dealSingle })),
  }))
  const from = vi.fn((table: 'partner_applications' | 'partner_deals') => {
    if (table === 'partner_applications') return { insert: appInsert }
    return { insert: dealInsert }
  })

  return {
    client: { from } as unknown as PartnerSubmissionRepositoryClient,
    appInsert,
    dealInsert,
  }
}

const validBase = {
  partnerKind: 'reseller',
  companyName: 'CHR Conseil',
  contactName: 'Claire Martin',
  contactEmail: 'CLAIRE@CHR-CONSEIL.FR',
  contactPhone: '+33 6 00 00 00 00',
  siret: '12345678900011',
  territory: 'Bretagne',
  expectedMonthlyVolume: '1 container par trimestre',
  message: 'Nous équipons des restaurants de bord de mer.',
} as const

describe('partner request API route', () => {
  it('persists a partner application', async () => {
    const { client, appInsert, dealInsert } = createClient()

    const response = await handleCreatePartnerRequest(
      createRequest({
        mode: 'application',
        ...validBase,
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: true,
      persisted: true,
      mode: 'application',
      application: { id: 'application-id', status: 'new' },
      deal: null,
    })
    expect(response.status).toBe(201)
    expect(appInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'CHR Conseil',
        contact_email: 'claire@chr-conseil.fr',
        partner_kind: 'reseller',
        source: 'partners_page',
      }),
    )
    expect(dealInsert).not.toHaveBeenCalled()
  })

  it('persists a partner deal and links it to the application', async () => {
    const { client, dealInsert } = createClient()

    const response = await handleCreatePartnerRequest(
      createRequest({
        mode: 'deal',
        ...validBase,
        clientCompanyName: 'Restaurant Atlantique',
        clientSiret: '55208131701750',
        projectCity: 'Nantes',
        projectType: 'Terrasse 120 places',
        expectedBudgetHt: 18000,
        productInterest: 'Chaises empilables et tables compactes',
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: true,
      persisted: true,
      mode: 'deal',
      application: { id: 'application-id', status: 'new' },
      deal: { id: 'deal-id', status: 'submitted' },
    })
    expect(response.status).toBe(201)
    expect(dealInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: 'application-id',
        partner_company_name: 'CHR Conseil',
        partner_contact_email: 'claire@chr-conseil.fr',
        client_company_name: 'Restaurant Atlantique',
        client_siret: '55208131701750',
        protection_days: 120,
      }),
    )
  })

  it('rejects incomplete deal registrations before persistence', async () => {
    const { client, appInsert, dealInsert } = createClient()

    const response = await handleCreatePartnerRequest(
      createRequest({
        mode: 'deal',
        ...validBase,
        projectType: 'Terrasse 120 places',
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Société client obligatoire',
    })
    expect(response.status).toBe(400)
    expect(appInsert).not.toHaveBeenCalled()
    expect(dealInsert).not.toHaveBeenCalled()
  })

  it('rejects browser posts from another origin', async () => {
    const { client, appInsert } = createClient()

    const response = await handleCreatePartnerRequest(
      new Request('https://container-club.test/api/partner-requests', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://malicious.example',
        },
        body: JSON.stringify({ mode: 'application', ...validBase }),
      }),
      client,
    )

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Forbidden origin',
    })
    expect(response.status).toBe(403)
    expect(appInsert).not.toHaveBeenCalled()
  })

  it('rejects non-POST requests', async () => {
    const { client } = createClient()

    const response = await handleCreatePartnerRequest(
      new Request('https://container-club.test/api/partner-requests'),
      client,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
