import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const DEFAULT_RETURN_TO = '/account/reservations'

// Espaces et caractères de contrôle : les navigateurs les retirent en
// résolvant l'URL, ils masqueraient donc un préfixe hostile.
function hasUnsafeChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

// Seules les destinations internes sont acceptées : un `returnTo` absolu
// ferait sortir le visiteur du site quand le lien magique est partagé ou
// intercepté. Les navigateurs assimilent l'antislash à un slash, donc
// « /\evil.example » vaut « //evil.example » — d'où la normalisation AVANT
// les contrôles.
function sanitizeReturnTo(value: string | undefined): string {
  if (!value) return DEFAULT_RETURN_TO
  if (hasUnsafeChar(value)) return DEFAULT_RETURN_TO
  const normalized = value.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) return DEFAULT_RETURN_TO
  if (normalized.startsWith('//')) return DEFAULT_RETURN_TO
  try {
    const url = new URL(normalized, 'https://terrassea.invalid')
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_RETURN_TO
  }
}

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
  const { status, user, isConfigured } = useAuth()
  const { returnTo } = Route.useSearch()
  const authenticated = status === 'authenticated'
  const target = sanitizeReturnTo(returnTo)

  useEffect(() => {
    if (!authenticated) return
    // Brief delay so the user sees "Session activée" before being whisked
    // back to where they were trying to go.
    const id = window.setTimeout(() => {
      window.location.assign(target)
    }, 800)
    return () => window.clearTimeout(id)
  }, [authenticated, target])

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
            {authenticated ? 'Session activée.' : 'Validation du lien magique.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {authenticated
              ? `Connecté avec ${user?.email ?? 'votre email professionnel'}. Redirection en cours…`
              : isConfigured
                ? 'Supabase Auth finalise votre session.'
                : 'Supabase Auth sera actif dès que les variables locales seront configurées.'}
          </p>
          <Button
            asChild
            className="mt-6 h-11 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            <a href={authenticated ? target : '/catalogue'}>
              {authenticated ? 'Continuer' : 'Retour au catalogue'}
            </a>
          </Button>
        </section>
      </div>
    </main>
  )
}
