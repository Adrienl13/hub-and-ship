// Création de l'espace client après le premier clic sur le lien de connexion.
//
// Le lien ouvre une session, mais un compte qui n'a ni prénom, ni nom, ni
// établissement ne sert à rien pour préparer un devis : la page
// « Créer mon espace » complète la fiche en une fois. Tout ce qui se décide
// ici est pur et testé ; les pages n'orchestrent que les appels.
//
// Le nom de l'établissement n'a pas de colonne accessible à l'acheteur dans
// `users_profile` (les acheteurs ne créent pas de `companies`) : il vit dans
// les métadonnées utilisateur Supabase (`user.user_metadata.company_name`),
// où l'admin et les modèles d'email le retrouvent. Prénom, nom et téléphone
// restent portés par la fiche utilisateur et sont dupliqués dans les
// métadonnées pour la même raison.

import { DEFAULT_RETURN_TO, sanitizeReturnTo } from '@/lib/auth/return-to'
import { phoneSchema } from '@/lib/validation/schemas'

export const ONBOARDING_PATH = '/account/bienvenue'

export interface OnboardingForm {
  readonly firstName: string
  readonly lastName: string
  readonly companyName: string
  readonly phone: string
  readonly marketingConsent: boolean
}

export type OnboardingErrors = Partial<Record<keyof OnboardingForm, string>>

export type OnboardingValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: OnboardingErrors }

interface UserLike {
  readonly user_metadata?: Record<string, unknown>
}

/** Lien vers la création de l'espace, en gardant la destination finale. */
export function onboardingHref(returnTo: string): string {
  return `${ONBOARDING_PATH}?returnTo=${encodeURIComponent(returnTo)}`
}

function isOnboardingPath(path: string): boolean {
  return (
    path === ONBOARDING_PATH ||
    path.startsWith(`${ONBOARDING_PATH}?`) ||
    path.startsWith(`${ONBOARDING_PATH}#`)
  )
}

/** Établissement lu dans les métadonnées utilisateur, sinon chaîne vide. */
export function companyNameFromUser(user: UserLike | null | undefined): string {
  const value = user?.user_metadata?.company_name
  return typeof value === 'string' ? value.trim() : ''
}

/** Prénom lu dans les métadonnées utilisateur, sinon chaîne vide. */
export function firstNameFromUser(user: UserLike | null | undefined): string {
  const value = user?.user_metadata?.first_name
  return typeof value === 'string' ? value.trim() : ''
}

/** Une fiche est complète avec prénom, nom ET établissement renseignés. */
export function isProfileComplete(input: {
  readonly firstName: string
  readonly lastName: string
  readonly companyName: string
}): boolean {
  return (
    input.firstName.trim().length > 0 &&
    input.lastName.trim().length > 0 &&
    input.companyName.trim().length > 0
  )
}

/**
 * Où envoyer un visiteur dont la session vient de s'ouvrir. Une fiche
 * complète file vers sa destination ; une fiche incomplète passe d'abord par
 * la création de l'espace, qui rendra la main à cette même destination.
 * Si la destination EST déjà la création de l'espace, on n'imbrique pas.
 */
export function resolvePostLoginDestination({
  complete,
  returnTo,
}: {
  readonly complete: boolean
  readonly returnTo: string
}): string {
  if (complete) return returnTo
  if (isOnboardingPath(returnTo)) return returnTo
  return onboardingHref(returnTo)
}

/**
 * Destination une fois l'espace créé (ou déjà complet). Jamais la page de
 * création elle-même, sinon on tournerait en rond : retour au tableau de bord.
 */
export function onboardingExitTarget(
  returnTo: string | null | undefined,
): string {
  const target = sanitizeReturnTo(returnTo, DEFAULT_RETURN_TO)
  return isOnboardingPath(target) ? DEFAULT_RETURN_TO : target
}

export function validateOnboardingForm(
  form: OnboardingForm,
): OnboardingValidation {
  const errors: Record<string, string> = {}

  if (form.firstName.trim().length < 2) {
    errors.firstName = 'Indiquez votre prénom.'
  }
  if (form.lastName.trim().length < 2) {
    errors.lastName = 'Indiquez votre nom.'
  }
  if (form.companyName.trim().length < 2) {
    errors.companyName =
      'Le nom de votre établissement nous aide à préparer vos devis.'
  }
  const phone = form.phone.trim()
  if (phone.length > 0 && !phoneSchema.safeParse(phone).success) {
    errors.phone = 'Numéro de téléphone invalide.'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as OnboardingErrors }
  }
  return { ok: true }
}

/**
 * Métadonnées utilisateur à enregistrer avec la fiche. Le téléphone est
 * omis quand il est vide plutôt qu'enregistré à blanc.
 */
export function buildOnboardingMetadata(
  form: OnboardingForm,
  nowIso: string,
): Record<string, string> {
  const metadata: Record<string, string> = {
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    company_name: form.companyName.trim(),
    onboarding_completed_at: nowIso,
  }
  const phone = form.phone.trim()
  if (phone.length > 0) metadata.phone = phone
  return metadata
}

/** « Bonjour Camille · Hôtel des Pins », ou simplement « Bonjour ». */
export function dashboardGreeting({
  firstName,
  companyName,
}: {
  readonly firstName: string
  readonly companyName: string
}): string {
  const name = firstName.trim()
  const company = companyName.trim()
  const head = name ? `Bonjour ${name}` : 'Bonjour'
  return company ? `${head} · ${company}` : head
}
