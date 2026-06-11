import { useEffect, useState } from 'react'
import { BadgeCheck, Building2, Loader2, Star } from 'lucide-react'

import type { Product } from '@/lib/products'
import {
  aggregateReviews,
  fetchPublishedReviews,
  type ProductReview,
  type ReviewsReadClient,
} from '@/lib/reviews/reviews'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${
            index < Math.round(rating)
              ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
              : 'text-[color:var(--sand-deep)]'
          }`}
        />
      ))}
    </span>
  )
}

export function ProductReviews({ product }: { product: Product }) {
  const [reviews, setReviews] = useState<ReadonlyArray<ProductReview>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as ReviewsReadClient
        const list = await fetchPublishedReviews(client, product.id)
        if (!cancelled) setReviews(list)
      } catch {
        // non-blocking: a reviews fetch failure must not break the product view
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.id])

  const stats = aggregateReviews(reviews)

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Avis clients vérifiés
          </div>
          {stats.count > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-display text-2xl font-semibold tabular-nums">
                {stats.average.toFixed(1)}
              </span>
              <div>
                <RatingStars rating={stats.average} />
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {stats.count} avis après achat vérifié
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              Pas encore d'avis sur ce produit.
            </div>
          )}
        </div>
        <span className="bg-[color:var(--forest)]/10 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium text-[color:var(--forest)]">
          <BadgeCheck className="h-3 w-3" />
          Achat vérifié
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Chargement des avis…
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-3 text-[11px] text-muted-foreground">
          Soyez informé : les avis sont publiés uniquement par des
          professionnels ayant réellement commandé ce produit, après validation.
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {review.companyName ?? review.authorName}
                    </span>
                    {review.verifiedPurchase && (
                      <BadgeCheck className="h-3 w-3 shrink-0 text-[color:var(--forest)]" />
                    )}
                  </div>
                  {review.title && (
                    <div className="mt-0.5 truncate text-[11px] font-medium">
                      {review.title}
                    </div>
                  )}
                </div>
                <RatingStars rating={review.rating} />
              </div>
              <p className="text-foreground/80 mt-2 text-xs leading-5">
                « {review.body} »
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
