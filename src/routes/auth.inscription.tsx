import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, FolderCheck, MailCheck, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { PasswordField } from '@/components/security/PasswordField'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useAuth, type SignUpOutcome } from '@/hooks/useAuth'
import {
  buildOnboardingMetadata,
  completeProfileFromSignup,
  resolvePostLoginDestination,
} from '@/lib/account/onboarding'
import type { ProfileClient } from '@/lib/account/profile'
import {
  PASSWORD_MIN_LENGTH,
  RESET_RATE_LIMIT,
  passwordStrength,
  validateSignupForm,
} from '@/lib/auth/password'
import { DEFAULT_RETURN_TO, sanitizeReturnTo } from '@/lib/auth/return-to'
import { consumeRateLimit, formatRetryAfter } from '@/lib/security/rate-limit'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const signupSearchSchema = z.object({
  returnTo: z.string().optional(),
})

export const Route = createFileRoute('/auth/inscription')({
  component: SignupPage,
  validateSearch: signupSearchSchema,
  head: () => ({
    meta: [
      { title: 'Créez votre espace pro — Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

interface SignupForm {
  readonly firstName: string
  readonly lastName: string
  readonly companyName: string
  readonly email: string
  readonly password: string
  readonly phone: string
  readonly marketingConsent: boolean
}

type SignupErrors = Partial<Record<keyof SignupForm, string>>

const EMPTY_FORM: SignupForm = {
  firstName: '',
  lastName: '',
  companyName: '',
  email: '',
  password: '',
  phone: '',
  marketingConsent: false,
}

const FIELD_IDS = {
  firstName: 'signup-first-name',
  lastName: 'signup-last-name',
  companyName: 'signup-company',
  email: 'signup-email',
  password: 'signup-password',
  phone: 'signup-phone',
  marketingConsent: 'signup-consent',
} as const satisfies Record<keyof SignupForm, string>

const FIELD_ORDER: ReadonlyArray<keyof SignupForm> = [
  'firstName',
  'lastName',
  'companyName',
  'email',
  'password',
  'phone',
]

const PRIMARY_BUTTON =
  'h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]'

/** Espace créé : l'email d'activation est parti (ou l'adresse était déjà connue). */
interface SentState {
  readonly email: string
  readonly outcome: Exclude<SignUpOutcome, 'session'>
}

function SignupPage() {
  const auth = useAuth()
  const { returnTo: rawReturnTo } = Route.useSearch()
  const returnTo = sanitizeReturnTo(rawReturnTo, DEFAULT_RETURN_TO)
  const [form, setForm] = useState<SignupForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<SignupErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState<SentState | null>(null)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [resending, setResending] = useState(false)

  const setField = (field: keyof SignupForm) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setAlreadyRegistered(false)
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const validation = validateSignupForm(form)
    if (!validation.ok) {
      setErrors(validation.errors)
      // Le focus va au premier champ à corriger, pour le clavier et les
      // lecteurs d'écran.
      const first = FIELD_ORDER.find((field) => validation.errors[field])
      if (first) document.getElementById(FIELD_IDS[first])?.focus()
      return
    }

    setSubmitting(true)
    const now = new Date().toISOString()
    const email = form.email.trim().toLowerCase()
    const result = await auth.signUpWithPassword({
      email,
      password: form.password,
      metadata: {
        ...buildOnboardingMetadata(form, now),
        email_marketing_consent: form.marketingConsent,
      },
      returnTo,
    })

    if (!result.ok) {
      setSubmitting(false)
      if (result.reason === 'already_registered') {
        setAlreadyRegistered(true)
        setErrors({ email: 'Cette adresse a déjà un espace : connectez-vous.' })
        document.getElementById(FIELD_IDS.email)?.focus()
        return
      }
      if (result.reason === 'weak_password') {
        setErrors({ password: result.message })
        document.getElementById(FIELD_IDS.password)?.focus()
        return
      }
      toast.error('Création impossible', { description: result.message })
      return
    }

    if (result.outcome === 'session') {
      // Confirmation d'adresse désactivée : la session est déjà ouverte, sans
      // passer par /auth/callback. Téléphone et consentement sont recopiés
      // ici, au mieux ; la fiche est complète par construction.
      if (result.userId) {
        const config = getSupabasePublicConfig()
        if (config.isConfigured) {
          const client = createSupabaseBrowserClient(
            config,
          ) as unknown as ProfileClient
          await Promise.race([
            completeProfileFromSignup(
              client,
              result.userId,
              {
                phone: form.phone.trim(),
                marketingConsent: form.marketingConsent,
              },
              now,
            ),
            new Promise((resolve) => window.setTimeout(resolve, 2_000)),
          ]).catch(() => undefined)
        }
      }
      window.location.assign(
        resolvePostLoginDestination({ complete: true, returnTo }),
      )
      return
    }

    setSubmitting(false)
    setSent({ email, outcome: result.outcome ?? 'confirm' })
  }

  const handleResend = async () => {
    if (!sent || resending) return
    const rateLimit = consumeRateLimit({
      key: `auth:resend-signup:${sent.email}`,
      ...RESET_RATE_LIMIT,
    })
    if (!rateLimit.allowed) {
      toast.error('Trop de demandes', {
        description: `Réessayez dans ${formatRetryAfter(rateLimit.retryAfterMs)}.`,
      })
      return
    }
    setResending(true)
    const result = await auth.resendSignupEmail(sent.email, returnTo)
    setResending(false)
    // Réponse neutre : on ne confirme pas qu'un espace existe pour l'adresse.
    if (result.ok || sent.outcome === 'already_registered') {
      toast.success('Email renvoyé', {
        description: 'Vérifiez votre boîte email et vos spams.',
      })
    } else {
      toast.error('Envoi impossible', { description: result.message })
    }
  }

  const loginHref = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`

  return (
    <main className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </Link>

        <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6">
          {sent ? (
            <CheckInbox
              sent={sent}
              resending={resending}
              onResend={() => void handleResend()}
              loginHref={loginHref}
            />
          ) : (
            <>
              <div className="mb-6">
                <div className="label-eyebrow text-[color:var(--ember)]">
                  Votre espace pro
                </div>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                  Créez votre espace pro.
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Deux minutes, une seule fois. Vos devis sont ensuite préparés
                  au nom de votre établissement.
                </p>
              </div>

              {!auth.isConfigured && (
                <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80 mb-5 rounded-md border p-3 text-xs leading-5">
                  La création d’espace est momentanément indisponible. Merci de
                  réessayer dans quelques minutes, ou écrivez-nous via{' '}
                  <a className="underline" href="/contact">
                    le formulaire de contact
                  </a>
                  .
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ValidatedInput
                    id={FIELD_IDS.firstName}
                    label="Prénom"
                    value={form.firstName}
                    onValueChange={setField('firstName')}
                    autoComplete="given-name"
                    error={errors.firstName}
                    required
                  />
                  <ValidatedInput
                    id={FIELD_IDS.lastName}
                    label="Nom"
                    value={form.lastName}
                    onValueChange={setField('lastName')}
                    autoComplete="family-name"
                    error={errors.lastName}
                    required
                  />
                </div>
                <ValidatedInput
                  id={FIELD_IDS.companyName}
                  label="Établissement"
                  value={form.companyName}
                  onValueChange={setField('companyName')}
                  autoComplete="organization"
                  hint="Restaurant, hôtel, bar, collectivité…"
                  error={errors.companyName}
                  required
                />
                <div className="space-y-1">
                  <ValidatedInput
                    id={FIELD_IDS.email}
                    label="Email professionnel"
                    type="email"
                    value={form.email}
                    onValueChange={setField('email')}
                    placeholder="direction@hotel.fr"
                    autoComplete="email"
                    error={errors.email}
                    required
                  />
                  {alreadyRegistered && (
                    <p className="text-xs">
                      <a
                        href={loginHref}
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Se connecter
                      </a>
                      <span className="text-muted-foreground"> · </span>
                      <Link
                        to="/auth/mot-de-passe-oublie"
                        search={{ email: form.email.trim().toLowerCase() }}
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </p>
                  )}
                </div>
                <PasswordField
                  id={FIELD_IDS.password}
                  label="Mot de passe"
                  value={form.password}
                  onValueChange={setField('password')}
                  autoComplete="new-password"
                  hint={`${PASSWORD_MIN_LENGTH} caractères minimum. Mélangez lettres, chiffres et signes pour plus de solidité.`}
                  error={errors.password}
                  strength={passwordStrength(form.password)}
                  required
                />
                <ValidatedInput
                  id={FIELD_IDS.phone}
                  label="Téléphone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onValueChange={setField('phone')}
                  autoComplete="tel"
                  hint="Pour vous rappeler au sujet d'un devis. Facultatif."
                  error={errors.phone}
                />
                <label className="flex items-start gap-2 text-sm">
                  <input
                    id={FIELD_IDS.marketingConsent}
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.marketingConsent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        marketingConsent: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-muted-foreground">
                    Recevoir les ouvertures de container et offres par email
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={submitting || !auth.isConfigured}
                  className={PRIMARY_BUTTON}
                >
                  {!auth.isConfigured
                    ? 'Momentanément indisponible'
                    : submitting
                      ? 'Création…'
                      : 'Créer mon espace'}
                </Button>
              </form>

              <p className="mt-6 border-t border-[color:var(--sand-deep)] pt-5 text-center text-sm text-muted-foreground">
                Déjà un espace ?{' '}
                <a
                  href={loginHref}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Se connecter
                </a>
              </p>

              <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Connexion chiffrée. Vos informations restent modifiables dans
                  Paramètres du compte.
                </li>
                <li className="flex items-start gap-2">
                  <FolderCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Devis, réservations, factures et favoris au même endroit.
                </li>
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

/**
 * L'email d'activation est parti. Quand l'adresse était déjà connue, le
 * serveur a répondu de la même façon : le texte couvre les deux cas sans
 * révéler si un espace existe.
 */
function CheckInbox({
  sent,
  resending,
  onResend,
  loginHref,
}: {
  readonly sent: SentState
  readonly resending: boolean
  readonly onResend: () => void
  readonly loginHref: string
}) {
  const neutral = sent.outcome === 'already_registered'
  return (
    <div className="text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
        <MailCheck className="h-5 w-5" />
      </div>
      <div className="label-eyebrow text-[color:var(--ember)]">
        Votre espace pro
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        Vérifiez votre boîte mail.
      </h1>
      {neutral ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Si cette adresse est nouvelle, un email d’activation vient de partir
          vers <span className="font-medium text-foreground">{sent.email}</span>
          . Si cette adresse a déjà un espace,{' '}
          <a
            href={loginHref}
            className="font-medium text-foreground underline underline-offset-4"
          >
            connectez-vous
          </a>{' '}
          ou{' '}
          <Link
            to="/auth/mot-de-passe-oublie"
            search={{ email: sent.email }}
            className="font-medium text-foreground underline underline-offset-4"
          >
            demandez un nouveau mot de passe
          </Link>
          .
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Un email d’activation vient de partir vers{' '}
          <span className="font-medium text-foreground">{sent.email}</span>. Un
          clic sur « Activer mon espace » et vous êtes chez vous.
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Il arrive dans la minute. Rien reçu ? Regardez vos spams : l’expéditeur
        est Terrassea.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={resending}
        onClick={onResend}
        className="mt-6 h-11 w-full rounded-sm border-[color:var(--sand-deep)] bg-card text-foreground hover:bg-[color:var(--sand-soft)]"
      >
        {resending ? 'Envoi…' : 'Renvoyer l’email'}
      </Button>
      {!neutral && (
        <p className="mt-4 text-xs text-muted-foreground">
          Déjà activé ?{' '}
          <a
            href={loginHref}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Se connecter
          </a>
        </p>
      )}
    </div>
  )
}
