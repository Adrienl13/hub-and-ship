import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Copy, Gift, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { buildSeoHead } from '@/lib/seo'
import { formatEUR } from '@/lib/order'
import {
  getOrCreateMyReferralCode,
  type MyReferralSummary,
  type ReferralCodeClient,
} from '@/lib/referrals/repository'

export const Route = createFileRoute('/account/parrainage')({
  component: ReferralPage,
  head: () =>
    buildSeoHead({
      title: 'Parrainage',
      description: 'Parrainez vos confrères et gagnez 100 € par filleul.',
      path: '/account/parrainage',
      noindex: true,
    }),
})

function ReferralPage() {
  const { status } = useAuth()
  const [summary, setSummary] = useState<MyReferralSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as ReferralCodeClient
        const result = await getOrCreateMyReferralCode(client)
        if (!cancelled) setSummary(result)
      } catch (err) {
        if (!cancelled)
          toast.error(
            'Parrainage indisponible : ' +
              (err instanceof Error ? err.message : 'erreur'),
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  const shareUrl =
    summary && typeof window !== 'undefined'
      ? `${window.location.origin}/catalogue?ref=${encodeURIComponent(summary.code)}`
      : ''

  async function copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copié`)
    } catch {
      toast.error('Copie impossible', { description: value })
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">Mon espace</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Parrainez vos confrères
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Partagez votre code : votre filleul gagne{' '}
          <strong className="text-foreground">100 €</strong> sur ses frais de
          réservation, et vous gagnez{' '}
          <strong className="text-foreground">100 €</strong> à valoir.{' '}
          <Link
            to="/account"
            className="text-foreground underline underline-offset-4"
          >
            Retour au tableau de bord
          </Link>
        </p>

        {status !== 'authenticated' ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 p-4 text-sm">
            <span>Connectez-vous pour obtenir votre code de parrainage.</span>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              <Link to="/auth/login" search={{ returnTo: '/account/parrainage' }}>
                Se connecter
              </Link>
            </Button>
          </div>
        ) : loading || !summary ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Préparation de votre code…
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
              <div className="label-eyebrow text-muted-foreground">
                Votre code de parrainage
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-display text-2xl font-semibold tracking-wide">
                  {summary.code}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void copy(summary.code, 'Code')}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copier le code
                </Button>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="text-xs text-muted-foreground">
                  Lien de partage (le code est pré-rempli au paiement)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1.5 text-xs">
                    {shareUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void copy(shareUrl, 'Lien')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier le lien
                  </Button>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <Users className="h-5 w-5 text-[color:var(--ember)]" />
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">
                    {summary.totalUses}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Filleuls parrainés
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <Gift className="h-5 w-5 text-[color:var(--forest)]" />
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">
                    {formatEUR(summary.pendingReward)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    À valoir (en attente)
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Vos gains « à valoir » sont crédités à chaque parrainage validé et
              appliqués par notre équipe sur une prochaine commande. Le
              parrainage ne peut pas être utilisé par votre propre société.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
