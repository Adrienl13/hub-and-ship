import { describe, expect, it } from 'vitest'

import {
  findPartnerAttributionMatch,
  getPartnerEmailDomain,
  isGenericPartnerEmailDomain,
  normalizePartnerEmail,
  normalizePartnerSiret,
  type PartnerAttributionCandidate,
} from '@/lib/partners/attribution'

const baseCandidate: PartnerAttributionCandidate = {
  id: 'deal-001',
  status: 'protected',
  clientSiret: '55208131701750',
  clientEmail: 'direction@hotel-demo.fr',
  partnerCompanyName: 'CHR Conseil',
  partnerContactEmail: 'claire@chr-conseil.fr',
  protectedUntil: '2026-10-06T10:00:00.000Z',
  createdAt: '2026-06-06T10:00:00.000Z',
}

describe('partner attribution matching', () => {
  it('normalizes partner identifiers before matching', () => {
    expect(normalizePartnerSiret('552 081 317 01750')).toBe('55208131701750')
    expect(normalizePartnerSiret('123')).toBeNull()
    expect(normalizePartnerEmail(' DIRECTION@HOTEL-DEMO.FR ')).toBe(
      'direction@hotel-demo.fr',
    )
    expect(getPartnerEmailDomain('direction@hotel-demo.fr')).toBe(
      'hotel-demo.fr',
    )
    expect(isGenericPartnerEmailDomain('gmail.com')).toBe(true)
  })

  it('matches an active protected deal by normalized SIRET first', () => {
    const match = findPartnerAttributionMatch(
      {
        siret: '552 081 317 01750',
        contactEmail: 'finance@other-client.fr',
        now: '2026-06-07T10:00:00.000Z',
      },
      [
        {
          ...baseCandidate,
          id: 'deal-email',
          clientSiret: '11111111111111',
          clientEmail: 'finance@other-client.fr',
          createdAt: '2026-06-07T09:00:00.000Z',
        },
        baseCandidate,
      ],
    )

    expect(match).toEqual({
      dealId: 'deal-001',
      reason: 'client_siret',
      matchedValue: '55208131701750',
      partnerCompanyName: 'CHR Conseil',
      partnerContactEmail: 'claire@chr-conseil.fr',
      protectedUntil: '2026-10-06T10:00:00.000Z',
    })
  })

  it('ignores expired, submitted, won and lost opportunities', () => {
    const match = findPartnerAttributionMatch(
      {
        siret: '55208131701750',
        contactEmail: 'direction@hotel-demo.fr',
        now: '2026-11-01T10:00:00.000Z',
      },
      [
        baseCandidate,
        { ...baseCandidate, id: 'submitted', status: 'submitted' },
        { ...baseCandidate, id: 'won', status: 'won' },
        { ...baseCandidate, id: 'lost', status: 'lost' },
      ],
    )

    expect(match).toBeNull()
  })

  it('matches exact email when the SIRET is unavailable', () => {
    const match = findPartnerAttributionMatch(
      {
        siret: null,
        contactEmail: 'DIRECTION@HOTEL-DEMO.FR',
        now: '2026-06-07T10:00:00.000Z',
      },
      [baseCandidate],
    )

    expect(match?.reason).toBe('client_email')
    expect(match?.matchedValue).toBe('direction@hotel-demo.fr')
  })

  it('matches a professional email domain as a fallback', () => {
    const match = findPartnerAttributionMatch(
      {
        siret: null,
        contactEmail: 'achat@hotel-demo.fr',
        now: '2026-06-07T10:00:00.000Z',
      },
      [baseCandidate],
    )

    expect(match?.reason).toBe('client_email_domain')
    expect(match?.matchedValue).toBe('hotel-demo.fr')
  })

  it('rejects generic email domains for domain fallback', () => {
    const match = findPartnerAttributionMatch(
      {
        siret: null,
        contactEmail: 'nouveau@gmail.com',
        now: '2026-06-07T10:00:00.000Z',
      },
      [
        {
          ...baseCandidate,
          clientSiret: null,
          clientEmail: 'ancien@gmail.com',
        },
      ],
    )

    expect(match).toBeNull()
  })

  it('uses the most recent protected deal within the same priority', () => {
    const match = findPartnerAttributionMatch(
      {
        siret: null,
        contactEmail: 'direction@hotel-demo.fr',
        now: '2026-06-07T10:00:00.000Z',
      },
      [
        baseCandidate,
        {
          ...baseCandidate,
          id: 'deal-002',
          partnerCompanyName: 'Réseau CHR Sud',
          createdAt: '2026-06-07T09:00:00.000Z',
        },
      ],
    )

    expect(match?.dealId).toBe('deal-002')
    expect(match?.partnerCompanyName).toBe('Réseau CHR Sud')
  })
})
