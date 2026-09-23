import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { KeyRound, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { PasswordField } from '@/components/security/PasswordField'
import { useAuth } from '@/hooks/useAuth'
import {
  PASSWORD_ERRORS,
  PASSWORD_MIN_LENGTH,
  passwordStrength,
  validatePassword,
} from '@/lib/auth/password'
import { DEFAULT_RETURN_TO } from '@/lib/auth/return-to'

const passwordSearchSchema = z.object({
  // `?change=1` : changement volontaire depuis les paramètres du compte.
  change: z.string().optional(),
})

export const Route = createFileRoute('/account/mot-de-passe')({
  component: PasswordPage,
  validateSearch: passwordSearchSchema,
  head: () => ({
    meta: [
      { title: 'Votre mot de passe — Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

const PRIMARY_BUTTON =
  'h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]'

/**
 * Choix du mot de passe une fois connecté : après un lien « mot de passe
 * oublié » (la session vient de s'ouvrir), ou depuis les paramètres du compte
 * pour le changer. Les comptes anciens, créés par lien magique, passent par
 * ici pour se donner un premier mot de passe.
 */
function PasswordPage() {
  const { status, user, updatePassword } = useAuth()
  const navigate = useNavigate()
  const { change } = Route.useSearch()
  const changing = change === '1'
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmationError, setConfirmationError] = useState<
    string | undefined
  >()
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const validation = validatePassword(password)
    if (!validation.ok) {
      setPasswordError(validation.error)
      document.getElementById('password-new')?.focus()
      return
    }
    if (password !== confirmation) {
      setConfirmationError(PASSWORD_ERRORS.mismatch)
      document.getElementById('password-confirm')?.focus()
      return
    }

    setSubmitting(true)
    setFailure(null)
    const result = await updatePassword(password)
    if (!result.ok) {
      setSubmitting(false)
      setFailure(result.message)
      return
    }

    // Navigation dans l'application, pas un rechargement : le toast reste
    // visible sur le tableau de bord.
    toast.success('Mot de passe enregistré.')
    await navigate({ to: DEFAULT_RETURN_TO })
  }

  return (
    <main className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 font-display text-sm tracking-tight text-muted-foreground transition-colors hover:text-foreground"
        >
          Terrassea
        </Link>

        <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6">
          {status === 'unconfigured' ? (
            <Unconfigured />
          ) : status === 'anonymous' ? (
            <SessionClosed />
          ) : status === 'loading' ? (
            <Opening />
          ) : (
            <>
              <div className="mb-6">
                <div className="label-eyebrow text-[color:var(--ember)]">
                  Votre espace pro
                </div>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                  {changing
                    ? 'Changez votre mot de passe.'
                    : 'Choisissez votre mot de passe.'}
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Connecté avec{' '}
                  <span className="font-medium text-foreground">
                    {user?.email ?? 'votre email professionnel'}
                  </span>
                  . Il vous servira à chaque connexion, avec votre email.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <PasswordField
                  id="password-new"
                  label="Nouveau mot de passe"
                  value={password}
                  onValueChange={(value) => {
                    setPassword(value)
                    setPasswordError(undefined)
                    setFailure(null)
                  }}
                  autoComplete="new-password"
                  hint={`${PASSWORD_MIN_LENGTH} caractères minimum. Mélangez lettres, chiffres et signes pour plus de solidité.`}
                  error={passwordError}
                  strength={passwordStrength(password)}
                  required
                />
                <PasswordField
                  id="password-confirm"
                  label="Confirmez le mot de passe"
                  value={confirmation}
                  onValueChange={(value) => {
                    setConfirmation(value)
                    setConfirmationError(undefined)
                    setFailure(null)
                  }}
                  autoComplete="new-password"
                  error={confirmationError}
                  required
                />

                {failure && (
                  <div
                    role="alert"
                    className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs leading-5 text-foreground"
                  >
                    {failure}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !password || !confirmation}
                  className={PRIMARY_BUTTON}
                >
                  <KeyRound className="h-4 w-4" />
                  {submitting
                    ? 'Enregistrement…'
                    : 'Enregistrer mon mot de passe'}
                </Button>
              </form>

              <ul className="mt-6 space-y-2 border-t border-[color:var(--sand-deep)] pt-5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Vous pouvez aussi recevoir un lien de connexion par email à
                  tout moment.
                </li>
              </ul>
              {changing && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  <Link
                    to="/account/parametres"
                    className="underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    Revenir aux paramètres du compte
                  </Link>
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function Opening() {
  return (
    <div className="py-6 text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
      <div className="label-eyebrow text-[color:var(--ember)]">
        Votre espace pro
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        Ouverture de votre espace…
      </h1>
    </div>
  )
}

/**
 * Sans session, on ne peut pas enregistrer de mot de passe : le lien reçu a
 * expiré ou a déjà servi. Un nouveau lien ramène directement ici.
 */
function SessionClosed() {
  return (
    <div className="text-center">
      <div className="bg-[color:var(--ochre)]/20 mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm text-[color:var(--ember)]">
        <TriangleAlert className="h-5 w-5" />
      </div>
      <div className="label-eyebrow text-[color:var(--ember)]">
        Votre espace pro
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        Session fermée.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Le lien pour choisir votre mot de passe a expiré ou a déjà servi.
        Demandez-en un nouveau : il arrive dans la minute et vous ramène
        directement ici.
      </p>
      <Button asChild className={`mt-6 ${PRIMARY_BUTTON}`}>
        <Link to="/auth/mot-de-passe-oublie">Demander un nouveau lien</Link>
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">
        <Link
          to="/auth/login"
          search={{ returnTo: '/account/mot-de-passe' }}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}

function Unconfigured() {
  return (
    <div className="text-center">
      <div className="label-eyebrow text-[color:var(--ember)]">
        Votre espace pro
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        Connexion momentanément indisponible.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Merci de réessayer dans quelques minutes, ou écrivez-nous via{' '}
        <a className="underline" href="/contact">
          le formulaire de contact
        </a>
        .
      </p>
    </div>
  )
}
