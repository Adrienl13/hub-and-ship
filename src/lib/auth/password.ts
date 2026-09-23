// Connexion par email et mot de passe : règles pures, testées sans réseau.
//
// Le mot de passe devient le mode de connexion principal (le lien magique
// reste le secours : « Mot de passe oublié », « Recevoir un lien »). Tout ce
// qui se décide ici — longueur minimale, indicateur de solidité, validation du
// formulaire d'inscription, traduction des erreurs du service d'authentification
// — est pur : les pages et le hook useAuth n'orchestrent que les appels.
//
// Règle absolue : aucun message anglais brut ne remonte à l'écran, et jamais
// un mot de passe dans un message, un log ou un toast.

import {
  validateOnboardingForm,
  type OnboardingForm,
} from '@/lib/account/onboarding'
import type { RateLimitRule } from '@/lib/security/rate-limit'
import { businessEmailSchema } from '@/lib/validation/schemas'

/** Page où l'on choisit (ou change) son mot de passe, une fois connecté. */
export const PASSWORD_PATH = '/account/mot-de-passe'

/** Aligné sur le réglage « Minimum password length » du fournisseur (8). */
export const PASSWORD_MIN_LENGTH = 8

/**
 * Au-delà, le hachage tronque silencieusement : on refuse plutôt que de
 * laisser croire que les caractères supplémentaires comptent.
 */
export const PASSWORD_MAX_LENGTH = 72

/** Garde-fou local : 5 essais de connexion par adresse et par quart d'heure. */
export const PASSWORD_ATTEMPT_RATE_LIMIT: RateLimitRule = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
}

/** Garde-fou local : 3 demandes de nouveau mot de passe par quart d'heure. */
export const RESET_RATE_LIMIT: RateLimitRule = {
  limit: 3,
  windowMs: 15 * 60 * 1000,
}

// ---------------------------------------------------------------------------
// Mot de passe : validation et solidité
// ---------------------------------------------------------------------------

export type PasswordValidation =
  { readonly ok: true } | { readonly ok: false; readonly error: string }

export const PASSWORD_ERRORS = {
  empty: 'Choisissez un mot de passe.',
  tooShort: `Votre mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  tooLong: `Votre mot de passe ne peut pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
  mismatch: 'Les deux mots de passe ne sont pas identiques.',
} as const

/** Le mot de passe n'est jamais « nettoyé » : les espaces en font partie. */
export function validatePassword(password: string): PasswordValidation {
  if (password.length === 0) return { ok: false, error: PASSWORD_ERRORS.empty }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: PASSWORD_ERRORS.tooShort }
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: PASSWORD_ERRORS.tooLong }
  }
  return { ok: true }
}

/** Nouveau mot de passe + confirmation (page « Choisissez votre mot de passe »). */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): PasswordValidation {
  const base = validatePassword(password)
  if (!base.ok) return base
  if (password !== confirmation) {
    return { ok: false, error: PASSWORD_ERRORS.mismatch }
  }
  return { ok: true }
}

export type PasswordStrength = 'faible' | 'correct' | 'solide'

/** Nombre de familles de caractères présentes : minuscules, majuscules, chiffres, autres. */
function characterVariety(password: string): number {
  let variety = 0
  if (/[a-z]/.test(password)) variety += 1
  if (/[A-Z]/.test(password)) variety += 1
  if (/\d/.test(password)) variety += 1
  if (/[^A-Za-z0-9]/.test(password)) variety += 1
  return variety
}

/**
 * Indicateur simple, affiché pendant la saisie. Il n'interdit rien : seule
 * la longueur minimale est bloquante (validatePassword). Longueur d'abord,
 * variété ensuite — une phrase longue vaut un mot court et compliqué.
 */
export function passwordStrength(password: string): PasswordStrength {
  const length = password.length
  if (length < PASSWORD_MIN_LENGTH) return 'faible'
  const variety = characterVariety(password)
  if (length >= 16 || (length >= 12 && variety >= 3)) return 'solide'
  if (variety >= 2) return 'correct'
  return 'faible'
}

// ---------------------------------------------------------------------------
// Formulaire d'inscription
// ---------------------------------------------------------------------------

export interface SignupForm extends OnboardingForm {
  readonly email: string
  readonly password: string
}

export type SignupErrors = Partial<Record<keyof SignupForm, string>>

export type SignupValidation =
  { readonly ok: true } | { readonly ok: false; readonly errors: SignupErrors }

export const EMAIL_ERRORS = {
  empty: 'Indiquez votre email professionnel.',
  invalid: 'Cette adresse email ne semble pas valide.',
} as const

/** Adresse normalisée (minuscules, sans espaces) ou null si invalide. */
export function normalizeEmail(email: string): string | null {
  const parsed = businessEmailSchema.safeParse(email)
  return parsed.success ? parsed.data : null
}

/**
 * Réunit la fiche (prénom, nom, établissement, téléphone) et les identifiants.
 * Les messages de la fiche viennent de validateOnboardingForm : un seul
 * libellé par champ, quel que soit l'endroit où il est saisi.
 */
export function validateSignupForm(form: SignupForm): SignupValidation {
  const errors: SignupErrors = {}

  const onboarding = validateOnboardingForm(form)
  if (!onboarding.ok) Object.assign(errors, onboarding.errors)

  if (form.email.trim().length === 0) {
    errors.email = EMAIL_ERRORS.empty
  } else if (normalizeEmail(form.email) === null) {
    errors.email = EMAIL_ERRORS.invalid
  }

  const password = validatePassword(form.password)
  if (!password.ok) errors.password = password.error

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Erreurs du service d'authentification, traduites
// ---------------------------------------------------------------------------

/** Forme minimale d'une erreur du client d'authentification (message, code, statut HTTP). */
export interface AuthErrorLike {
  readonly message?: string
  readonly code?: string
  readonly status?: number
}

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  /** Longueur minimale non respectée : la règle locale, chiffrée. */
  | 'password_too_short'
  /** Refusé par le service pour une autre raison : trop courant, trop simple. */
  | 'weak_password'
  | 'same_password'
  | 'reauthentication_needed'
  | 'invalid_email'
  | 'rate_limited'
  | 'email_rate_limited'
  | 'unknown'

export const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorKind, string>> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed:
    'Activez d’abord votre espace : le lien est dans l’email reçu à l’inscription.',
  user_already_exists: 'Cette adresse a déjà un espace : connectez-vous.',
  password_too_short: PASSWORD_ERRORS.tooShort,
  weak_password:
    'Ce mot de passe est trop simple ou trop courant : choisissez-en un autre (8 caractères minimum, mélangez lettres, chiffres et signes).',
  same_password: 'Choisissez un mot de passe différent de l’actuel.',
  reauthentication_needed:
    'Par sécurité, reconnectez-vous puis choisissez votre mot de passe.',
  invalid_email: EMAIL_ERRORS.invalid,
  rate_limited: 'Trop de tentatives, réessayez dans quelques minutes.',
  email_rate_limited:
    'Patientez quelques secondes avant de redemander un email.',
  unknown:
    'Connexion impossible pour le moment. Réessayez, ou écrivez-nous depuis la page contact.',
}

/** Codes renvoyés par le service (champ `code`), quand il en renvoie un. */
const ERROR_CODES: Readonly<Record<string, AuthErrorKind>> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'user_already_exists',
  email_exists: 'user_already_exists',
  weak_password: 'weak_password',
  same_password: 'same_password',
  reauthentication_needed: 'reauthentication_needed',
  email_address_invalid: 'invalid_email',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'email_rate_limited',
}

/**
 * Messages anglais des versions qui n'envoient pas de `code`. Le premier
 * motif qui correspond gagne : l'ordre compte (« rate limit » avant « email »).
 */
const ERROR_MESSAGE_PATTERNS: ReadonlyArray<readonly [RegExp, AuthErrorKind]> =
  [
    [/invalid login credentials/i, 'invalid_credentials'],
    [/email not confirmed/i, 'email_not_confirmed'],
    [/user already registered/i, 'user_already_exists'],
    [/already been registered/i, 'user_already_exists'],
    [/password should be at least/i, 'password_too_short'],
    [/password should contain/i, 'weak_password'],
    [/signup requires a valid password/i, 'password_too_short'],
    [/known to be weak|easy to guess|pwned|compromised/i, 'weak_password'],
    [/different from the old password/i, 'same_password'],
    [/same password/i, 'same_password'],
    [/reauthentication/i, 'reauthentication_needed'],
    [/only request this (?:once|after)/i, 'email_rate_limited'],
    [/email rate limit exceeded/i, 'email_rate_limited'],
    [/rate limit/i, 'rate_limited'],
    [/too many requests/i, 'rate_limited'],
    [/unable to validate email address/i, 'invalid_email'],
    [/invalid email/i, 'invalid_email'],
  ]

/** Classe une erreur du service ; `unknown` quand on ne la reconnaît pas. */
export function classifyAuthError(
  error: AuthErrorLike | null | undefined,
): AuthErrorKind {
  if (!error) return 'unknown'

  const code = error.code?.trim().toLowerCase()
  const message = error.message?.trim() ?? ''
  // Le service renvoie `weak_password` pour une longueur insuffisante comme
  // pour un mot de passe compromis : le message départage.
  if (code === 'weak_password' && /at least \d+ characters/i.test(message)) {
    return 'password_too_short'
  }
  if (code && code in ERROR_CODES) return ERROR_CODES[code]!

  for (const [pattern, kind] of ERROR_MESSAGE_PATTERNS) {
    if (pattern.test(message)) return kind
  }

  if (error.status === 429) return 'rate_limited'
  return 'unknown'
}

/**
 * Message français à afficher pour une erreur du service. Jamais le message
 * anglais brut : ce qui n'est pas reconnu devient le message générique.
 */
export function describeAuthError(
  error: AuthErrorLike | null | undefined,
): string {
  return AUTH_ERROR_MESSAGES[classifyAuthError(error)]
}

/** L'adresse existe mais l'espace n'est pas activé : proposer de renvoyer l'email. */
export function isEmailNotConfirmedError(
  error: AuthErrorLike | null | undefined,
): boolean {
  return classifyAuthError(error) === 'email_not_confirmed'
}

/** L'adresse a déjà un espace : proposer la connexion ou le mot de passe oublié. */
export function isUserAlreadyExistsError(
  error: AuthErrorLike | null | undefined,
): boolean {
  return classifyAuthError(error) === 'user_already_exists'
}
