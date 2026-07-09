import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useAuth } from '@/hooks/useAuth'
import { useSecurityEvents } from '@/hooks/useSecurityEvents'
import {
  consumeRateLimit,
  formatRetryAfter,
  MAGIC_LINK_RATE_LIMIT,
} from '@/lib/security/rate-limit'
import { businessEmailSchema } from '@/lib/validation/schemas'

function sanitizeReturnTo(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (!value.startsWith('/')) return undefined
  if (value.startsWith('//')) return undefined
  return value
}

const loginSearchSchema = z.object({
  returnTo: z.string().optional(),
})

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
  validateSearch: loginSearchSchema,
  head: () => ({
    meta: [
      { title: 'Connexion — Container Club Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

function LoginPage() {
  const auth = useAuth()
  const securityEvents = useSecurityEvents()
  const { returnTo: rawReturnTo } = Route.useSearch()
  const returnTo = sanitizeReturnTo(rawReturnTo)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const parsedEmail = businessEmailSchema.safeParse(email)
  const emailError =
    email && !parsedEmail.success ? 'Email invalide' : undefined
  const passwordError =
    password && password.length < 6
      ? 'Mot de passe trop court'
      : undefined

  // Already signed in? Bounce them to their destination — no need to send
  // another magic link.
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    window.location.assign(returnTo ?? '/account/reservations')
  }, [auth.status, returnTo])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!parsedEmail.success || password.length < 6) return

    setSubmitting(true)
    const result = await auth.signInWithPassword(parsedEmail.data, password)
    setSubmitting(false)

    if (result.ok) {
      void securityEvents.logEvent({
        eventType: 'login_attempt',
        metadata: {
          email: parsedEmail.data,
          method: 'password',
          outcome: 'success',
        },
      })
      toast.success('Connexion réussie')
      window.location.assign(returnTo ?? '/account/reservations')
    } else {
      void securityEvents.logEvent({
        eventType: 'login_attempt',
        severity: 'warning',
        metadata: {
          email: parsedEmail.data,
          method: 'password',
          outcome: 'failed',
        },
      })
      toast.error('Connexion refusée', { description: result.message })
    }
  }

  const handleMagicLink = async () => {
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

    setSendingMagicLink(true)
    const result = await auth.signInWithMagicLink(parsedEmail.data, {
      returnTo,
    })
    setSendingMagicLink(false)

    if (result.ok) {
      void securityEvents.logEvent({
        eventType: 'magic_link_sent',
        metadata: {
          email: parsedEmail.data,
          remaining: rateLimit.remaining,
        },
      })
      toast.success('Lien de connexion envoyé', {
        description: 'Vérifiez votre boîte email (et vos spams).',
      })
    } else {
      toast.error('Connexion indisponible', { description: result.message })
    }
  }

  return (
    <main id="contenu" className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
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
              Connexion sécurisée.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Connectez-vous avec votre email et votre mot de passe. Le lien
              magique reste disponible si vous n'avez pas encore défini de mot
              de passe.
            </p>
          </div>

          {!auth.isConfigured && (
            <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80 mb-5 rounded-md border p-3 text-xs leading-5">
              La connexion est momentanément indisponible. Merci de réessayer
              dans quelques minutes, ou écrivez-nous à{' '}
              <a className="underline" href="mailto:contact@prosimport.com">
                contact@prosimport.com
              </a>
              .
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
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

            <ValidatedInput
              id="auth-password"
              label="Mot de passe"
              type="password"
              value={password}
              onValueChange={setPassword}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              error={passwordError}
              required
            />

            <Button
              type="submit"
              disabled={
                submitting ||
                password.length < 6 ||
                !parsedEmail.success ||
                !auth.isConfigured
              }
              className="h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              <KeyRound className="h-4 w-4" />
              {!auth.isConfigured
                ? 'Connexion momentanément indisponible'
                : submitting
                  ? 'Connexion…'
                  : 'Se connecter'}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={
                sendingMagicLink || !parsedEmail.success || !auth.isConfigured
              }
              onClick={handleMagicLink}
              className="h-11 w-full rounded-sm border-[color:var(--sand-deep)] bg-card"
            >
              <Mail className="h-4 w-4" />
              {sendingMagicLink
                ? 'Envoi du lien…'
                : 'Recevoir un lien magique'}
            </Button>
          </form>

          <ul className="mt-6 space-y-2 border-t border-[color:var(--sand-deep)] pt-5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Connexion chiffrée et contrôlée par Supabase.
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Le lien magique reste une solution de secours si besoin.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Vos réservations, paiements et factures réunis au même endroit.
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
