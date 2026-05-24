import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { DeliveredContainerCard } from '@/components/DeliveredContainerCard'
import { Reveal, RevealStagger, RevealItem } from '@/components/motion-helpers'
import {
  listPublishedDeliveredContainers,
  type DeliveredContainersListItem,
} from '@/lib/delivered-containers/repository'
import { PAST_CONTAINERS } from '@/lib/products'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

function toFallback(): ReadonlyArray<DeliveredContainersListItem> {
  return PAST_CONTAINERS.map((c, index) => ({
    id: `fallback-${index}`,
    reference: c.reference,
    slug: c.reference.toLowerCase(),
    port: c.port,
    deliveredAt: c.deliveredAt,
    professionalsServed: c.professionalsServed,
    totalItems: c.totalItems,
    plannedDays: c.plannedDays,
    actualDays: c.actualDays,
    photoUrl: c.photoUrl,
    savingsTotalEur: null,
    savingsPercent: null,
    testimonial: {
      quote: c.testimonial.quote,
      author: c.testimonial.author,
      location: c.testimonial.location,
      rating: c.testimonial.rating,
    },
  }))
}

export function PastContainers() {
  const [containers, setContainers] = useState<
    ReadonlyArray<DeliveredContainersListItem>
  >([])
  const [loading, setLoading] = useState(true)
  const [hasResult, setHasResult] = useState(false)

  useEffect(() => {
    let cancelled = false
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setContainers(toFallback().slice(0, 3))
      setHasResult(true)
      setLoading(false)
      return
    }

    const client = createSupabaseBrowserClient(config)
    void listPublishedDeliveredContainers(client)
      .then((data) => {
        if (cancelled) return
        setContainers(data.slice(0, 3))
        setHasResult(true)
      })
      .catch(() => {
        if (cancelled) return
        setContainers(toFallback().slice(0, 3))
        setHasResult(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section id="livres" className="border-t border-[color:var(--sand-deep)]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-primary/10 h-80 animate-pulse rounded-md"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (hasResult && containers.length === 0) {
    return null
  }

  return (
    <section id="livres" className="border-t border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Preuves
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Containers déjà livrés.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-[color:var(--ink-soft)]">
            Chaque container est documenté de la cale au quai : transparence sur
            les délais réels et la qualité reçue.
          </p>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {containers.map((c) => (
            <RevealItem key={c.id}>
              <DeliveredContainerCard container={c} />
            </RevealItem>
          ))}
        </RevealStagger>

        <div className="mt-10 flex justify-center">
          <Link
            to="/livres"
            className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
          >
            Voir tous les containers livrés
          </Link>
        </div>
      </div>
    </section>
  )
}
