import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Copy, Link2, ShieldCheck } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { PartnerGuard } from '@/components/PartnerGuard'
import { Button } from '@/components/ui/button'
import {
  loadPartnerWorkspace,
  type PartnerPortalClient,
  type PartnerWorkspace,
} from '@/lib/partners/portal'
import { buildPartnerSharePath } from '@/lib/partners/link'
import { PARTNER_DEAL_STATUS_LABEL } from '@/lib/partners/types'
import { ACCOUNT_RESERVATION_STATUS_LABEL } from '@/lib/account/reservations'
import { formatEUR } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export const Route = createFileRoute('/partner')({
  component: PartnerRoute,
  head: () =>
    buildSeoHead({
      title: 'Espace partenaire',
      description:
        'Espace partenaire Pros Import : deals protégés, lien co-brandé et réservations attribuées. Accès réservé aux partenaires approuvés.',
      path: '/partner',
      noindex: true,
    }),
})

function PartnerRoute() {
  return (
    <PartnerGuard>
      <PartnerDashboard />
    </PartnerGuard>
  )
}

function reservationStatusLabel(status: string): string {
  const labels = ACCOUNT_RESERVATION_STATUS_LABEL as Record<string, string>
  return labels[status] ?? status
}

function PartnerDashboard() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [workspace, setWorkspace] = useState<PartnerWorkspace | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as PartnerPortalClient
        const data = await loadPartnerWorkspace(client)
        if (!cancelled) {
          setWorkspace(data)
          setState('loaded')
        }
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  const application = workspace?.applications[0] ?? null
  const partnerName = application?.companyName ?? 'Partenaire'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Espace partenaire
        </div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          {partnerName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Vos deals protégés, votre lien co-brandé et les réservations
          attribuées à votre canal. Les prix nets partenaires et marges restent
          privés ; cette page ne les expose jamais.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
          >
            <a href="/partner/selections">Mes sélections co-brandées</a>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-9 px-3 text-xs">
            <a href="/partenaires#proteger">Protéger une opportunité</a>
          </Button>
        </div>

        {state === 'loading' ? (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/50"
              />
            ))}
          </div>
        ) : state === 'error' ? (
          <div className="mt-8 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            Impossible de charger votre espace partenaire pour le moment.
            Réessayez dans un instant.
          </div>
        ) : workspace ? (
          <div className="mt-8 space-y-6">
            <ShareLinkCard
              slug={application?.referralSlug ?? null}
              partnerName={partnerName}
            />
            <DealsCard deals={workspace.deals} />
            <AttributedReservationsCard
              reservations={workspace.reservations}
            />
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  )
}

function ShareLinkCard({
  slug,
  partnerName,
}: {
  readonly slug: string | null
  readonly partnerName: string
}) {
  const sharePath = slug ? buildPartnerSharePath({ slug }) : null
  const shareUrl =
    sharePath && typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : sharePath
        ? `https://prosimport.com${sharePath}`
        : null

  async function copy(): Promise<void> {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Lien copié', { description: shareUrl })
    } catch {
      toast.error('Copie impossible', { description: shareUrl })
    }
  }

  return (
    <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-[color:var(--ember)]" />
        <h2 className="font-display text-lg font-semibold">
          Votre lien co-brandé
        </h2>
      </div>
      {shareUrl ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Partagez ce lien : le projet reste rattaché à {partnerName}, sans
            jamais exposer vos prix nets.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="truncate rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/50 px-2 py-1.5 text-xs">
              {shareUrl}
            </code>
            <Button
              type="button"
              size="sm"
              onClick={() => void copy()}
              className="h-8 gap-1 px-2 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copier
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-xs"
            >
              <a href={sharePath ?? '#'} target="_blank" rel="noreferrer">
                Aperçu
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Votre lien co-brandé sera activé par notre équipe dès la validation de
          votre dossier. Vous pourrez alors le partager à vos clients.
        </p>
      )}
    </section>
  )
}

function DealsCard({
  deals,
}: {
  readonly deals: PartnerWorkspace['deals']
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--sand-deep)] px-5 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
          <h2 className="font-display text-lg font-semibold">
            Deals protégés ({deals.length})
          </h2>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
        >
          <a href="/partenaires#proteger">Protéger une opportunité</a>
        </Button>
      </div>
      {deals.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Aucune opportunité protégée pour l'instant. Déclarez un projet client
          pour le sécuriser sur votre canal.
        </p>
      ) : (
        <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
          {deals.map((deal) => (
            <li
              key={deal.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{deal.clientCompanyName}</div>
                <div className="text-xs text-muted-foreground">
                  {deal.projectType} · {deal.projectCity ?? 'ville à cadrer'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {deal.protectedUntil && (
                  <span className="text-[11px] text-muted-foreground">
                    Protégé jusqu'au{' '}
                    {new Date(deal.protectedUntil).toLocaleDateString('fr-FR')}
                  </span>
                )}
                <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-medium">
                  {PARTNER_DEAL_STATUS_LABEL[deal.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AttributedReservationsCard({
  reservations,
}: {
  readonly reservations: PartnerWorkspace['reservations']
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="border-b border-[color:var(--sand-deep)] px-5 py-3">
        <h2 className="font-display text-lg font-semibold">
          Réservations attribuées ({reservations.length})
        </h2>
      </div>
      {reservations.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Aucune réservation attribuée pour l'instant. Les commandes issues de
          votre lien ou de vos clients protégés apparaîtront ici.
        </p>
      ) : (
        <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
          {reservations.map((res) => (
            <li
              key={res.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-mono font-medium">{res.reference}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(res.createdAt).toLocaleDateString('fr-FR')}
                  {res.attributionReason ? ` · ${res.attributionReason}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatEUR(res.totalHt)}
                </span>
                <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-medium">
                  {reservationStatusLabel(res.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
