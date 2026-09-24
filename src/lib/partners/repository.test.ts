import { describe, expect, it, vi } from 'vitest'

import {
  describePartnerApplicationOrigin,
  listPartnerApplications,
  partnerActivityProfileLabel,
  partnerTargetStatusLabel,
  toApplicationAdminRow,
  toDealAdminRow,
  updatePartnerApplicationNote,
  updatePartnerApplicationSlug,
  updatePartnerDealNote,
  updatePartnerDealSlug,
  type PartnerAdminRepositoryClient,
} from './repository'

interface CapturedUpdate {
  table: string
  payload: Record<string, unknown>
  id: string
}

function createAdminClient(error: { message: string } | null = null): {
  client: PartnerAdminRepositoryClient
  updates: CapturedUpdate[]
} {
  const updates: CapturedUpdate[] = []
  const from = vi.fn((table: string) => ({
    update: (payload: Record<string, unknown>) => ({
      eq: (_column: 'id', id: string) => {
        updates.push({ table, payload, id })
        return Promise.resolve({ data: null, error })
      },
    }),
  }))

  return {
    client: { from } as unknown as PartnerAdminRepositoryClient,
    updates,
  }
}

function firstUpdate(updates: CapturedUpdate[]): CapturedUpdate {
  const update = updates[0]
  if (!update) throw new Error('expected at least one captured update')
  return update
}

describe('partner referral slug updates', () => {
  it('normalizes a free-text slug before persisting it', async () => {
    const { client, updates } = createAdminClient()

    const result = await updatePartnerApplicationSlug(
      client,
      'app-1',
      'CHR Conseil!!',
    )

    expect(result).toBe('chr-conseil')
    expect(updates).toHaveLength(1)
    expect(firstUpdate(updates)).toMatchObject({
      table: 'partner_applications',
      id: 'app-1',
    })
    expect(firstUpdate(updates).payload.partner_referral_slug).toBe(
      'chr-conseil',
    )
    expect(firstUpdate(updates).payload.updated_at).toEqual(expect.any(String))
  })

  it('clears the slug when an empty value is provided', async () => {
    const { client, updates } = createAdminClient()

    const result = await updatePartnerApplicationSlug(client, 'app-1', '   ')

    expect(result).toBeNull()
    expect(firstUpdate(updates).payload.partner_referral_slug).toBeNull()
  })

  it('clears the slug when null is provided', async () => {
    const { client, updates } = createAdminClient()

    const result = await updatePartnerDealSlug(client, 'deal-1', null)

    expect(result).toBeNull()
    expect(firstUpdate(updates)).toMatchObject({
      table: 'partner_deals',
      id: 'deal-1',
    })
    expect(firstUpdate(updates).payload.partner_referral_slug).toBeNull()
  })

  it('rejects a slug that cannot be normalized without touching the DB', async () => {
    const { client, updates } = createAdminClient()

    await expect(
      updatePartnerApplicationSlug(client, 'app-1', '!!!'),
    ).rejects.toThrow(/Slug invalide/)
    expect(updates).toHaveLength(0)
  })

  it('writes deal slugs to the partner_deals table', async () => {
    const { client, updates } = createAdminClient()

    const result = await updatePartnerDealSlug(client, 'deal-9', 'Sud CHR')

    expect(result).toBe('sud-chr')
    expect(firstUpdate(updates)).toMatchObject({
      table: 'partner_deals',
      id: 'deal-9',
    })
    expect(firstUpdate(updates).payload.partner_referral_slug).toBe('sud-chr')
  })

  it('propagates Supabase errors', async () => {
    const { client } = createAdminClient({ message: 'RLS denied' })

    await expect(
      updatePartnerApplicationSlug(client, 'app-1', 'chr-conseil'),
    ).rejects.toThrow('RLS denied')
  })
})

describe('partner internal notes', () => {
  it('trims and stores an application note', async () => {
    const { client, updates } = createAdminClient()

    await updatePartnerApplicationNote(client, 'app-1', '  rappeler lundi  ')

    expect(firstUpdate(updates)).toMatchObject({
      table: 'partner_applications',
      id: 'app-1',
    })
    expect(firstUpdate(updates).payload.internal_note).toBe('rappeler lundi')
  })

  it('clears the note when only whitespace is provided', async () => {
    const { client, updates } = createAdminClient()

    await updatePartnerDealNote(client, 'deal-1', '   ')

    expect(firstUpdate(updates)).toMatchObject({ table: 'partner_deals' })
    expect(firstUpdate(updates).payload.internal_note).toBeNull()
  })

  it('propagates Supabase errors on note updates', async () => {
    const { client } = createAdminClient({ message: 'RLS denied' })

    await expect(
      updatePartnerApplicationNote(client, 'app-1', 'note'),
    ).rejects.toThrow('RLS denied')
  })
})

// Candidature brute complète, sans donnée partenaire réelle.
const APPLICATION_ROW = {
  id: 'app-1',
  status: 'new',
  partner_kind: 'introducer',
  company_name: 'Réseau Test',
  contact_name: 'Contact Test',
  contact_email: 'test@example.com',
  contact_phone: '+33 6 00 00 00 00',
  siret: null,
  website: 'https://exemple.test',
  partner_referral_slug: null,
  territory: 'Sud-Ouest',
  network_description: null,
  expected_monthly_volume: null,
  message: null,
  source: 'partners_page',
  internal_note: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-09-20T09:00:00.000Z',
  updated_at: '2026-09-20T09:00:00.000Z',
  activity_profile: 'pisciniste',
  target_status: 'revendeur',
  siret_verified: true,
  utm_source: 'linkedin',
  utm_medium: 'social',
  utm_campaign: null,
  partner_ref: 'REF-7',
}

describe('partner application admin mapping', () => {
  it('exposes the collected-but-invisible fields with labels', () => {
    const row = toApplicationAdminRow(APPLICATION_ROW as never)

    expect(row.website).toBe('https://exemple.test')
    expect(row.activityProfile).toBe('pisciniste')
    expect(row.activityProfileLabel).toBe('Pisciniste')
    expect(row.targetStatus).toBe('revendeur')
    expect(row.targetStatusLabel).toBe('RV-AG · Revendeur agréé')
    expect(row.siretVerified).toBe(true)
    expect(row.source).toBe('partners_page')
    expect(row.utmSource).toBe('linkedin')
    expect(row.utmMedium).toBe('social')
    expect(row.utmCampaign).toBeNull()
    expect(row.partnerRef).toBe('REF-7')
  })

  it('keeps unknown profiles verbatim and tolerates legacy rows', () => {
    const row = toApplicationAdminRow({
      ...APPLICATION_ROW,
      website: '',
      activity_profile: 'autre-metier',
      target_status: null,
      siret_verified: undefined,
      source: undefined,
      utm_source: undefined,
      partner_ref: '   ',
    } as never)

    expect(row.website).toBeNull()
    expect(row.activityProfileLabel).toBe('autre-metier')
    expect(row.targetStatus).toBeNull()
    expect(row.targetStatusLabel).toBeNull()
    expect(row.siretVerified).toBe(false)
    expect(row.source).toBe('')
    expect(row.utmSource).toBeNull()
    expect(row.partnerRef).toBeNull()
  })

  it('describes the acquisition origin', () => {
    expect(
      describePartnerApplicationOrigin(
        toApplicationAdminRow(APPLICATION_ROW as never),
      ),
    ).toBe('Partenaire REF-7 · linkedin / social')
    expect(
      describePartnerApplicationOrigin({
        source: 'partners_page',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        partnerRef: null,
      }),
    ).toBe('Page partenaires')
    expect(
      describePartnerApplicationOrigin({
        source: '',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        partnerRef: null,
      }),
    ).toBe('Direct')
  })

  it('exposes label helpers for the admin UI', () => {
    expect(partnerTargetStatusLabel('nsp')).toBe(
      'Je ne sais pas encore — conseillez-moi',
    )
    expect(partnerTargetStatusLabel(null)).toBeNull()
    expect(partnerActivityProfileLabel('chr')).toBe(
      'Groupe CHR · camping · hôtellerie',
    )
    expect(partnerActivityProfileLabel(null)).toBeNull()
  })

  it('maps the deal source', () => {
    const deal = toDealAdminRow({
      id: 'deal-1',
      application_id: 'app-1',
      status: 'submitted',
      partner_company_name: 'Réseau Test',
      partner_contact_email: 'test@example.com',
      partner_referral_slug: null,
      client_company_name: 'Client Test',
      client_siret: null,
      client_email: null,
      project_city: null,
      project_type: 'terrasse',
      expected_budget_ht: '12000',
      expected_purchase_window: null,
      product_interest: null,
      protection_days: 120,
      protected_until: null,
      message: null,
      source: 'partners_deal_form',
      internal_note: null,
      created_at: '2026-09-20T09:00:00.000Z',
      updated_at: '2026-09-20T09:00:00.000Z',
    } as never)

    expect(deal.source).toBe('partners_deal_form')
    expect(deal.expectedBudgetHt).toBe(12000)
  })

  it('lists applications through the admin client', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        order: () => Promise.resolve({ data: [APPLICATION_ROW], error: null }),
      }),
    }))
    const client = { from } as unknown as PartnerAdminRepositoryClient

    const rows = await listPartnerApplications(client)

    expect(from).toHaveBeenCalledWith('partner_applications')
    expect(rows[0]?.targetStatusLabel).toBe('RV-AG · Revendeur agréé')
  })
})
