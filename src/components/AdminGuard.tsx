import { Link } from '@tanstack/react-router'
import { Loader2, ShieldOff } from 'lucide-react'
import type { ReactNode } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'

interface AdminGuardProps {
  readonly children: ReactNode
  readonly onReserve?: () => void
}

/**
 * Wraps admin-only screens. Shows a sign-in CTA when anonymous, an "access
 * denied" screen when the user is authenticated but not admin/super_admin,
 * and renders children otherwise. RLS still enforces the actual access on
 * the server — this is the user-friendly UX layer in front.
 */
export function AdminGuard({ children, onReserve }: AdminGuardProps) {
  const auth = useAuth()
  const { isAdmin, isLoading: isCheckingRole } = useIsAdmin()
  const noop = () => undefined
  const returnTo =
    typeof window === 'undefined'
      ? '/admin'
      : `${window.location.pathname}${window.location.search}`

  if (auth.status === 'loading' || isCheckingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (auth.status === 'unconfigured') {
    return (
      <div className="min-h-screen bg-background">
        <Header onReserve={onReserve ?? noop} />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Authentification indisponible
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            L'authentification administrateur n'est pas encore active sur cet
            environnement. Variables publiques manquantes :{' '}
            <code>{auth.missingConfig.join(', ')}</code>. En local,
            renseignez-les dans <code>.env.local</code> puis redémarrez le
            serveur ; en production, ajoutez-les au build et redéployez.
          </p>
          <Link
            to="/"
            className="hover:bg-foreground/90 mt-6 inline-flex items-center justify-center rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Retour à l'accueil
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  if (auth.status !== 'authenticated') {
    return (
      <div className="min-h-screen bg-background">
        <Header onReserve={onReserve ?? noop} />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Espace administrateur
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connectez-vous avec un compte administrateur pour accéder à cette
            page.
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
            to="/"
            className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            Retour à l'accueil
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header onReserve={onReserve ?? noop} />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-[color:var(--ember)]" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Accès refusé
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre compte n'a pas les droits d'administration. Si vous pensez que
            c'est une erreur, contactez{' '}
            <a
              href="mailto:adrienlaniez1@gmail.com"
              className="text-foreground underline"
            >
              adrienlaniez1@gmail.com
            </a>
            .
          </p>
          <Link
            to="/account/reservations"
            className="hover:bg-foreground/90 mt-6 inline-flex items-center justify-center rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Mon espace pro
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return <>{children}</>
}
