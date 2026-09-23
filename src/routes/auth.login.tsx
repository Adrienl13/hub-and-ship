import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { PasswordField } from '@/components/security/PasswordField'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useAuth, type AuthErrorReason } from '@/hooks/useAuth'
import { useSecurityEvents } from '@/hooks/useSecurityEvents'
import {
  companyNameFromUser,
  isProfileComplete,
  resolvePostLoginDestination,
} from '@/lib/account/onboarding'
import { loadMyProfile, type ProfileClient } from '@/lib/account/profile'
import { EMAIL_ERRORS, PASSWORD_ATTEMPT_RATE_LIMIT } from '@/lib/auth/password'
import { DEFAULT_RETURN_TO, sanitizeReturnTo } from '@/lib/auth/return-to'
import {
  consumeRateLimit,
  formatRetryAfter,
  MAGIC_LINK_RATE_LIMIT,
  peekRateLimit,
} from '@/lib/security/rate-limit'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { businessEmailSchema } from '@/lib/validation/schemas'

const loginSearchSchema = z.object({
  returnTo: z.string().optional(),
})

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
  validateSearch: loginSearchSchema,
  head: () => ({
    meta: [
      { title: 'Connexion — Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

/** Lecture de la fiche après connexion : au-delà, direction la création de l'espace. */
const PROFILE_READ_TIMEOUT_MS = 4_000

/** Connexion principale (mot de passe) ou de secours (lien par email). */
type Mode = 'password' | 'magic'

interface SignInFailure {
  readonly message: string
  readonly reason: AuthErrorReason
}

const PRIMARY_BUTTON =
  'h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]'

const SECONDARY_BUTTON =
  'h-11 w-full rounded-sm border-[color:var(--sand-deep)] bg-card text-foreground hover:bg-[color:var(--sand-soft)]'

function LoginPage() {
  const auth = useAuth()
  const securityEvents = useSecurityEvents()
  const { returnTo: rawReturnTo } = Route.useSearch()
  const returnTo = sanitizeReturnTo(rawReturnTo, undefined)
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<SignInFailure | null>(null)
  const [resending, setResending] = useState(false)
  // Le toast de confirmation disparaît au bout de quelques secondes : sur
  // mobile, l'utilisateur bascule sur sa boîte mail et revient sans savoir si
  // le lien est parti. L'état d'envoi reste donc affiché sur la page.
  const [sentTo, setSentTo] = useState<string | null>(null)
  // Une connexion par mot de passe choisit elle-même sa destination (fiche à
  // compléter ou non) : la redirection « déjà connecté » doit alors s'abstenir.
  const signingIn = useRef(false)
  const parsedEmail = businessEmailSchema.safeParse(email)
  const emailError =
    email && !parsedEmail.success ? EMAIL_ERRORS.invalid : undefined

  // Déjà connecté ? Direction la destination : rien à demander.
  useEffect(() => {
    if (auth.status !== 'authenticated' || signingIn.current) return
    window.location.assign(returnTo ?? DEFAULT_RETURN_TO)
  }, [auth.status, returnTo])

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parsedEmail.success || !password || submitting) return

    // Seuls les ÉCHECS comptent : cinq connexions réussies dans le quart
    // d'heure (plusieurs appareils, recette) ne doivent pas bloquer la sixième.
    const rateLimitKey = `auth:password:${parsedEmail.data}`
    const rateLimit = peekRateLimit({
      key: rateLimitKey,
      ...PASSWORD_ATTEMPT_RATE_LIMIT,
    })
    if (!rateLimit.allowed) {
      void securityEvents.logEvent({
        eventType: 'rate_limit_hit',
        severity: 'warning',
        metadata: {
          scope: 'password_sign_in',
          email: parsedEmail.data,
          limit: rateLimit.limit,
          retryAfterMs: rateLimit.retryAfterMs,
        },
      })
      setFailure({
        reason: 'rate_limited',
        message: `Trop de tentatives, réessayez dans ${formatRetryAfter(rateLimit.retryAfterMs)}.`,
      })
      return
    }

    setSubmitting(true)
    setFailure(null)
    signingIn.current = true
    const result = await auth.signInWithPassword(parsedEmail.data, password)
    void securityEvents.logEvent({
      eventType: 'login_attempt',
      severity: result.ok ? 'info' : 'warning',
      metadata: { method: 'password', ok: result.ok, email: parsedEmail.data },
    })

    if (!result.ok || !result.user) {
      consumeRateLimit({ key: rateLimitKey, ...PASSWORD_ATTEMPT_RATE_LIMIT })
      signingIn.current = false
      setSubmitting(false)
      setFailure({
        reason: result.reason ?? 'unknown',
        message: result.message,
      })
      return
    }

    // Première visite ou fiche jamais complétée → création de l'espace ; une
    // lecture en échec compte comme incomplète, la page de création se
    // redirige elle-même si la fiche s'avère complète.
    const destination = await destinationAfterSignIn(
      result.user,
      returnTo ?? DEFAULT_RETURN_TO,
    )
    window.location.assign(destination)
  }

  const handleResendActivation = async () => {
    if (!parsedEmail.success || resending) return
    setResending(true)
    const result = await auth.resendSignupEmail(parsedEmail.data, returnTo)
    setResending(false)
    if (result.ok) {
      toast.success("Email d'activation renvoyé", {
        description: `Vérifiez votre boîte email (${parsedEmail.data}) et vos spams.`,
      })
    } else {
      toast.error('Envoi impossible', { description: result.message })
    }
  }

  const handleMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!parsedEmail.success) return

    const rateLimit = consumeRateLimit({
      key: `auth:magic-link:${parsedEmail.data}`,
      ...MAGIC_LINK_RATE_LIMIT,
    })

    if (!rateLimit.allowed) {
      void securityEvents.logEvent({
        eventType: 'magic_link_rate_limited',
        severity: 'warning',
        metadata: {
          email: parsedEmail.data,
          limit: rateLimit.limit,
          retryAfterMs: rateLimit.retryAfterMs,
        },
      })
      toast.error('Trop de demandes', {
        description: `Réessayez dans ${formatRetryAfter(rateLimit.retryAfterMs)}.`,
      })
      return
    }

    setSubmitting(true)
    const result = await auth.signInWithMagicLink(parsedEmail.data, {
      returnTo,
    })
    setSubmitting(false)

    if (result.ok) {
      void securityEvents.logEvent({
        eventType: 'magic_link_sent',
        metadata: {
          email: parsedEmail.data,
          remaining: rateLimit.remaining,
        },
      })
      setSentTo(parsedEmail.data)
      toast.success('Lien de connexion envoyé', {
        description: 'Vérifiez votre boîte email (et vos spams).',
      })
    } else {
      setSentTo(null)
      toast.error('Connexion indisponible', { description: result.message })
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setFailure(null)
    setPassword('')
  }

  const passwordMode = mode === 'password'
  const emailKnown = parsedEmail.success ? parsedEmail.data : undefined

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
          <div className="mb-6">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Votre espace pro
            </div>
            <h1 className="mt-2 font-display text-3xl tracking-tight">
              Accédez à votre espace pro.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {passwordMode
                ? 'Votre email professionnel et votre mot de passe : vos devis, réservations et factures vous attendent.'
                : 'Entrez votre email professionnel : nous vous envoyons un lien de connexion, valable une heure. Aucun mot de passe à retenir.'}
            </p>
          </div>

          {!auth.isConfigured && (
            <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80 mb-5 rounded-md border p-3 text-xs leading-5">
              La connexion est momentanément indisponible. Merci de réessayer
              dans quelques minutes, ou écrivez-nous via{' '}
              <a className="underline" href="/contact">
                le formulaire de contact
              </a>
              .
            </div>
          )}

          {passwordMode ? (
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <ValidatedInput
                id="auth-email"
                label="Email professionnel"
                type="email"
                value={email}
                onValueChange={(value) => {
                  setEmail(value)
                  setFailure(null)
                }}
                placeholder="direction@hotel.fr"
                autoComplete="email"
                error={emailError}
                required
              />

              <PasswordField
                id="auth-password"
                label="Mot de passe"
                value={password}
                onValueChange={(value) => {
                  setPassword(value)
                  setFailure(null)
                }}
                autoComplete="current-password"
                required
                trailing={
                  <Link
                    to="/auth/mot-de-passe-oublie"
                    search={{ email: emailKnown }}
                    className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    Mot de passe oublié ?
                  </Link>
                }
              />

              {failure && (
                <div
                  role="alert"
                  className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs leading-5 text-foreground"
                >
                  {failure.message}
                  {failure.reason === 'email_not_confirmed' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span>Besoin d’un nouveau lien ?</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-sm border-[color:var(--sand-deep)] bg-card"
                        disabled={resending || !parsedEmail.success}
                        onClick={() => void handleResendActivation()}
                      >
                        {resending ? 'Envoi…' : "Renvoyer l'email d'activation"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={
                  submitting ||
                  !parsedEmail.success ||
                  !password ||
                  !auth.isConfigured
                }
                className={PRIMARY_BUTTON}
              >
                <LogIn className="h-4 w-4" />
                {!auth.isConfigured
                  ? 'Connexion momentanément indisponible'
                  : submitting
                    ? 'Connexion…'
                    : 'Se connecter'}
              </Button>

              <div
                className="flex items-center gap-3 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                <span className="h-px flex-1 bg-[color:var(--sand-deep)]" />
                ou
                <span className="h-px flex-1 bg-[color:var(--sand-deep)]" />
              </div>

              <Button
                type="button"
                variant="outline"
                className={SECONDARY_BUTTON}
                onClick={() => switchMode('magic')}
              >
                <Mail className="h-4 w-4" />
                Recevoir un lien de connexion par email
              </Button>
            </form>
          ) : (
            <>
              {sentTo && (
                <div className="border-[color:var(--forest)]/30 bg-[color:var(--forest)]/10 mb-5 rounded-md border p-3 text-xs leading-5 text-foreground">
                  <strong className="font-medium">
                    Lien envoyé à {sentTo}.
                  </strong>{' '}
                  Il arrive dans la minute, reste valable une heure et ne sert
                  qu’une fois. Vous pouvez l’ouvrir sur l’appareil de votre
                  choix. Pensez à regarder vos spams.
                </div>
              )}

              <form className="space-y-4" onSubmit={handleMagicLinkSubmit}>
                <ValidatedInput
                  id="auth-email"
                  label="Email professionnel"
                  type="email"
                  value={email}
                  onValueChange={setEmail}
                  placeholder="direction@hotel.fr"
                  autoComplete="email"
                  error={emailError}
                  required
                />

                <Button
                  type="submit"
                  disabled={
                    submitting || !parsedEmail.success || !auth.isConfigured
                  }
                  className={PRIMARY_BUTTON}
                >
                  <Mail className="h-4 w-4" />
                  {!auth.isConfigured
                    ? 'Connexion momentanément indisponible'
                    : submitting
                      ? 'Envoi…'
                      : sentTo
                        ? 'Renvoyer un lien'
                        : 'Recevoir mon lien'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('password')}
                    className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    Revenir au mot de passe
                  </button>
                </div>
              </form>
            </>
          )}

          <p className="mt-6 border-t border-[color:var(--sand-deep)] pt-5 text-center text-sm text-muted-foreground">
            Pas encore d’espace ?{' '}
            <Link
              to="/auth/inscription"
              search={{ returnTo }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Créer mon espace
            </Link>
          </p>

          <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Connexion chiffrée. Un lien par email reste disponible à tout
              moment.
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Expéditeur : Terrassea. Vérifiez vos spams la première fois.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Devis, réservations, factures et favoris réunis au même endroit.
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}

/**
 * Même règle que le retour du lien par email : fiche incomplète → création
 * de l'espace, sinon la destination demandée. Une requête qui ne répond pas
 * ne doit pas retenir le client ici.
 */
async function destinationAfterSignIn(
  user: {
    readonly id: string
    readonly user_metadata?: Record<string, unknown>
  },
  returnTo: string,
): Promise<string> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return returnTo

  let complete = false
  try {
    const client = createSupabaseBrowserClient(
      config,
    ) as unknown as ProfileClient
    const profile = await Promise.race([
      loadMyProfile(client, user.id),
      new Promise<never>((_, reject) =>
        window.setTimeout(
          () => reject(new Error('profile_timeout')),
          PROFILE_READ_TIMEOUT_MS,
        ),
      ),
    ])
    complete = isProfileComplete({
      ...profile,
      companyName: companyNameFromUser(user),
    })
  } catch {
    complete = false
  }
  return resolvePostLoginDestination({ complete, returnTo })
}
