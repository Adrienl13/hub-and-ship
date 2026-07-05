import { describe, expect, it } from 'vitest'

import {
  accountProfileFromRow,
  toAccountProfilePatch,
} from './profile'

describe('accountProfileFromRow', () => {
  it('maps a full row', () => {
    expect(
      accountProfileFromRow({
        first_name: 'Marie',
        last_name: 'Durand',
        phone: '0600000000',
        email_marketing_consent: true,
      }),
    ).toEqual({
      firstName: 'Marie',
      lastName: 'Durand',
      phone: '0600000000',
      marketingConsent: true,
    })
  })

  it('defaults nulls/missing row to empty values', () => {
    expect(accountProfileFromRow(null)).toEqual({
      firstName: '',
      lastName: '',
      phone: '',
      marketingConsent: false,
    })
    expect(
      accountProfileFromRow({
        first_name: null,
        last_name: null,
        phone: null,
        email_marketing_consent: null,
      }),
    ).toEqual({
      firstName: '',
      lastName: '',
      phone: '',
      marketingConsent: false,
    })
  })
})

describe('toAccountProfilePatch', () => {
  const now = '2026-06-11T00:00:00.000Z'

  it('trims and nulls empty strings, stamps consent date when opted in', () => {
    expect(
      toAccountProfilePatch(
        {
          firstName: '  Marie ',
          lastName: '',
          phone: '   ',
          marketingConsent: true,
        },
        now,
      ),
    ).toEqual({
      first_name: 'Marie',
      last_name: null,
      phone: null,
      email_marketing_consent: true,
      email_marketing_consent_at: now,
    })
  })

  it('clears the consent timestamp when opted out', () => {
    const patch = toAccountProfilePatch(
      { firstName: 'A', lastName: 'B', phone: '1', marketingConsent: false },
      now,
    )
    expect(patch.email_marketing_consent).toBe(false)
    expect(patch.email_marketing_consent_at).toBeNull()
  })
})
