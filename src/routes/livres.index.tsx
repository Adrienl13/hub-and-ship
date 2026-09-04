import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Ship } from 'lucide-react'

import { DeliveredContainerCard } from '@/components/DeliveredContainerCard'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { useCatalog } from '@/hooks/useCatalog'
import {
  computeStats,
  listFallbackDeliveredContainers,
  listPublishedDeliveredContainers,
  listPublishedShippingContainers,
  type DeliveredContainersListItem,
  type DeliveredContainersStats,
  type ShippingContainerListItem,
} from '@/lib/delivered-containers/repository'
import { formatEUR } from '@/lib/order'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCart } from '@/stores/cart.store'
import { breadcrumbJsonLd, buildSeoHead, jsonLdScript } from '@/lib/seo'

export const Route = createFileRoute('/livres/')({
  component: LivresPage,
  // NOTE: this page currently renders an empty SSR shell and hydrates
  // client-side (ISSUE-003), so neither these head scripts nor body content
  // appear in the server HTML yet. Kept consistent with sibling pages; will
  // emit once the SSR bail on /livres is fixed.
  head: () => ({
    ...buildSeoHead({
      title: 'Containers livrés',
      description:
        'Historique transparent des containers livrés par Terrassea : pros servis, articles, économies, ponctualité.',
      path: '/livres',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Containers livrés', path: '/livres' },
        ]),
      ),
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
  const [shipping, setShipping] = useState<
    ReadonlyArray<ShippingContainerListItem>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setContainers(listFallbackDeliveredContainers())
      setError(null)
      setLoading(false)
      return
    }

    const client = createSupabaseBrowserClient(config)
    void Promise.all([
      listPublishedDeliveredContainers(client),
      // Les containers EN MER prouvent que les commandes continuent — un
      // échec de cette liste ne doit jamais casser la page (fallback []).
      listPublishedShippingContainers(client).catch(
        () => [] as ReadonlyArray<ShippingContainerListItem>,
      ),
    ])
      .then(([delivered, inTransit]) => {
        if (cancelled) return
        setContainers(delivered)
        setShipping(inTransit)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setContainers(listFallbackDeliveredContainers())
        setError(null)
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

        {/* Les commandes CONTINUENT : containers chargés, en mer — l'ETA
            sans le manifeste (les volumes détaillés ne sont publiés qu'à
            la livraison). */}
        {!loading && shipping.length > 0 && (
          <section className="mx-auto max-w-7xl px-6 pt-10">
            <div className="mb-4 max-w-2xl">
              <div className="label-eyebrow text-[color:var(--ember)]">
                En ce moment, sur l&apos;eau
              </div>
              <h2 className="mt-1 font-display text-2xl tracking-tight">
                Les commandes continuent.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shipping.map((c) => (
                <ShippingContainerCard key={c.id} container={c} />
              ))}
            </div>
          </section>
        )}

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

function formatEtaMonth(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function ShippingContainerCard({
  container,
}: {
  readonly container: ShippingContainerListItem
}) {
  const eta = formatEtaMonth(container.etaDate)
  return (
    <article className="border-[color:var(--ember)]/40 relative overflow-hidden rounded-md border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="border-[color:var(--ember)]/30 bg-[color:var(--ember)]/10 inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--ember)]">
          <span
            aria-hidden
            className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--ember)]"
          />
          En mer
        </span>
        <Ship className="text-[color:var(--ember)]/60 h-5 w-5" />
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
        Container {container.reference}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Chargé, contrôlé et expédié — en route vers {container.port}.
      </p>
      {eta && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Arrivée estimée :</span>{' '}
          <span className="capitalize">{eta}</span>
        </p>
      )}
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        La documentation complète (photos, contrôles, délais constatés) sera
        publiée ici à la livraison.
      </p>
    </article>
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
