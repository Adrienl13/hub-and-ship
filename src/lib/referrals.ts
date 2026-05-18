import type { ReferralCodePublic } from '@/lib/pricing/referral'

export const MOCK_REFERRAL_CODES: ReadonlyArray<ReferralCodePublic> = [
  {
    code: 'CONTAINER-PIERRE-X7K9-2026',
    referrerName: 'Pierre',
    referrerCompany: 'Hotel Plage',
    isActive: true,
    totalUses: 3,
    maxUses: 10,
    expiresAt: '2026-12-31T23:59:59.000Z',
    referrerSiret: '73282932000074',
    referrerEmails: ['pierre@hotel-plage.fr'],
  },
  {
    code: 'CONTAINER-SOPHIE-H4-2026',
    referrerName: 'Sophie',
    referrerCompany: 'Hotel Le Lavandou',
    isActive: true,
    totalUses: 1,
    maxUses: 10,
    expiresAt: '2026-12-31T23:59:59.000Z',
    referrerSiret: '54204494600015',
    referrerEmails: ['direction@hotel-lavandou.fr'],
  },
] as const
