import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_MESSAGES,
  classifyAuthError,
  describeAuthError,
  EMAIL_ERRORS,
  isEmailNotConfirmedError,
  isUserAlreadyExistsError,
  normalizeEmail,
  PASSWORD_ATTEMPT_RATE_LIMIT,
  PASSWORD_ERRORS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATH,
  passwordStrength,
  RESET_RATE_LIMIT,
  validatePassword,
  validatePasswordConfirmation,
  validateSignupForm,
  type AuthErrorKind,
  type SignupForm,
} from './password'

const VALID_FORM: SignupForm = {
  firstName: 'Camille',
  lastName: 'Martin',
  companyName: 'Hôtel des Pins',
  phone: '06 12 34 56 78',
  marketingConsent: false,
  email: 'camille@hoteldespins.fr',
  password: 'terrasse-2026',
}

describe('constantes', () => {
  it('longueur minimale 8, chemin de la page mot de passe', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
    expect(PASSWORD_MAX_LENGTH).toBe(72)
    expect(PASSWORD_PATH).toBe('/account/mot-de-passe')
  })

  it('garde-fous : 5 essais / 15 min, 3 demandes de réinitialisation / 15 min', () => {
    expect(PASSWORD_ATTEMPT_RATE_LIMIT).toEqual({
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })
    expect(RESET_RATE_LIMIT).toEqual({ limit: 3, windowMs: 15 * 60 * 1000 })
  })
})

describe('validatePassword', () => {
  it('accepte dès 8 caractères, jusqu’à 72', () => {
    expect(validatePassword('12345678')).toEqual({ ok: true })
    expect(validatePassword('a'.repeat(72))).toEqual({ ok: true })
    expect(validatePassword('une phrase avec des espaces')).toEqual({
      ok: true,
    })
  })

  it('refuse un mot de passe vide ou trop court, avec le message français', () => {
    expect(validatePassword('')).toEqual({
      ok: false,
      error: 'Choisissez un mot de passe.',
    })
    expect(validatePassword('1234567')).toEqual({
      ok: false,
      error: 'Votre mot de passe doit contenir au moins 8 caractères.',
    })
  })

  it('ne rogne pas les espaces : « 7 espaces + 1 lettre » fait bien 8 caractères', () => {
    expect(validatePassword('       a')).toEqual({ ok: true })
  })

  it('refuse au-delà de 72 caractères', () => {
    expect(validatePassword('a'.repeat(73))).toEqual({
      ok: false,
      error: PASSWORD_ERRORS.tooLong,
    })
  })
})

describe('validatePasswordConfirmation', () => {
  it('exige deux saisies identiques, après les règles de base', () => {
    expect(
      validatePasswordConfirmation('terrasse-2026', 'terrasse-2026'),
    ).toEqual({ ok: true })
    expect(
      validatePasswordConfirmation('terrasse-2026', 'terrasse-2027'),
    ).toEqual({
      ok: false,
      error: 'Les deux mots de passe ne sont pas identiques.',
    })
    expect(validatePasswordConfirmation('court', 'court')).toEqual({
      ok: false,
      error: PASSWORD_ERRORS.tooShort,
    })
  })
})

describe('passwordStrength', () => {
  it('faible sous la longueur minimale, quelle que soit la variété', () => {
    expect(passwordStrength('')).toBe('faible')
    expect(passwordStrength('Ab1!')).toBe('faible')
    expect(passwordStrength('Ab1!Ab1')).toBe('faible')
  })

  it('faible avec une seule famille de caractères, même long (jusqu’à 15)', () => {
    expect(passwordStrength('motdepasse')).toBe('faible')
    expect(passwordStrength('123456789012')).toBe('faible')
    expect(passwordStrength('a'.repeat(15))).toBe('faible')
  })

  it('correct dès deux familles sur 8 caractères', () => {
    expect(passwordStrength('terrasse1')).toBe('correct')
    expect(passwordStrength('Terrasse')).toBe('correct')
    expect(passwordStrength('terrasse-')).toBe('correct')
    expect(passwordStrength('Terrasse1!')).toBe('correct')
  })

  it('solide à partir de 12 caractères et trois familles, ou 16 caractères', () => {
    expect(passwordStrength('Terrasse-2026')).toBe('solide')
    expect(passwordStrength('terrasse-2026')).toBe('solide')
    expect(passwordStrength('a'.repeat(16))).toBe('solide')
    expect(passwordStrength('une phrase de passe longue')).toBe('solide')
  })

  it('correct pour 12 caractères et seulement deux familles', () => {
    expect(passwordStrength('terrasse2026')).toBe('correct')
  })
})

describe('normalizeEmail', () => {
  it('met en minuscules et retire les espaces autour', () => {
    expect(normalizeEmail('  Camille@HotelDesPins.FR ')).toBe(
      'camille@hoteldespins.fr',
    )
  })

  it('rend null pour une adresse invalide', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('camille')).toBeNull()
    expect(normalizeEmail('camille@')).toBeNull()
  })
})

describe('validateSignupForm', () => {
  it('accepte une fiche complète avec email et mot de passe valides', () => {
    expect(validateSignupForm(VALID_FORM)).toEqual({ ok: true })
  })

  it('accepte un téléphone vide (facultatif)', () => {
    expect(validateSignupForm({ ...VALID_FORM, phone: '' })).toEqual({
      ok: true,
    })
  })

  it('reprend les messages de la fiche (prénom, nom, établissement, téléphone)', () => {
    const result = validateSignupForm({
      ...VALID_FORM,
      firstName: 'C',
      lastName: ' ',
      companyName: '',
      phone: 'abc',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({
      firstName: 'Indiquez votre prénom.',
      lastName: 'Indiquez votre nom.',
      companyName:
        'Le nom de votre établissement nous aide à préparer vos devis.',
      phone: 'Numéro de téléphone invalide.',
    })
  })

  it('distingue email absent et email invalide', () => {
    const empty = validateSignupForm({ ...VALID_FORM, email: '   ' })
    expect(empty).toEqual({ ok: false, errors: { email: EMAIL_ERRORS.empty } })
    const invalid = validateSignupForm({ ...VALID_FORM, email: 'camille@' })
    expect(invalid).toEqual({
      ok: false,
      errors: { email: EMAIL_ERRORS.invalid },
    })
  })

  it('remonte l’erreur de mot de passe sur la clé password', () => {
    const empty = validateSignupForm({ ...VALID_FORM, password: '' })
    expect(empty).toEqual({
      ok: false,
      errors: { password: PASSWORD_ERRORS.empty },
    })
    const short = validateSignupForm({ ...VALID_FORM, password: 'court' })
    expect(short).toEqual({
      ok: false,
      errors: { password: PASSWORD_ERRORS.tooShort },
    })
  })

  it('cumule les erreurs de tous les champs en une passe', () => {
    const result = validateSignupForm({
      firstName: '',
      lastName: '',
      companyName: '',
      phone: '',
      marketingConsent: false,
      email: 'pas-un-email',
      password: '1234',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      'companyName',
      'email',
      'firstName',
      'lastName',
      'password',
    ])
  })
})

describe('classifyAuthError / describeAuthError', () => {
  const GENERIC =
    'Connexion impossible pour le moment. Réessayez, ou écrivez-nous depuis la page contact.'

  it('null, undefined ou erreur vide → message générique', () => {
    expect(describeAuthError(null)).toBe(GENERIC)
    expect(describeAuthError(undefined)).toBe(GENERIC)
    expect(describeAuthError({})).toBe(GENERIC)
    expect(classifyAuthError({ message: 'Something odd happened' })).toBe(
      'unknown',
    )
  })

  it('identifiants invalides, par code ou par message', () => {
    expect(describeAuthError({ code: 'invalid_credentials' })).toBe(
      'Email ou mot de passe incorrect.',
    )
    expect(
      describeAuthError({ message: 'Invalid login credentials', status: 400 }),
    ).toBe('Email ou mot de passe incorrect.')
  })

  it('email non confirmé → invitation à activer l’espace', () => {
    const expected =
      'Activez d’abord votre espace : le lien est dans l’email reçu à l’inscription.'
    expect(describeAuthError({ code: 'email_not_confirmed' })).toBe(expected)
    expect(describeAuthError({ message: 'Email not confirmed' })).toBe(expected)
    expect(isEmailNotConfirmedError({ message: 'Email not confirmed' })).toBe(
      true,
    )
    expect(isEmailNotConfirmedError({ code: 'invalid_credentials' })).toBe(
      false,
    )
    expect(isEmailNotConfirmedError(null)).toBe(false)
  })

  it('adresse déjà connue → connectez-vous', () => {
    const expected = 'Cette adresse a déjà un espace : connectez-vous.'
    expect(describeAuthError({ code: 'user_already_exists' })).toBe(expected)
    expect(describeAuthError({ code: 'email_exists' })).toBe(expected)
    expect(describeAuthError({ message: 'User already registered' })).toBe(
      expected,
    )
    expect(
      describeAuthError({
        message: 'A user with this email address has already been registered',
      }),
    ).toBe(expected)
    expect(isUserAlreadyExistsError({ code: 'user_already_exists' })).toBe(true)
    expect(isUserAlreadyExistsError({ code: 'weak_password' })).toBe(false)
  })

  it('mot de passe faible → la règle locale, pas le message anglais', () => {
    const expected = 'Votre mot de passe doit contenir au moins 8 caractères.'
    // Code seul, ou mot de passe compromis : ce n'est pas une question de
    // longueur, le message le dit.
    expect(describeAuthError({ code: 'weak_password' })).toContain(
      'trop simple ou trop courant',
    )
    expect(
      describeAuthError({
        code: 'weak_password',
        message:
          'Password is known to be weak and easy to guess, please choose a different one.',
      }),
    ).toContain('trop simple ou trop courant')
    expect(
      describeAuthError({
        code: 'weak_password',
        message: 'Password should be at least 8 characters.',
      }),
    ).toBe(expected)
    expect(describeAuthError({ code: 'reauthentication_needed' })).toContain(
      'reconnectez-vous',
    )
    expect(
      describeAuthError({
        message: 'Password should be at least 6 characters.',
      }),
    ).toBe(expected)
    expect(
      describeAuthError({
        message:
          'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789.',
      }),
    ).toContain('trop simple ou trop courant')
    expect(
      describeAuthError({ message: 'Signup requires a valid password' }),
    ).toBe(expected)
  })

  it('même mot de passe que l’actuel', () => {
    const expected = 'Choisissez un mot de passe différent de l’actuel.'
    expect(describeAuthError({ code: 'same_password' })).toBe(expected)
    expect(
      describeAuthError({
        message: 'New password should be different from the old password.',
      }),
    ).toBe(expected)
  })

  it('fréquence : requêtes (429) et envois d’email distingués', () => {
    const requests = 'Trop de tentatives, réessayez dans quelques minutes.'
    const emails = 'Patientez quelques secondes avant de redemander un email.'
    expect(describeAuthError({ code: 'over_request_rate_limit' })).toBe(
      requests,
    )
    expect(describeAuthError({ status: 429 })).toBe(requests)
    expect(describeAuthError({ message: 'Request rate limit reached' })).toBe(
      requests,
    )
    expect(describeAuthError({ code: 'over_email_send_rate_limit' })).toBe(
      emails,
    )
    expect(
      describeAuthError({
        message:
          'For security purposes, you can only request this after 52 seconds.',
        status: 429,
      }),
    ).toBe(emails)
    expect(
      describeAuthError({
        message:
          'For security purposes, you can only request this once every 60 seconds',
      }),
    ).toBe(emails)
    expect(describeAuthError({ message: 'Email rate limit exceeded' })).toBe(
      emails,
    )
  })

  it('adresse email refusée par le service', () => {
    expect(describeAuthError({ code: 'email_address_invalid' })).toBe(
      EMAIL_ERRORS.invalid,
    )
    expect(
      describeAuthError({
        message: 'Unable to validate email address: invalid format',
      }),
    ).toBe(EMAIL_ERRORS.invalid)
  })

  it('le code l’emporte sur le message quand les deux sont présents', () => {
    expect(
      classifyAuthError({
        code: 'email_not_confirmed',
        message: 'Invalid login credentials',
      }),
    ).toBe('email_not_confirmed')
    expect(classifyAuthError({ code: 'INVALID_CREDENTIALS ' })).toBe(
      'invalid_credentials',
    )
  })

  it('un code inconnu retombe sur le message, puis sur le statut', () => {
    expect(
      classifyAuthError({
        code: 'brand_new_code',
        message: 'Email not confirmed',
      }),
    ).toBe('email_not_confirmed')
    expect(classifyAuthError({ code: 'brand_new_code', status: 429 })).toBe(
      'rate_limited',
    )
    expect(classifyAuthError({ code: 'brand_new_code', status: 500 })).toBe(
      'unknown',
    )
  })

  it('ne renvoie jamais le message anglais brut, ni de terme technique', () => {
    const samples = [
      { message: 'Invalid login credentials' },
      { message: 'Email not confirmed' },
      { message: 'User already registered' },
      { message: 'Password should be at least 6 characters.' },
      { message: 'Request rate limit reached', status: 429 },
      { message: 'Database error saving new user', status: 500 },
      { message: 'fetch failed' },
      { code: 'unexpected_failure', message: 'Unexpected failure' },
    ]
    for (const sample of samples) {
      const described = describeAuthError(sample)
      expect(described, sample.message).not.toBe(sample.message)
      expect(described).not.toMatch(/supabase|gotrue|token|jwt/i)
      expect(described.endsWith('.')).toBe(true)
    }
  })

  it('chaque catégorie a un message français', () => {
    const kinds: AuthErrorKind[] = [
      'invalid_credentials',
      'email_not_confirmed',
      'user_already_exists',
      'password_too_short',
      'weak_password',
      'same_password',
      'reauthentication_needed',
      'invalid_email',
      'rate_limited',
      'email_rate_limited',
      'unknown',
    ]
    for (const kind of kinds) {
      expect(AUTH_ERROR_MESSAGES[kind].length).toBeGreaterThan(10)
    }
  })
})
