import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Quote, Star } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import {
  getFallbackDeliveredContainerBySlug,
  getDeliveredContainerBySlug,
  type DeliveredContainer,
} from '@/lib/delivered-containers/repository'
import { formatEUR } from '@/lib/order'
import { CATEGORY_LABEL } from '@/lib/products'
import { buildSeoHead } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCatalog } from '@/hooks/useCatalog'
import { useCart } from '@/stores/cart.store'

export const Route = createFileRoute('/livres/$slug')({
  component: LivreDetailPage,
  head: ({ params }) => {
    const container = getFallbackDeliveredContainerBySlug(params.slug)
    if (!container) {
      return {
        meta: [
          { title: 'Container livré — Container Club Terrassea' },
          { name: 'robots', content: 'noindex,follow' },
        ],
      }
    }

    return {
      ...buildSeoHead({
        title: `${container.reference} livré à ${container.port}`,
        description:
          container.story ??
          `Retour d'expérience du container ${container.reference} livré à ${container.port} : produits, délais, volumes et preuve opérationnelle.`,
        path: `/livres/${params.slug}`,
        image: container.photoUrl ?? container.gallery[0]?.url,
      }),
    }
  },
})

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function LivreDetailPage() {
  const { slug } = Route.useParams()
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [container, setContainer] = useState<DeliveredContainer | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      const fallback = getFallbackDeliveredContainerBySlug(slug)
      if (!fallback) {
        setIsNotFound(true)
      } else {
        setContainer(fallback)
        if (typeof document !== 'undefined') {
          document.title = `${fallback.reference} — Container Club Terrassea`
        }
      }
      setLoading(false)
      return
    }

    const client = createSupabaseBrowserClient(config)
    void getDeliveredContainerBySlug(client, slug)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setIsNotFound(true)
        } else {
          setContainer(data)
          if (typeof document !== 'undefined') {
            document.title = `${data.reference} — Container Club Terrassea`
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const fallback = getFallbackDeliveredContainerBySlug(slug)
        if (fallback) {
          setContainer(fallback)
          setError(null)
        } else {
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      {loading ? (
        <main className="mx-auto max-w-7xl px-6 py-12">
          <div className="bg-primary/10 h-72 animate-pulse rounded-md" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-primary/10 h-24 animate-pulse rounded-md"
              />
            ))}
          </div>
        </main>
      ) : isNotFound ? (
        (() => {
          throw notFound()
        })()
      ) : error ? (
        <main className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl">Erreur</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        </main>
      ) : container ? (
        <DeliveredContainerView container={container} />
      ) : null}

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

function DeliveredContainerView({
  container,
}: {
  readonly container: DeliveredContainer
}) {
  const heroPhoto =
    container.photoUrl ??
    container.gallery[0]?.url ??
    'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=1600&q=80'

  return (
    <main>
      <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
        <div className="mx-auto max-w-7xl px-6 pt-10">
          <Link
            to="/livres"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Tous les containers livrés
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="label-eyebrow text-[color:var(--ember)]">
                Container livré
              </div>
              <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
                {container.reference}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {container.originPort && <>De {container.originPort} → </>}
                Port d&apos;arrivée {container.port}
                {container.deliveredAt && (
                  <> · Livré le {formatDate(container.deliveredAt)}</>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-7xl px-6 pb-10">
          <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            <img
              src={heroPhoto}
              alt={`Container ${container.reference}`}
              className="max-h-[60vh] w-full object-cover"
            />
          </div>
        </div>
      </section>

      <StatsInline container={container} />

      {container.story && (
        <Section title="Histoire du container">
          <p className="text-foreground/85 max-w-3xl whitespace-pre-line text-sm leading-7">
            {container.story}
          </p>
        </Section>
      )}

      {container.timeline.length > 0 && (
        <Section title="Timeline">
          <ol className="space-y-4">
            {container.timeline.map((step, i) => (
              <li
                key={`${step.date}-${i}`}
                className="grid grid-cols-[24px_1fr] gap-3 md:grid-cols-[120px_24px_1fr]"
              >
                <span className="hidden text-xs text-muted-foreground md:block">
                  {formatDate(step.date)}
                </span>
                <span
                  className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                    step.status === 'done'
                      ? 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]'
                      : 'bg-[color:var(--ochre)]/15 text-[color:var(--ochre)]'
                  }`}
                  aria-label={step.status === 'done' ? 'Étape OK' : 'Retard'}
                >
                  {step.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <div className="text-sm font-medium">{step.label}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {step.description}
                  </p>
                  <div className="mt-1 text-[10px] text-muted-foreground md:hidden">
                    {formatDate(step.date)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {container.productBreakdown.length > 0 && (
        <Section title="Produits livrés">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {container.productBreakdown.map((b, i) => (
              <div
                key={`${b.category}-${i}`}
                className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
              >
                <div className="label-eyebrow text-muted-foreground">
                  {CATEGORY_LABEL[b.category]}
                </div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
                  {b.units}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {b.modelLabel}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {container.gallery.length > 0 && (
        <Section title="Galerie">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {container.gallery.map((g, i) => (
              <figure
                key={`${g.url}-${i}`}
                className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
              >
                <img
                  src={g.url}
                  alt={g.caption}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="p-3 text-xs text-muted-foreground">
                  {g.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {container.certifications.length > 0 && (
        <Section title="Certifications & contrôles">
          <ul className="flex flex-wrap gap-2">
            {container.certifications.map((c, i) => (
              <li
                key={`${c}-${i}`}
                className="rounded-full border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-1 text-xs"
              >
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(container.testimonial.longQuote || container.testimonial.quote) && (
        <Section title="Témoignage">
          <figure className="max-w-3xl rounded-md border border-[color:var(--sand-deep)] bg-card p-6">
            <Quote className="text-[color:var(--ember)]/60 h-6 w-6" />
            <blockquote className="text-foreground/90 mt-3 text-base leading-7">
              {container.testimonial.longQuote ?? container.testimonial.quote}
            </blockquote>
            <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                {container.testimonial.author && (
                  <div className="font-medium">
                    {container.testimonial.author}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {[container.testimonial.role, container.testimonial.location]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {container.testimonial.rating != null && (
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < (container.testimonial.rating ?? 0)
                          ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
                          : 'text-[color:var(--sand-deep)]'
                      }`}
                    />
                  ))}
                </span>
              )}
            </figcaption>
          </figure>
        </Section>
      )}
    </main>
  )
}

function StatsInline({
  container,
}: {
  readonly container: DeliveredContainer
}) {
  const stats: Array<{ label: string; value: string }> = []
  if (container.professionalsServed != null) {
    stats.push({
      label: 'Pros servis',
      value: container.professionalsServed.toString(),
    })
  }
  if (container.totalItems != null) {
    stats.push({
      label: 'Articles livrés',
      value: container.totalItems.toString(),
    })
  }
  if (container.savingsTotalEur != null) {
    stats.push({
      label: 'Économies totales',
      value: formatEUR(container.savingsTotalEur),
    })
  }
  if (container.savingsPercent != null) {
    stats.push({
      label: 'Économies %',
      value: `${container.savingsPercent}%`,
    })
  }
  if (container.plannedDays != null && container.actualDays != null) {
    stats.push({
      label: 'Délai annoncé / réel',
      value: `${container.plannedDays}j / ${container.actualDays}j`,
    })
  }

  if (stats.length === 0) return null

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-6 py-8 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
          >
            <div className="label-eyebrow text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums">
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Section({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="font-display text-2xl tracking-tight">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}
