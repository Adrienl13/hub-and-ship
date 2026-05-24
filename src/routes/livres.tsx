import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { DeliveredContainerCard } from '@/components/DeliveredContainerCard'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { useCatalog } from '@/hooks/useCatalog'
import {
  computeStats,
  listPublishedDeliveredContainers,
  type DeliveredContainersListItem,
  type DeliveredContainersStats,
} from '@/lib/delivered-containers/repository'
import { formatEUR } from '@/lib/order'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCart } from '@/stores/cart.store'

export const Route = createFileRoute('/livres')({
  component: LivresPage,
  head: () => ({
    meta: [
      { title: 'Containers livrés — Container Club Terrassea' },
      {
        name: 'description',
        content:
          'Historique transparent des containers livrés par Container Club : pros servis, articles, économies, ponctualité.',
      },
    ],
  }),
})

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

function LivresPage() {
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [containers, setContainers] = useState<
    ReadonlyArray<DeliveredContainersListItem>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setContainers([])
      setError('Supabase non configuré : impossible de charger les containers.')
      setLoading(false)
      return
    }

    const client = createSupabaseBrowserClient(config)
    void listPublishedDeliveredContainers(client)
      .then((data) => {
        if (cancelled) return
        setContainers(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const stats = computeStats(containers)

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main>
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Containers livrés
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
              La preuve par container.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--ink-soft)]">
              Chaque container terminé est documenté : pros servis, articles
              livrés, économies réelles, délais annoncés versus délais
              constatés.
            </p>

            <StatsGrid stats={stats} loading={loading} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary/10 h-80 animate-pulse rounded-md"
                />
              ))}
            </div>
          ) : error ? (
            <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm text-foreground">
              {error}
            </div>
          ) : containers.length === 0 ? (
            <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-6 py-16 text-center">
              <h2 className="font-display text-xl">
                Premier container en cours de livraison…
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Revenez bientôt : nos premiers containers livrés seront publiés
                ici dès leur arrivée à quai.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {containers.map((c) => (
                <DeliveredContainerCard key={c.id} container={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      <Suspense fallback={null}>
        {reserveOpen && (
          <LazyReservationDialog
            open={reserveOpen}
            onOpenChange={setReserveOpen}
            items={items}
            totals={totals}
            container={currentContainer}
          />
        )}
      </Suspense>
    </div>
  )
}

function StatsGrid({
  stats,
  loading,
}: {
  readonly stats: DeliveredContainersStats
  readonly loading: boolean
}) {
  const items: ReadonlyArray<{ label: string; value: string }> = loading
    ? []
    : [
        {
          label: 'Containers livrés',
          value: stats.totalContainers.toString(),
        },
        { label: 'Pros servis', value: stats.totalPros.toString() },
        { label: 'Articles livrés', value: stats.totalArticles.toString() },
        {
          label: 'Économies cumulées',
          value: formatEUR(stats.totalSavings),
        },
        {
          label: 'Ponctualité',
          value: `${stats.onTimeRate}%`,
        },
        {
          label: 'Économie moyenne',
          value: `${stats.avgSavingsPercent}%`,
        },
      ]

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {(loading ? Array.from({ length: 6 }) : items).map((it, i) => (
        <div
          key={i}
          className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
        >
          {loading ? (
            <div className="bg-primary/10 h-10 animate-pulse rounded" />
          ) : (
            <>
              <div className="label-eyebrow text-muted-foreground">
                {(it as { label: string; value: string }).label}
              </div>
              <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {(it as { label: string; value: string }).value}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
