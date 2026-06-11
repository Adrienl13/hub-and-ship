import { createFileRoute } from '@tanstack/react-router'
import { BadgeCheck, Building2, ExternalLink, Star } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { buildSeoHead, jsonLdScript, organizationJsonLd } from '@/lib/seo'
import {
  aggregateReviews,
  reviewFromRow,
  type ProductReview,
  type ProductReviewRow,
} from '@/lib/reviews/reviews'

// Paste your Google Business "write a review" link here once the profile is
// created (e.g. https://g.page/r/XXXX/review). Empty hides the Google CTA.
const GOOGLE_REVIEW_URL = ''

async function loadPublishedReviews(): Promise<ReadonlyArray<ProductReview>> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return []
  try {
    const res = await fetch(
      `${config.url}/rest/v1/product_reviews?status=eq.published&order=published_at.desc&select=*`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as ProductReviewRow[]
    return rows.map(reviewFromRow)
  } catch {
    return []
  }
}

export const Route = createFileRoute('/avis')({
  component: ReviewsPage,
  loader: async () => ({ reviews: await loadPublishedReviews() }),
  head: ({ loaderData }) => {
    const reviews = loaderData?.reviews ?? []
    const stats = aggregateReviews(reviews)
    const base = buildSeoHead({
      title: 'Avis clients vérifiés',
      description:
        'Les avis de professionnels (restaurants, hôtels, campings) ayant commandé leur mobilier outdoor via Container Club — achat vérifié.',
      path: '/avis',
    })
    if (stats.count === 0) return base
    return {
      ...base,
      scripts: [
        jsonLdScript({
          ...organizationJsonLd(),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: stats.average,
            reviewCount: stats.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 25).map((r) => ({
            '@type': 'Review',
            reviewRating: {
              '@type': 'Rating',
              ratingValue: r.rating,
              bestRating: 5,
            },
            author: {
              '@type': 'Organization',
              name: r.companyName ?? r.authorName,
            },
            name: r.title ?? undefined,
            reviewBody: r.body,
            datePublished: r.publishedAt ?? undefined,
          })),
        }),
      ],
    }
  },
})

function Stars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${
            i < Math.round(rating)
              ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
              : 'text-[color:var(--sand-deep)]'
          }`}
        />
      ))}
    </span>
  )
}

function ReviewsPage() {
  const { reviews } = Route.useLoaderData()
  const stats = aggregateReviews(reviews)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Avis clients
        </div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          La confiance des professionnels CHR
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Des restaurants, hôtels et campings qui ont équipé leurs terrasses via
          nos containers groupés. Chaque avis provient d'un professionnel ayant
          réellement passé commande (achat vérifié).
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-5 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
          {stats.count > 0 ? (
            <div className="flex items-center gap-3">
              <span className="font-display text-4xl font-semibold tabular-nums">
                {stats.average.toFixed(1)}
              </span>
              <div>
                <Stars rating={stats.average} />
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.count} avis vérifié{stats.count > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Les premiers avis clients seront publiés ici après les premières
              livraisons.
            </p>
          )}

          {GOOGLE_REVIEW_URL && (
            <Button
              asChild
              variant="outline"
              className="ml-auto gap-1.5"
            >
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                Laisser un avis Google
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>

        {reviews.length > 0 && (
          <div className="mt-6 space-y-3">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {review.companyName ?? review.authorName}
                      </span>
                      {review.verifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-[color:var(--forest)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--forest)]">
                          <BadgeCheck className="h-3 w-3" />
                          Achat vérifié
                        </span>
                      )}
                    </div>
                    {review.title && (
                      <div className="mt-1 text-sm font-medium">
                        {review.title}
                      </div>
                    )}
                  </div>
                  <Stars rating={review.rating} size="h-3.5 w-3.5" />
                </div>
                <p className="text-foreground/80 mt-2 text-sm leading-6">
                  « {review.body} »
                </p>
              </article>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
