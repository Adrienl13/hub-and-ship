import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, KeyRound, MailCheck, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useAuth } from '@/hooks/useAuth'
import { EMAIL_ERRORS, RESET_RATE_LIMIT } from '@/lib/auth/password'
import { consumeRateLimit, formatRetryAfter } from '@/lib/security/rate-limit'
import { businessEmailSchema } from '@/lib/validation/schemas'

const forgotSearchSchema = z.object({
  // Adresse déjà saisie sur la page de connexion : on la reprend.
  email: z.string().optional(),
})

export const Route = createFileRoute('/auth/mot-de-passe-oublie')({
  component: ForgotPasswordPage,
  validateSearch: forgotSearchSchema,
  head: () => ({
    meta: [
      { title: 'Mot de passe oublié — Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

const PRIMARY_BUTTON =
  'h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]'

function ForgotPasswordPage() {
  const auth = useAuth()
  const { email: initialEmail } = Route.useSearch()
  const [email, setEmail] = useState(initialEmail ?? '')
  const [submitting, setSubmitting] = useState(false)
  // L'écran « Email envoyé » reste affiché : sur mobile, le client part lire
  // sa boîte mail et revient ; un toast aurait disparu entre-temps.
  const [sentTo, setSentTo] = useState<string | null>(null)
  const parsedEmail = businessEmailSchema.safeParse(email)
  const emailError =
    email && !parsedEmail.success ? EMAIL_ERRORS.invalid : undefined

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parsedEmail.success || submitting) return

    const rateLimit = consumeRateLimit({
      key: `auth:reset:${parsedEmail.data}`,
      ...RESET_RATE_LIMIT,
    })
    if (!rateLimit.allowed) {
      toast.error('Trop de demandes', {
        description: `Réessayez dans ${formatRetryAfter(rateLimit.retryAfterMs)}.`,
      })
      return
    }

    setSubmitting(true)
    const result = await auth.requestPasswordReset(parsedEmail.data)
    setSubmitting(false)

    if (result.ok) {
      // Réponse neutre : le même écran que l'adresse soit connue ou non.
      setSentTo(parsedEmail.data)
    } else {
      toast.error('Envoi impossible', { description: result.message })
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <Link
          to="/auth/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Revenir à la connexion
        </Link>

        <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6">
          {sentTo ? (
            <EmailSent email={sentTo} />
          ) : (
            <>
              <div className="mb-6">
                <div className="label-eyebrow text-[color:var(--ember)]">
                  Votre espace pro
                </div>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                  Mot de passe oublié ?
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Indiquez votre email professionnel : nous vous envoyons un
                  lien pour choisir un nouveau mot de passe. Il vous connecte
                  aussi dans la foulée.
                </p>
              </div>

              {!auth.isConfigured && (
                <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80 mb-5 rounded-md border p-3 text-xs leading-5">
                  La connexion est momentanément indisponible. Merci de
                  réessayer dans quelques minutes, ou écrivez-nous via{' '}
                  <a className="underline" href="/contact">
                    le formulaire de contact
                  </a>
                  .
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <ValidatedInput
                  id="forgot-email"
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
                  <KeyRound className="h-4 w-4" />
                  {!auth.isConfigured
                    ? 'Momentanément indisponible'
                    : submitting
                      ? 'Envoi…'
                      : 'Recevoir le lien'}
                </Button>
              </form>

              <ul className="mt-6 space-y-2 border-t border-[color:var(--sand-deep)] pt-5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Le lien ne sert qu’une fois et reste valable une heure.
                </li>
                <li className="flex items-start gap-2">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Expéditeur : Terrassea. Vérifiez vos spams la première fois.
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
 * Toujours le même écran, que l'adresse ait un espace ou non : rien ne doit
 * permettre de deviner si un email est connu chez nous.
 */
function EmailSent({ email }: { readonly email: string }) {
  return (
    <div className="text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
        <MailCheck className="h-5 w-5" />
      </div>
      <div className="label-eyebrow text-[color:var(--ember)]">
        Votre espace pro
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        Email envoyé.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Si un espace existe pour{' '}
        <span className="font-medium text-foreground">{email}</span>, un email
        vient de partir. Un clic sur « Choisir mon mot de passe » et vous le
        choisissez en quelques secondes.
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Il arrive dans la minute. Rien reçu ? Regardez vos spams, ou vérifiez
        l’adresse saisie.
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-6 h-11 w-full rounded-sm border-[color:var(--sand-deep)] bg-card text-foreground hover:bg-[color:var(--sand-soft)]"
      >
        <Link to="/auth/login">Revenir à la connexion</Link>
      </Button>
    </div>
  )
}
