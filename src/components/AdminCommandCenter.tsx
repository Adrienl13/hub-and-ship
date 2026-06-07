import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

import {
  loadCommandCenterCounts,
  totalUrgencies,
  type CommandCenterClient,
  type CommandCenterCounts,
} from '@/lib/admin/command-center'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type CommandCenterTab = 'stock-requests' | 'partners' | 'reservations'

interface UrgencyCard {
  readonly key: string
  readonly count: number
  readonly title: string
  readonly hint: string
  readonly cta: string
  readonly tab: CommandCenterTab
}

function buildCards(counts: CommandCenterCounts): ReadonlyArray<UrgencyCard> {
  const partnersToQualify =
    counts.partnerApplicationsToReview + counts.partnerDealsToQualify
  return [
    {
      key: 'stock',
      count: counts.newStockRequests,
      title: 'Leads stock 24h à traiter',
      hint: 'Demandes entrantes non encore prises en charge.',
      cta: 'Ouvrir les demandes stock',
      tab: 'stock-requests',
    },
    {
      key: 'partners',
      count: partnersToQualify,
      title: 'Partenaires à qualifier',
      hint: `${counts.partnerApplicationsToReview} candidature(s) · ${counts.partnerDealsToQualify} opportunité(s) soumise(s).`,
      cta: 'Ouvrir les partenaires',
      tab: 'partners',
    },
    {
      key: 'payments',
      count: counts.reservationsPendingPayment,
      title: 'Réservations paiement en attente',
      hint: 'Frais de réservation non encore réglés.',
      cta: 'Ouvrir les réservations',
      tab: 'reservations',
    },
  ]
}

export function AdminCommandCenter({
  onNavigate,
}: {
  readonly onNavigate: (tab: CommandCenterTab) => void
}) {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [counts, setCounts] = useState<CommandCenterCounts | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    if (!config.isConfigured) {
      setState('error')
      return
    }
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as CommandCenterClient
        const next = await loadCommandCenterCounts(client)
        if (!cancelled) {
          setCounts(next)
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

  if (state === 'error') {
    // Stay silent rather than alarm: the dashboard KPIs still render below.
    return null
  }

  const cards = counts ? buildCards(counts) : []
  const total = counts ? totalUrgencies(counts) : 0
  const urgentCards = cards.filter((card) => card.count > 0)

  return (
    <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center gap-2">
        {total > 0 ? (
          <AlertTriangle className="h-4 w-4 text-[color:var(--ember)]" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-[color:var(--forest)]" />
        )}
        <h2 className="font-display text-lg font-semibold">
          Command Center
        </h2>
        {state === 'loaded' && (
          <span className="text-xs text-muted-foreground">
            {total > 0
              ? `${total} action(s) en attente`
              : 'Aucune urgence aujourd’hui'}
          </span>
        )}
      </div>

      {state === 'loading' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/50"
            />
          ))}
        </div>
      ) : urgentCards.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Tout est traité : aucun lead stock, partenaire ou paiement en
          attente. 👌
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {urgentCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => onNavigate(card.tab)}
              className="group flex flex-col rounded-sm border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/[0.06] p-3 text-left transition hover:bg-[color:var(--ember)]/10"
            >
              <span className="font-display text-3xl font-semibold leading-none text-[color:var(--ember)]">
                {card.count}
              </span>
              <span className="mt-1.5 text-sm font-medium">{card.title}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {card.hint}
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--ember)]">
                {card.cta}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
