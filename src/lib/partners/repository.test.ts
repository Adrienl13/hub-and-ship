import { describe, expect, it, vi } from 'vitest'

import {
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
    expect(firstUpdate(updates).payload.partner_referral_slug).toBe('chr-conseil')
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
    expect(firstUpdate(updates)).toMatchObject({ table: 'partner_deals', id: 'deal-1' })
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
