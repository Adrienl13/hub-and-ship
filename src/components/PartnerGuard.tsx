import { Link } from '@tanstack/react-router'
import { Loader2, Handshake, ShieldOff } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useChannel } from '@/hooks/useChannel'
import { claimPartnerAccess, type PartnerPortalClient } from '@/lib/partners/portal'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

interface PartnerGuardProps {
  readonly children: ReactNode
  readonly onReserve?: () => void
}

/**
 * Wraps partner-only screens. On mount for an authenticated user it runs
 * `claim_partner_access()`, which self-links the caller to any approved
 * application matching their verified email. Access is granted only when the
 * claim resolves to at least one linked application. RLS enforces the real
 * data scoping; this is the UX layer in front.
 */
export function PartnerGuard({ children, onReserve }: PartnerGuardProps) {
  const auth = useAuth()
  // Second critère d'admission (ex-gate /partenaire) : un compte relié à une
  // société sur un canal négocié est partenaire même sans candidature au même
  // email (ex. grand compte provisionné à la main par l'admin).
  const { channel, isLoading: channelLoading } = useChannel()
  const [state, setState] = useState<
    'idle' | 'claiming' | 'granted' | 'denied' | 'error'
  >('idle')

  const client = useMemo(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config) as unknown as PartnerPortalClient
  }, [])

  useEffect(() => {
    if (!client || auth.status !== 'authenticated') return
    let cancelled = false
    setState('claiming')
    void claimPartnerAccess(client)
      .then((ids) => {
        if (cancelled) return
        setState(ids.length > 0 ? 'granted' : 'denied')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [client, auth.status])

  const returnTo =
    typeof window === 'undefined'
      ? '/partner'
      : `${window.location.pathname}${window.location.search}`

  if (
    auth.status === 'loading' ||
    (auth.status === 'authenticated' &&
      (state === 'idle' ||
        state === 'claiming' ||
        (state === 'denied' && channelLoading)))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (auth.status === 'unconfigured') {
    return (
      <PartnerGuardShell onReserve={onReserve} icon="off">
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          Authentification indisponible
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          L'espace partenaire nécessite l'authentification, qui n'est pas active
          sur cet environnement.
        </p>
        <BackHome />
      </PartnerGuardShell>
    )
  }

  if (auth.status !== 'authenticated') {
    return (
      <PartnerGuardShell onReserve={onReserve} icon="handshake">
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          Espace partenaire
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Connectez-vous avec l'email de votre candidature partenaire pour
          accéder à vos deals protégés, votre lien co-brandé et vos réservations
          attribuées.
        </p>
        <Button
          asChild
          className="hover:bg-foreground/90 mt-6 h-11 w-full rounded-sm bg-foreground text-background"
        >
          <Link to="/auth/login" search={{ returnTo }}>
            Se connecter
          </Link>
        </Button>
        <Link
          to="/partenaires"
          className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
        >
          Devenir partenaire
        </Link>
      </PartnerGuardShell>
    )
  }

  if (state === 'denied' && channel !== 'direct') {
    return <>{children}</>
  }

  if (state !== 'granted') {
    return (
      <PartnerGuardShell onReserve={onReserve} icon="off">
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          Accès partenaire en attente
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {state === 'error'
            ? "Impossible de vérifier votre accès partenaire pour le moment. Réessayez dans un instant."
            : "Aucune candidature partenaire approuvée n'est associée à cet email. Déposez une demande, ou contactez-nous si votre dossier est en cours."}
        </p>
        <Button
          asChild
          className="hover:bg-foreground/90 mt-6 h-11 w-full rounded-sm bg-foreground text-background"
        >
          <Link to="/partenaires">Déposer une demande partenaire</Link>
        </Button>
        <a
          href="mailto:contact@prosimport.com"
          className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
        >
          Mon dossier est en cours — nous contacter
        </a>
      </PartnerGuardShell>
    )
  }

  return <>{children}</>
}

function PartnerGuardShell({
  children,
  onReserve,
  icon,
}: {
  readonly children: ReactNode
  readonly onReserve?: () => void
  readonly icon: 'off' | 'handshake'
}) {
  const Icon = icon === 'handshake' ? Handshake : ShieldOff
  return (
    <div className="min-h-screen bg-background">
      <Header onReserve={onReserve} />
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <Icon className="mx-auto h-8 w-8 text-[color:var(--ember)]" />
        {children}
      </main>
      <Footer />
    </div>
  )
}

function BackHome() {
  return (
    <Link
      to="/"
      className="hover:bg-foreground/90 mt-6 inline-flex items-center justify-center rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background"
    >
      Retour à l'accueil
    </Link>
  )
}
