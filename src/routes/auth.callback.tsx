import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  companyNameFromUser,
  isProfileComplete,
  resolvePostLoginDestination,
} from '@/lib/account/onboarding'
import { loadMyProfile, type ProfileClient } from '@/lib/account/profile'
import {
  describeStalledCallback,
  parseMagicLinkCallback,
  type MagicLinkFailure,
} from '@/lib/auth/magic-link-callback'
import { DEFAULT_RETURN_TO, sanitizeReturnTo } from '@/lib/auth/return-to'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

/**
 * Délai de garde. Au-delà, l'échange ne se fera plus : dans le flux PKCE,
 * l'absence de `code_verifier` n'émet aucune erreur, elle laisse simplement
 * la page tourner indéfiniment. Sans ce délai, un client qui a ouvert son
 * lien sur un autre appareil reste bloqué sur un spinner.
 */
const CALLBACK_TIMEOUT_MS = 10_000

/** Lecture du profil après connexion : au-delà, direction la création de l'espace. */
const PROFILE_READ_TIMEOUT_MS = 4_000

const callbackSearchSchema = z.object({
  returnTo: z.string().optional(),
})

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
  validateSearch: callbackSearchSchema,
  head: () => ({
    meta: [
      { title: 'Validation connexion — Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

function AuthCallbackPage() {
  const { status, user, isConfigured, verifyMagicLinkToken } = useAuth()
  const { returnTo } = Route.useSearch()
  const authenticated = status === 'authenticated'
  const target = sanitizeReturnTo(returnTo, DEFAULT_RETURN_TO)
  const [failure, setFailure] = useState<MagicLinkFailure | null>(null)
  // Destination réelle : la création de l'espace si la fiche est incomplète
  // (première visite), sinon `target`. Connue une fois le profil lu.
  const [destination, setDestination] = useState<string | null>(null)
  const [delayElapsed, setDelayElapsed] = useState(false)

  // Lien `{{ .TokenHash }}` : on vérifie nous-mêmes, ce qui marche depuis
  // n'importe quel appareil. Sinon le client Supabase échange le `?code=`
  // tout seul et on attend simplement que la session s'ouvre.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const callback = parseMagicLinkCallback(
      window.location.search,
      window.location.hash,
    )

    if (callback.failure) {
      setFailure(callback.failure)
      return undefined
    }

    let cancelled = false

    if (callback.tokenHash) {
      void verifyMagicLinkToken(
        callback.tokenHash,
        callback.otpType ?? 'magiclink',
      ).then((result) => {
        if (cancelled || result.ok) return
        setFailure({
          code: 'verify_otp_failed',
          title: 'Ce lien a expiré.',
          detail:
            'Un lien de connexion ne sert qu’une fois et reste valable une heure. Demandez-en un nouveau, il arrive dans la minute.',
        })
      })
    }

    const timeout = window.setTimeout(() => {
      if (cancelled) return
      setFailure(
        (current) => current ?? describeStalledCallback(callback.hasPkceCode),
      )
    }, CALLBACK_TIMEOUT_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [verifyMagicLinkToken])

  // Une session ouverte efface tout échec : le délai de garde a pu se
  // déclencher juste avant que l'échange n'aboutisse.
  useEffect(() => {
    if (authenticated) setFailure(null)
  }, [authenticated])

  // Première visite ou fiche jamais complétée → création de l'espace. Une
  // lecture en échec compte comme incomplète : la page de création se
  // redirige elle-même si la fiche s'avère complète.
  // Dépendances scalaires : l'objet `user` change d'identité à chaque
  // rafraîchissement de jeton, ce qui relancerait la lecture pour rien.
  const userId = user?.id
  const companyName = companyNameFromUser(user)
  useEffect(() => {
    if (!authenticated || !userId) return undefined
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setDestination(target)
      return undefined
    }

    let cancelled = false

    void (async () => {
      let complete = false
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as ProfileClient
        // Une requête qui ne répond pas ne doit pas retenir le client ici :
        // au-delà du délai, on le traite comme une première visite.
        const profile = await Promise.race([
          loadMyProfile(client, userId),
          new Promise<never>((_, reject) =>
            window.setTimeout(
              () => reject(new Error('profile_timeout')),
              PROFILE_READ_TIMEOUT_MS,
            ),
          ),
        ])
        complete = isProfileComplete({ ...profile, companyName })
      } catch {
        complete = false
      }
      if (cancelled) return
      setDestination(
        resolvePostLoginDestination({ complete, returnTo: target }),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [authenticated, userId, companyName, target])

  // Brève pause pour que « Votre espace s'ouvre. » soit lu avant la
  // redirection ; elle court en parallèle de la lecture du profil.
  useEffect(() => {
    if (!authenticated) return undefined
    const id = window.setTimeout(() => setDelayElapsed(true), 800)
    return () => window.clearTimeout(id)
  }, [authenticated])

  useEffect(() => {
    if (!authenticated || !delayElapsed || !destination) return
    window.location.assign(destination)
  }, [authenticated, delayElapsed, destination])

  if (failure && !authenticated) {
    return (
      <MagicLinkFailurePanel
        failure={failure}
        retryHref={`/auth/login?returnTo=${encodeURIComponent(target)}`}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
            {authenticated ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Connexion
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            {authenticated
              ? 'Votre espace s’ouvre.'
              : 'Validation du lien de connexion.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {authenticated
              ? `Connecté avec ${user?.email ?? 'votre email professionnel'}. Redirection en cours…`
              : isConfigured
                ? 'Nous vérifions votre lien et ouvrons votre session.'
                : 'Supabase Auth sera actif dès que les variables locales seront configurées.'}
          </p>
          <Button
            asChild
            className="mt-6 h-11 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            <a href={authenticated ? (destination ?? target) : '/catalogue'}>
              {authenticated ? 'Continuer' : 'Retour au catalogue'}
            </a>
          </Button>
        </section>
      </div>
    </main>
  )
}

/**
 * Sortie de secours. Sans elle, un lien expiré ou ouvert sur un autre
 * appareil laissait la page tourner indéfiniment — sur le seul mode de
 * connexion du site.
 */
function MagicLinkFailurePanel({
  failure,
  retryHref,
}: {
  readonly failure: MagicLinkFailure
  readonly retryHref: string
}) {
  return (
    <main className="min-h-screen bg-[color:var(--sand-soft)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-center">
          <div className="bg-[color:var(--ochre)]/20 mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-sm text-[color:var(--ember)]">
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Connexion
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            {failure.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {failure.detail}
          </p>
          <Button
            asChild
            className="mt-6 h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            <a href={retryHref}>Recevoir un nouveau lien</a>
          </Button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Toujours bloqué ? Écrivez-nous à{' '}
            <a className="underline" href="mailto:contact@terrassea.com">
              contact@terrassea.com
            </a>{' '}
            ou appelez-nous, on ouvre votre accès à la main.
          </p>
        </section>
      </div>
    </main>
  )
}
