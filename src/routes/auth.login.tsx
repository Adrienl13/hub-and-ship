import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
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
  const [submitting, setSubmitting] = useState(false)
  const parsedEmail = businessEmailSchema.safeParse(email)
  const emailError =
    email && !parsedEmail.success ? 'Email invalide' : undefined

  // Already signed in? Bounce them to their destination — no need to send
  // another magic link.
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    window.location.assign(returnTo ?? '/account/reservations')
  }, [auth.status, returnTo])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      toast.success('Lien de connexion envoyé', {
        description: 'Vérifiez votre boîte email (et vos spams).',
      })
    } else {
      toast.error('Connexion indisponible', { description: result.message })
    }
  }

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
              Connexion sécurisée.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Entrez votre email : nous vous envoyons un lien de connexion. Aucun
              mot de passe à créer ni à retenir.
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

            <Button
              type="submit"
              disabled={
                submitting || !parsedEmail.success || !auth.isConfigured
              }
              className="h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              <Mail className="h-4 w-4" />
              {!auth.isConfigured
                ? 'Connexion momentanément indisponible'
                : submitting
                  ? 'Envoi…'
                  : 'Recevoir mon lien de connexion'}
            </Button>
          </form>

          <ul className="mt-6 space-y-2 border-t border-[color:var(--sand-deep)] pt-5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Connexion chiffrée, sans mot de passe à gérer.
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
              Le lien arrive par email (pensez à vérifier vos spams).
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
