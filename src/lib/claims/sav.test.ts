import { describe, expect, it } from 'vitest'

import { CLAIM_RULES, isClaimEligible } from './sav'

describe('SAV claim rules', () => {
  it('exports the V1 claim windows from the spec', () => {
    expect(CLAIM_RULES.apparent_defect.maxDaysAfterDelivery).toBe(2)
    expect(CLAIM_RULES.transport_damage.maxDaysAfterDelivery).toBe(2)
    expect(CLAIM_RULES.non_conformity.maxDaysAfterDelivery).toBe(14)
    expect(CLAIM_RULES.hidden_defect.maxDaysAfterDelivery).toBe(730)
  })

  it('accepts visible defects reported within 48 hours', () => {
    const result = isClaimEligible(
      'apparent_defect',
      new Date('2026-05-01T10:00:00.000Z'),
      new Date('2026-05-03T09:59:00.000Z'),
    )

    expect(result.eligible).toBe(true)
    expect(result.daysElapsed).toBe(1)
    expect(result.deadline.toISOString()).toBe('2026-05-03T10:00:00.000Z')
  })

  it('rejects visible defects after the deadline', () => {
    expect(
      isClaimEligible(
        'transport_damage',
        new Date('2026-05-01T10:00:00.000Z'),
        new Date('2026-05-03T10:01:00.000Z'),
      ).eligible,
    ).toBe(false)
  })

  it('keeps non-conformity open for 14 days', () => {
    expect(
      isClaimEligible(
        'non_conformity',
        new Date('2026-05-01T10:00:00.000Z'),
        new Date('2026-05-15T10:00:00.000Z'),
      ).eligible,
    ).toBe(true)
  })

  it('keeps hidden defects open for two years', () => {
    expect(
      isClaimEligible(
        'hidden_defect',
        new Date('2026-05-01T10:00:00.000Z'),
        new Date('2028-04-30T10:00:00.000Z'),
      ).eligible,
    ).toBe(true)
  })

  it('rejects impossible reports before delivery', () => {
    expect(
      isClaimEligible(
        'hidden_defect',
        new Date('2026-05-01T10:00:00.000Z'),
        new Date('2026-04-30T10:00:00.000Z'),
      ),
    ).toMatchObject({
      eligible: false,
      daysElapsed: -1,
    })
  })
})
