import { Link, createFileRoute } from '@tanstack/react-router'
import {
  FolderCheck,
  Loader2,
  ShieldCheck,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useAuth } from '@/hooks/useAuth'
import {
  buildOnboardingMetadata,
  companyNameFromUser,
  isProfileComplete,
  onboardingExitTarget,
  onboardingHref,
  validateOnboardingForm,
  type OnboardingErrors,
  type OnboardingForm,
} from '@/lib/account/onboarding'
import {
  loadMyProfile,
  toAccountProfilePatch,
  updateMyProfile,
  type ProfileClient,
} from '@/lib/account/profile'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const onboardingSearchSchema = z.object({
  returnTo: z.string().optional(),
  // `?edit=1` : revenir volontairement sur une fiche déjà complète.
  edit: z.string().optional(),
})

export const Route = createFileRoute('/account/bienvenue')({
  component: OnboardingPage,
  validateSearch: onboardingSearchSchema,
  head: () => ({
    meta: [
      { title: 'Créez votre espace — Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

const EMPTY_FORM: OnboardingForm = {
  firstName: '',
  lastName: '',
  companyName: '',
  phone: '',
  marketingConsent: false,
}

type FormStatus = 'loading' | 'ready' | 'redirecting'

const FIELD_IDS = {
  firstName: 'onboarding-first-name',
  lastName: 'onboarding-last-name',
  companyName: 'onboarding-company',
  phone: 'onboarding-phone',
  marketingConsent: 'onboarding-consent',
} as const satisfies Record<keyof OnboardingForm, string>

const FIELD_ORDER: ReadonlyArray<keyof OnboardingForm> = [
  'firstName',
  'lastName',
  'companyName',
  'phone',
]

function OnboardingPage() {
  const { status, user, updateUserMetadata } = useAuth()
  const { returnTo, edit } = Route.useSearch()
  // Jamais la page elle-même : une fois l'espace créé, on sort d'ici.
  const target = onboardingExitTarget(returnTo)
  const editing = edit === '1'

  const [form, setForm] = useState<OnboardingForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<OnboardingErrors>({})
  const [formStatus, setFormStatus] = useState<FormStatus>('loading')
  const [submitting, setSubmitting] = useState(false)
  // Une seule lecture par utilisateur : l'objet `user` change d'identité à
  // chaque événement d'authentification (retour d'onglet, jeton rafraîchi),
  // et repréremplir écraserait ce que le client est en train de taper.
  const loadedForUserId = useRef<string | null>(null)

  // Préremplir depuis la fiche et les métadonnées ; une fiche déjà complète
  // n'a rien à faire ici (sauf modification volontaire) : on passe.
  const userId = user?.id
  const metaCompanyName = companyNameFromUser(user)
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return undefined
    if (loadedForUserId.current === userId) return undefined
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return undefined

    let cancelled = false
    loadedForUserId.current = userId
    const companyName = metaCompanyName

    void (async () => {
      let profile = {
        firstName: '',
        lastName: '',
        phone: '',
        marketingConsent: false,
      }
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as ProfileClient
        profile = await loadMyProfile(client, userId)
      } catch (err) {
        if (cancelled) return
        toast.error(
          'Fiche indisponible : ' +
            (err instanceof Error ? err.message : 'erreur inconnue'),
        )
      }
      if (cancelled) return

      const complete = isProfileComplete({ ...profile, companyName })
      if (complete && !editing) {
        setFormStatus('redirecting')
        window.location.replace(target)
        return
      }
      setForm({ ...profile, companyName })
      setFormStatus('ready')
    })()

    return () => {
      cancelled = true
    }
  }, [status, userId, metaCompanyName, editing, target])

  const setField = (field: keyof OnboardingForm) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || submitting) return

    const validation = validateOnboardingForm(form)
    if (!validation.ok) {
      setErrors(validation.errors)
      // Le focus va au premier champ à corriger, pour le clavier et les
      // lecteurs d'écran.
      const first = FIELD_ORDER.find((field) => validation.errors[field])
      if (first) document.getElementById(FIELD_IDS[first])?.focus()
      return
    }

    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      toast.error('Connexion momentanément indisponible.')
      return
    }

    setSubmitting(true)
    const now = new Date().toISOString()
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ProfileClient
      await updateMyProfile(client, user.id, toAccountProfilePatch(form, now))
      const metadata = await updateUserMetadata(
        buildOnboardingMetadata(form, now),
      )
      if (!metadata.ok) throw new Error(metadata.message)

      toast.success('Votre espace est prêt.')
      setFormStatus('redirecting')
      window.location.assign(target)
    } catch (err) {
      toast.error(
        'Enregistrement impossible : ' +
          (err instanceof Error ? err.message : 'erreur inconnue'),
      )
      setSubmitting(false)
    }
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
            <SessionClosed retryHref={loginHref(target)} />
          ) : status === 'loading' || formStatus !== 'ready' ? (
            <Opening />
          ) : (
            <>
              <div className="mb-6">
                <div className="label-eyebrow text-[color:var(--ember)]">
                  Votre espace pro
                </div>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                  {editing ? 'Modifiez votre fiche.' : 'Créez votre espace.'}
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Connecté avec{' '}
                  <span className="font-medium text-foreground">
                    {user?.email ?? 'votre email professionnel'}
                  </span>
                  . Trois informations, et vos devis sont préparés au nom de
                  votre établissement.
                </p>
              </div>

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
                  disabled={submitting}
                  className="h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
                >
                  {submitting
                    ? 'Enregistrement…'
                    : editing
                      ? 'Enregistrer'
                      : 'Créer mon espace'}
                </Button>
              </form>

              <ul className="mt-6 space-y-2 border-t border-[color:var(--sand-deep)] pt-5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Une seule fois : vos informations sont mémorisées.
                </li>
                <li className="flex items-start gap-2">
                  <FolderCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Devis, réservations, factures et favoris au même endroit.
                </li>
                <li className="flex items-start gap-2">
                  <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                  Modifiable à tout moment dans Paramètres du compte.
                </li>
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function loginHref(target: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(onboardingHref(target))}`
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
 * Le lien de connexion ne sert qu'une fois : arriver ici sans session, c'est
 * presque toujours un lien réutilisé ou une session fermée entre-temps.
 */
function SessionClosed({ retryHref }: { readonly retryHref: string }) {
  return (
    <div className="text-center">
      <div className="bg-[color:var(--ochre)]/20 mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm text-[color:var(--ember)]">
        <TriangleAlert className="h-5 w-5" />
      </div>
      <div className="label-eyebrow text-[color:var(--ember)]">
        Votre espace pro
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">
        Votre lien a expiré ou la session est fermée.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Demandez un nouveau lien : il arrive dans la minute et vous ramène
        directement ici.
      </p>
      <Button
        asChild
        className="mt-6 h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
      >
        <a href={retryHref}>Recevoir un nouveau lien</a>
      </Button>
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
