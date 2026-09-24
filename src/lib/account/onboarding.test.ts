import { describe, expect, it } from 'vitest'

import {
  buildOnboardingMetadata,
  companyNameFromUser,
  dashboardGreeting,
  firstNameFromUser,
  isProfileComplete,
  ONBOARDING_PATH,
  onboardingExitTarget,
  onboardingHref,
  resolvePostLoginDestination,
  setMyCompany,
  validateOnboardingForm,
  type CompanyClient,
  type OnboardingForm,
  signupMetadataFromUser,
  signupProfileComplement,
} from './onboarding'

const VALID_FORM: OnboardingForm = {
  firstName: 'Camille',
  lastName: 'Martin',
  companyName: 'Hôtel des Pins',
  phone: '06 12 34 56 78',
  marketingConsent: false,
}

describe('onboardingHref', () => {
  it('garde la destination finale, encodée', () => {
    expect(onboardingHref('/account')).toBe(
      '/account/bienvenue?returnTo=%2Faccount',
    )
    expect(onboardingHref('/panier?step=2&x=y')).toBe(
      '/account/bienvenue?returnTo=%2Fpanier%3Fstep%3D2%26x%3Dy',
    )
  })

  it('part du chemin exporté', () => {
    expect(ONBOARDING_PATH).toBe('/account/bienvenue')
    expect(onboardingHref('/a').startsWith(ONBOARDING_PATH)).toBe(true)
  })
})

describe('companyNameFromUser', () => {
  it('lit company_name dans les métadonnées, sans espaces autour', () => {
    expect(
      companyNameFromUser({
        user_metadata: { company_name: '  Hôtel des Pins ' },
      }),
    ).toBe('Hôtel des Pins')
  })

  it('renvoie une chaîne vide sans utilisateur ni métadonnées', () => {
    expect(companyNameFromUser(null)).toBe('')
    expect(companyNameFromUser(undefined)).toBe('')
    expect(companyNameFromUser({})).toBe('')
    expect(companyNameFromUser({ user_metadata: {} })).toBe('')
  })

  it('ignore un company_name qui n’est pas une chaîne', () => {
    expect(companyNameFromUser({ user_metadata: { company_name: 42 } })).toBe(
      '',
    )
    expect(
      companyNameFromUser({ user_metadata: { company_name: { a: 1 } } }),
    ).toBe('')
    expect(companyNameFromUser({ user_metadata: { company_name: null } })).toBe(
      '',
    )
  })
})

describe('firstNameFromUser', () => {
  it('lit first_name ou renvoie une chaîne vide', () => {
    expect(firstNameFromUser({ user_metadata: { first_name: ' Léa ' } })).toBe(
      'Léa',
    )
    expect(firstNameFromUser({ user_metadata: { first_name: 3 } })).toBe('')
    expect(firstNameFromUser(null)).toBe('')
  })
})

describe('isProfileComplete', () => {
  it('exige prénom, nom et établissement', () => {
    expect(
      isProfileComplete({
        firstName: 'Camille',
        lastName: 'Martin',
        companyName: 'Hôtel des Pins',
      }),
    ).toBe(true)
    expect(
      isProfileComplete({
        firstName: 'Camille',
        lastName: 'Martin',
        companyName: '',
      }),
    ).toBe(false)
    expect(
      isProfileComplete({
        firstName: '',
        lastName: 'Martin',
        companyName: 'X',
      }),
    ).toBe(false)
    expect(
      isProfileComplete({
        firstName: 'Camille',
        lastName: '',
        companyName: 'X',
      }),
    ).toBe(false)
  })

  it('ne compte pas les espaces comme une valeur', () => {
    expect(
      isProfileComplete({
        firstName: '   ',
        lastName: 'Martin',
        companyName: 'X',
      }),
    ).toBe(false)
    expect(
      isProfileComplete({ firstName: 'C', lastName: 'M', companyName: '\t ' }),
    ).toBe(false)
  })
})

describe('resolvePostLoginDestination', () => {
  it('envoie une fiche complète directement à sa destination', () => {
    expect(
      resolvePostLoginDestination({ complete: true, returnTo: '/panier' }),
    ).toBe('/panier')
  })

  it('fait passer une fiche incomplète par la création de l’espace', () => {
    expect(
      resolvePostLoginDestination({ complete: false, returnTo: '/account' }),
    ).toBe('/account/bienvenue?returnTo=%2Faccount')
  })

  it('n’imbrique pas quand la destination est déjà la création de l’espace', () => {
    const already = '/account/bienvenue?returnTo=%2Faccount'
    expect(
      resolvePostLoginDestination({ complete: false, returnTo: already }),
    ).toBe(already)
    expect(
      resolvePostLoginDestination({
        complete: false,
        returnTo: '/account/bienvenue',
      }),
    ).toBe('/account/bienvenue')
  })

  it('ne confond pas un chemin voisin avec la création de l’espace', () => {
    expect(
      resolvePostLoginDestination({
        complete: false,
        returnTo: '/account/bienvenue-autre',
      }),
    ).toBe('/account/bienvenue?returnTo=%2Faccount%2Fbienvenue-autre')
  })
})

describe('onboardingExitTarget', () => {
  it('retourne la destination interne demandée', () => {
    expect(onboardingExitTarget('/panier?step=2')).toBe('/panier?step=2')
  })

  it('retombe sur le tableau de bord sans destination ou hors du site', () => {
    expect(onboardingExitTarget(undefined)).toBe('/account')
    expect(onboardingExitTarget('')).toBe('/account')
    expect(onboardingExitTarget('https://evil.example/')).toBe('/account')
    expect(onboardingExitTarget('//evil.example')).toBe('/account')
  })

  it('ne renvoie jamais vers la création de l’espace elle-même', () => {
    expect(onboardingExitTarget('/account/bienvenue')).toBe('/account')
    expect(onboardingExitTarget('/account/bienvenue?returnTo=%2Fpanier')).toBe(
      '/account',
    )
  })
})

describe('validateOnboardingForm', () => {
  it('accepte un formulaire complet, téléphone compris', () => {
    expect(validateOnboardingForm(VALID_FORM)).toEqual({ ok: true })
  })

  it('accepte un téléphone vide (facultatif)', () => {
    expect(validateOnboardingForm({ ...VALID_FORM, phone: '' })).toEqual({
      ok: true,
    })
    expect(validateOnboardingForm({ ...VALID_FORM, phone: '   ' })).toEqual({
      ok: true,
    })
  })

  it('refuse un formulaire vide avec un message par champ obligatoire', () => {
    const result = validateOnboardingForm({
      firstName: '',
      lastName: '',
      companyName: '',
      phone: '',
      marketingConsent: false,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({
      firstName: 'Indiquez votre prénom.',
      lastName: 'Indiquez votre nom.',
      companyName:
        'Le nom de votre établissement nous aide à préparer vos devis.',
    })
  })

  it('exige au moins deux caractères hors espaces', () => {
    const result = validateOnboardingForm({
      ...VALID_FORM,
      firstName: ' C ',
      lastName: 'M',
      companyName: '  X  ',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      'companyName',
      'firstName',
      'lastName',
    ])
  })

  it('refuse un téléphone renseigné mais invalide', () => {
    const result = validateOnboardingForm({ ...VALID_FORM, phone: 'abc' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({ phone: 'Numéro de téléphone invalide.' })
  })
})

describe('buildOnboardingMetadata', () => {
  const now = '2026-09-23T10:00:00.000Z'

  it('recopie les champs nettoyés et date la création de l’espace', () => {
    expect(
      buildOnboardingMetadata(
        {
          ...VALID_FORM,
          firstName: ' Camille ',
          companyName: ' Hôtel des Pins ',
          phone: ' 06 12 34 56 78 ',
        },
        now,
      ),
    ).toEqual({
      first_name: 'Camille',
      last_name: 'Martin',
      company_name: 'Hôtel des Pins',
      phone: '06 12 34 56 78',
      onboarding_completed_at: now,
    })
  })

  it('omet le téléphone quand il est vide', () => {
    const metadata = buildOnboardingMetadata(
      { ...VALID_FORM, phone: '  ' },
      now,
    )
    expect(metadata).not.toHaveProperty('phone')
    expect(metadata.onboarding_completed_at).toBe(now)
  })

  it('ne recopie pas le consentement marketing (porté par la fiche)', () => {
    const metadata = buildOnboardingMetadata(
      { ...VALID_FORM, marketingConsent: true },
      now,
    )
    expect(Object.keys(metadata).sort()).toEqual([
      'company_name',
      'first_name',
      'last_name',
      'onboarding_completed_at',
      'phone',
    ])
  })
})

describe('dashboardGreeting', () => {
  it('salue par le prénom et l’établissement', () => {
    expect(
      dashboardGreeting({
        firstName: 'Camille',
        companyName: 'Hôtel des Pins',
      }),
    ).toBe('Bonjour Camille · Hôtel des Pins')
  })

  it('reste sobre quand une information manque', () => {
    expect(dashboardGreeting({ firstName: 'Camille', companyName: '' })).toBe(
      'Bonjour Camille',
    )
    expect(dashboardGreeting({ firstName: '', companyName: 'Hôtel' })).toBe(
      'Bonjour · Hôtel',
    )
    expect(dashboardGreeting({ firstName: '  ', companyName: '' })).toBe(
      'Bonjour',
    )
  })
})

describe('complément de fiche à l’activation', () => {
  const profile = {
    firstName: 'Camille',
    lastName: 'Martin',
    phone: '',
    marketingConsent: false,
  }

  it('lit téléphone et consentement dans les métadonnées, sinon vide', () => {
    expect(
      signupMetadataFromUser({
        user_metadata: {
          phone: ' 06 12 34 56 78 ',
          email_marketing_consent: true,
        },
      }),
    ).toEqual({ phone: '06 12 34 56 78', marketingConsent: true })
    expect(signupMetadataFromUser(null)).toEqual({
      phone: '',
      marketingConsent: false,
    })
    expect(
      signupMetadataFromUser({
        user_metadata: { email_marketing_consent: 'oui' },
      }).marketingConsent,
    ).toBe(false)
  })

  it('complète ce qui manque et ne touche pas à ce que la fiche a déjà', () => {
    expect(
      signupProfileComplement(profile, {
        phone: '06 12 34 56 78',
        marketingConsent: true,
      }),
    ).toEqual({ ...profile, phone: '06 12 34 56 78', marketingConsent: true })
    expect(
      signupProfileComplement(
        { ...profile, phone: '01 00 00 00 00' },
        { phone: '06 12 34 56 78', marketingConsent: false },
      ),
    ).toBeNull()
    expect(
      signupProfileComplement(profile, { phone: '', marketingConsent: false }),
    ).toBeNull()
  })
})

describe('setMyCompany', () => {
  function createClient(result: {
    data: unknown
    error: { message: string } | null
  }): { client: CompanyClient; calls: unknown[][] } {
    const calls: unknown[][] = []
    return {
      calls,
      client: {
        rpc: (fn, args) => {
          calls.push([fn, args])
          return Promise.resolve(result)
        },
      },
    }
  }

  it('appelle set_my_company avec le nom nettoyé et renvoie l’identifiant', async () => {
    const { client, calls } = createClient({ data: 'company-1', error: null })
    await expect(setMyCompany(client, '  Hôtel des Pins ')).resolves.toBe(
      'company-1',
    )
    expect(calls).toEqual([
      ['set_my_company', { p_legal_name: 'Hôtel des Pins' }],
    ])
  })

  it('n’appelle pas la base pour un nom vide ou trop court', async () => {
    const { client, calls } = createClient({ data: 'company-1', error: null })
    await expect(setMyCompany(client, '   ')).resolves.toBeNull()
    await expect(setMyCompany(client, 'A')).resolves.toBeNull()
    expect(calls).toEqual([])
  })

  it('remonte l’erreur de la fonction SQL', async () => {
    const { client } = createClient({
      data: null,
      error: { message: 'not_authenticated' },
    })
    await expect(setMyCompany(client, 'Hôtel des Pins')).rejects.toThrow(
      'not_authenticated',
    )
  })
})
