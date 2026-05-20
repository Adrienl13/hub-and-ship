import { describe, expect, it } from 'vitest'

import {
  PERSONAL_EMAIL_DOMAINS,
  PERSONAL_EMAIL_WARNING,
  checkEmailDomain,
} from './email'

describe('checkEmailDomain', () => {
  it('flags a personal email domain with a soft warning', () => {
    expect(checkEmailDomain('buyer@gmail.com')).toEqual({
      isPersonal: true,
      domain: 'gmail.com',
      showWarning: true,
      warningMessage: PERSONAL_EMAIL_WARNING,
    })
  })

  it('normalizes casing and surrounding whitespace', () => {
    expect(checkEmailDomain('  Adrien@Outlook.FR  ')).toMatchObject({
      isPersonal: true,
      domain: 'outlook.fr',
    })
  })

  it('does not warn for a business domain', () => {
    expect(checkEmailDomain('contact@terrassea.fr')).toEqual({
      isPersonal: false,
      domain: 'terrassea.fr',
      showWarning: false,
      warningMessage: undefined,
    })
  })

  it('returns an empty domain for malformed input without throwing', () => {
    expect(checkEmailDomain('not-an-email')).toMatchObject({
      isPersonal: false,
      domain: '',
      showWarning: false,
    })
  })

  it('supports custom personal domain lists', () => {
    expect(
      checkEmailDomain('hello@example.test', ['example.test']),
    ).toMatchObject({
      isPersonal: true,
      domain: 'example.test',
    })
  })

  it('exports the expected V1 warning domains', () => {
    expect(PERSONAL_EMAIL_DOMAINS).toContain('gmail.com')
    expect(PERSONAL_EMAIL_DOMAINS).toContain('icloud.com')
  })
})
