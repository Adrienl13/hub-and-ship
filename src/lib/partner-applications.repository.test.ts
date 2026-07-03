import { describe, expect, it, vi } from 'vitest'

import { buildPartnerApplicationDraft } from './partner-applications'
import {
  createPartnerApplicationInSupabase,
  type PartnerApplicationRepositoryClient,
} from './partner-applications.repository'

function createDraft() {
  const result = buildPartnerApplicationDraft({
    companyName: 'Distri Boissons Provence',
    siret: '55208131701750',
    contactName: 'Marie Martin',
    email: 'contact@distri-provence.fr',
    phone: '06 12 34 56 78',
    activityProfile: 'brasseur',
    targetStatus: 'apporteur',
    now: new Date('2026-07-02T10:00:00.000Z'),
  })
  if (!result.ok) throw new Error('expected valid draft')
  return result.draft
}

describe('createPartnerApplicationInSupabase', () => {
  it('inserts with the client-side id and merges attribution', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as PartnerApplicationRepositoryClient

    const result = await createPartnerApplicationInSupabase({
      client,
      draft: createDraft(),
      id: '00000000-0000-4000-8000-0000000000aa',
      attribution: {
        utm_source: 'partner',
        utm_medium: 'qr',
        utm_campaign: 'corner_depot',
        partner_ref: 'DBP-13',
      },
    })

    expect(result).toEqual({
      id: '00000000-0000-4000-8000-0000000000aa',
      status: 'new',
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-0000000000aa',
        company_name: 'Distri Boissons Provence',
        siret_verified: false,
        utm_source: 'partner',
        partner_ref: 'DBP-13',
      }),
    )
  })

  it('defaults attribution to null columns when none provided', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as PartnerApplicationRepositoryClient

    await createPartnerApplicationInSupabase({
      client,
      draft: createDraft(),
      id: '00000000-0000-4000-8000-0000000000bb',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ utm_source: null, partner_ref: null }),
    )
  })

  it('throws a clear error when the insert fails', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'RLS denied insert' },
        }),
      })),
    } as unknown as PartnerApplicationRepositoryClient

    await expect(
      createPartnerApplicationInSupabase({
        client,
        draft: createDraft(),
        id: '00000000-0000-4000-8000-0000000000cc',
      }),
    ).rejects.toThrow('RLS denied insert')
  })
})
