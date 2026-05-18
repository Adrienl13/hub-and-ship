import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REFERRAL_PROGRAM_CONFIG,
  applyReferralCode,
  normalizeReferralCode,
  type ReferralCodePublic,
} from './referral'

const activeCode: ReferralCodePublic = {
  code: 'CONTAINER-PIERRE-X7K9-2026',
  referrerName: 'Pierre',
  referrerCompany: 'Hotel Plage',
  isActive: true,
  totalUses: 2,
  maxUses: 10,
  expiresAt: '2026-12-31T23:59:59.000Z',
  referrerSiret: '73282932000074',
  referrerEmails: ['pierre@hotel-plage.fr'],
}

describe('referral pricing', () => {
  it('normalizes user input for stable code matching', () => {
    expect(normalizeReferralCode(' container pierre x7k9 2026 ')).toBe(
      'CONTAINER-PIERRE-X7K9-2026',
    )
    expect(normalizeReferralCode('container_pierre!')).toBe('CONTAINERPIERRE')
  })

  it('does nothing when no referral code is provided', () => {
    expect(
      applyReferralCode({
        codeInput: '',
        reservationFee: 250,
        codes: [activeCode],
      }),
    ).toMatchObject({
      status: 'none',
      discountAmount: 0,
      payNow: 250,
    })
  })

  it('applies the referred discount to the reservation fee', () => {
    expect(
      applyReferralCode({
        codeInput: 'container-pierre-x7k9-2026',
        reservationFee: 250,
        codes: [activeCode],
        now: new Date('2026-05-18T10:00:00.000Z'),
      }),
    ).toMatchObject({
      status: 'applied',
      discountAmount: DEFAULT_REFERRAL_PROGRAM_CONFIG.referredDiscount,
      payNow: 150,
      referrerLabel: 'Pierre - Hotel Plage',
    })
  })

  it('never discounts below zero', () => {
    expect(
      applyReferralCode({
        codeInput: activeCode.code,
        reservationFee: 80,
        codes: [activeCode],
        now: new Date('2026-05-18T10:00:00.000Z'),
      }),
    ).toMatchObject({
      status: 'applied',
      discountAmount: 80,
      payNow: 0,
    })
  })

  it('rejects unknown, inactive, expired, and exhausted codes', () => {
    expect(
      applyReferralCode({
        codeInput: 'UNKNOWN',
        reservationFee: 250,
        codes: [activeCode],
      }).status,
    ).toBe('unknown')

    expect(
      applyReferralCode({
        codeInput: 'INACTIVE',
        reservationFee: 250,
        codes: [{ ...activeCode, code: 'INACTIVE', isActive: false }],
      }).status,
    ).toBe('inactive')

    expect(
      applyReferralCode({
        codeInput: 'EXPIRED',
        reservationFee: 250,
        codes: [
          {
            ...activeCode,
            code: 'EXPIRED',
            expiresAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        now: new Date('2026-05-18T10:00:00.000Z'),
      }).status,
    ).toBe('expired')

    expect(
      applyReferralCode({
        codeInput: 'EXHAUSTED',
        reservationFee: 250,
        codes: [
          { ...activeCode, code: 'EXHAUSTED', totalUses: 10, maxUses: 10 },
        ],
      }).status,
    ).toBe('exhausted')
  })

  it('blocks self referral with the same SIRET or referrer email', () => {
    expect(
      applyReferralCode({
        codeInput: activeCode.code,
        reservationFee: 250,
        codes: [activeCode],
        referredSiret: '732 829 320 00074',
      }).status,
    ).toBe('self_referral')

    expect(
      applyReferralCode({
        codeInput: activeCode.code,
        reservationFee: 250,
        codes: [activeCode],
        referredEmail: 'PIERRE@hotel-plage.fr',
      }).status,
    ).toBe('self_referral')
  })
})
