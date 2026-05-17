export const PERSONAL_EMAIL_DOMAINS: ReadonlyArray<string> = [
  'gmail.com',
  'yahoo.com',
  'yahoo.fr',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'laposte.net',
  'sfr.fr',
  'bbox.fr',
  'neuf.fr',
  'icloud.com',
  'me.com',
] as const

export interface EmailDomainCheck {
  readonly isPersonal: boolean
  readonly domain: string
  readonly showWarning: boolean
  readonly warningMessage?: string
}

export const PERSONAL_EMAIL_WARNING =
  'Cette adresse semble personnelle. Pour une activite professionnelle, nous recommandons fortement un email a votre nom de domaine. Vous pouvez continuer si necessaire.'

export function checkEmailDomain(
  email: string,
  personalDomains: ReadonlyArray<string> = PERSONAL_EMAIL_DOMAINS,
): EmailDomainCheck {
  const domain = email.trim().split('@')[1]?.toLowerCase() ?? ''
  const isPersonal = personalDomains.includes(domain)

  return {
    isPersonal,
    domain,
    showWarning: isPersonal,
    warningMessage: isPersonal ? PERSONAL_EMAIL_WARNING : undefined,
  }
}
