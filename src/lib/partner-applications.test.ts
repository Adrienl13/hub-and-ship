import { describe, expect, it } from 'vitest'

import {
  buildPartnerApplicationDraft,
  toPartnerRequestApiPayload,
} from './partner-applications'

const VALID_SIRET = '552 081 317 01750' // Danone — passes the Luhn checksum

function baseInput() {
  return {
    companyName: 'Distri Boissons Provence',
    siret: VALID_SIRET,
    contactName: 'Marie Martin',
    email: 'Contact@Distri-Provence.FR',
    phone: '06 12 34 56 78',
    activityProfile: 'brasseur',
    targetStatus: 'apporteur',
    zone: 'Bouches-du-Rhône',
    estimatedVolume: '120 clients',
    message: 'On livre déjà 120 terrasses.',
    now: new Date('2026-07-02T10:00:00.000Z'),
  }
}

describe('buildPartnerApplicationDraft', () => {
  it('accepts a valid application, cleaning SIRET and lowercasing email', () => {
    const result = buildPartnerApplicationDraft(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.siret).toBe('55208131701750')
    expect(result.draft.email).toBe('contact@distri-provence.fr')
    expect(result.draft.activityProfile).toBe('brasseur')
    expect(result.draft.targetStatus).toBe('apporteur')
    expect(result.draft.status).toBe('new')
    expect(result.draft.createdAt).toBe('2026-07-02T10:00:00.000Z')
  })

  it('rejects a SIRET that is not 14 digits', () => {
    const result = buildPartnerApplicationDraft({
      ...baseInput(),
      siret: '123',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'siret')).toBe(true)
  })

  it('rejects a SIRET with an invalid checksum', () => {
    const result = buildPartnerApplicationDraft({
      ...baseInput(),
      siret: '55208131701751',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown activity profile or target status', () => {
    expect(
      buildPartnerApplicationDraft({ ...baseInput(), activityProfile: 'nope' })
        .ok,
    ).toBe(false)
    expect(
      buildPartnerApplicationDraft({ ...baseInput(), targetStatus: 'nope' }).ok,
    ).toBe(false)
  })

  it('normalizes blank optional fields to null', () => {
    const result = buildPartnerApplicationDraft({
      ...baseInput(),
      zone: '   ',
      estimatedVolume: '',
      message: '',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.zone).toBeNull()
    expect(result.draft.estimatedVolume).toBeNull()
    expect(result.draft.message).toBeNull()
  })

  it('requires the phone (the server intake rejects it anyway)', () => {
    const result = buildPartnerApplicationDraft({ ...baseInput(), phone: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.path === 'phone')).toBe(true)
  })

  it('caps zone/volume/message at the server limits (180/120/900)', () => {
    expect(
      buildPartnerApplicationDraft({ ...baseInput(), zone: 'x'.repeat(181) })
        .ok,
    ).toBe(false)
    expect(
      buildPartnerApplicationDraft({
        ...baseInput(),
        estimatedVolume: 'x'.repeat(121),
      }).ok,
    ).toBe(false)
    expect(
      buildPartnerApplicationDraft({
        ...baseInput(),
        message: 'x'.repeat(901),
      }).ok,
    ).toBe(false)
  })
})

describe('toPartnerRequestApiPayload', () => {
  it('maps the draft onto the /api/partner-requests payload with attribution', () => {
    const result = buildPartnerApplicationDraft(baseInput())
    if (!result.ok) throw new Error('expected valid draft')
    const payload = toPartnerRequestApiPayload(result.draft, {
      utm_source: 'partner',
      utm_medium: 'qr',
      utm_campaign: 'corner_depot',
      partner_ref: 'DBP-13',
    })
    expect(payload).toMatchObject({
      mode: 'application',
      partnerKind: 'introducer', // apporteur → pipeline codex
      companyName: 'Distri Boissons Provence',
      contactEmail: 'contact@distri-provence.fr',
      siret: '55208131701750',
      territory: 'Bouches-du-Rhône',
      activityProfile: 'brasseur',
      targetStatus: 'apporteur',
      utmSource: 'partner',
      partnerRef: 'DBP-13',
    })
  })

  it('maps every target status onto a codex partner_kind', () => {
    const draft = (status: string) => {
      const result = buildPartnerApplicationDraft({
        ...baseInput(),
        targetStatus: status,
      })
      if (!result.ok) throw new Error('expected valid draft')
      return toPartnerRequestApiPayload(result.draft).partnerKind
    }
    expect(draft('apporteur')).toBe('introducer')
    expect(draft('revendeur')).toBe('reseller')
    expect(draft('distributeur')).toBe('network')
    expect(draft('grand_compte')).toBe('other')
    expect(draft('nsp')).toBe('other')
  })
})
