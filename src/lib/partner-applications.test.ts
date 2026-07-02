import { describe, expect, it } from 'vitest'

import {
  buildPartnerApplicationDraft,
  toPartnerApplicationInsertPayload,
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
      phone: '',
      zone: '   ',
      estimatedVolume: '',
      message: '',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.phone).toBeNull()
    expect(result.draft.zone).toBeNull()
    expect(result.draft.estimatedVolume).toBeNull()
    expect(result.draft.message).toBeNull()
  })
})

describe('toPartnerApplicationInsertPayload', () => {
  it('maps the draft to snake_case with siret_verified false', () => {
    const result = buildPartnerApplicationDraft(baseInput())
    if (!result.ok) throw new Error('expected valid draft')
    const payload = toPartnerApplicationInsertPayload(result.draft)
    expect(payload).toMatchObject({
      company_name: 'Distri Boissons Provence',
      siret: '55208131701750',
      siret_verified: false,
      target_status: 'apporteur',
      activity_profile: 'brasseur',
      status: 'new',
    })
  })
})
