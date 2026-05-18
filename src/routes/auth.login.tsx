import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

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

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
})

function LoginPage() {
  const auth = useAuth()
  const securityEvents = useSecurityEvents()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const parsedEmail = businessEmailSchema.safeParse(email)
  const emailError =
    email && !parsedEmail.success ? 'Email invalide' : undefined

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
    const result = await auth.signInWithMagicLink(parsedEmail.data)
    setSubmitting(false)

    if (result.ok) {
      void securityEvents.logEvent({
        eventType: 'magic_link_sent',
        metadata: {
          email: parsedEmail.data,
          remaining: rateLimit.remaining,
        },
      })
      toast.success('Lien magique envoyé', { description: result.message })
    } else {
      toast.error('Connexion indisponible', { description: result.message })
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </a>

        <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6">
          <div className="mb-6">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Espace professionnel
            </div>
            <h1 className="mt-2 font-display text-3xl tracking-tight">
              Connexion par lien magique.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Entrez votre email professionnel. Aucun mot de passe à mémoriser,
              Supabase Auth enverra un lien de connexion sécurisé.
            </p>
          </div>

          {!auth.isConfigured && (
            <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80 mb-5 rounded-md border p-3 text-xs leading-5">
              Supabase Auth est prêt côté interface, mais les variables{' '}
              {auth.missingConfig.join(', ')} doivent encore être renseignées
              dans `.env.local`.
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
              disabled={submitting || !parsedEmail.success}
              className="h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              <Mail className="h-4 w-4" />
              {submitting ? 'Envoi...' : 'Recevoir mon lien magique'}
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Les accès admin demanderont une 2FA TOTP dans une phase suivante.
          </div>
        </section>
      </div>
    </main>
  )
}
