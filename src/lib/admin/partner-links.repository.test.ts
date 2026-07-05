import { describe, expect, it, vi } from 'vitest'

import {
  linkUserToPartner,
  listLinkableApplications,
  listPartnerLinks,
  unlinkUserFromPartner,
  type PartnerLinksClient,
} from './partner-links.repository'

describe('listPartnerLinks', () => {
  it('flattens the embedded application company name (object or array)', async () => {
    const select = vi.fn(async () => ({
      data: [
        {
          user_id: 'u1',
          partner_application_id: 'a1',
          role: 'owner',
          partner_applications: { company_name: 'CHR Conseil' },
        },
        {
          user_id: 'u2',
          partner_application_id: 'a2',
          role: 'member',
          partner_applications: [{ company_name: 'Sud CHR' }],
        },
      ],
      error: null,
    }))
    const client = {
      from: () => ({ select }),
    } as unknown as PartnerLinksClient

    const links = await listPartnerLinks(client)
    expect(links).toEqual([
      { userId: 'u1', applicationId: 'a1', role: 'owner', companyName: 'CHR Conseil' },
      { userId: 'u2', applicationId: 'a2', role: 'member', companyName: 'Sud CHR' },
    ])
  })
})

describe('listLinkableApplications', () => {
  it('queries qualified/approved apps and maps them', async () => {
    const order = vi.fn(async () => ({
      data: [{ id: 'a1', company_name: 'CHR Conseil', status: 'approved' }],
      error: null,
    }))
    const inFn = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ in: inFn }))
    const client = { from: () => ({ select }) } as unknown as PartnerLinksClient

    const apps = await listLinkableApplications(client)
    expect(inFn).toHaveBeenCalledWith('status', ['qualified', 'approved'])
    expect(apps).toEqual([{ id: 'a1', companyName: 'CHR Conseil' }])
  })
})

describe('link / unlink', () => {
  it('inserts a link with owner role', async () => {
    const insert = vi.fn(async () => ({ data: null, error: null }))
    const client = { from: () => ({ insert }) } as unknown as PartnerLinksClient
    await linkUserToPartner(client, 'u1', 'a1')
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1',
      partner_application_id: 'a1',
      role: 'owner',
    })
  })

  it('deletes a link by both keys', async () => {
    const eq2 = vi.fn(async () => ({ data: null, error: null }))
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    const del = vi.fn(() => ({ eq: eq1 }))
    const client = { from: () => ({ delete: del }) } as unknown as PartnerLinksClient
    await unlinkUserFromPartner(client, 'u1', 'a1')
    expect(eq1).toHaveBeenCalledWith('user_id', 'u1')
    expect(eq2).toHaveBeenCalledWith('partner_application_id', 'a1')
  })
})
