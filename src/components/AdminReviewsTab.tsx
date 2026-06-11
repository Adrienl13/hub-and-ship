import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { AuthStatus } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import {
  fetchAllReviewsForAdmin,
  setReviewStatus,
  type ProductReview,
  type ReviewAdminClient,
  type ReviewsReadClient,
  type ReviewStatus,
} from '@/lib/reviews/reviews'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'En attente',
  published: 'Publié',
  rejected: 'Rejeté',
}

const STATUS_ORDER: Record<ReviewStatus, number> = {
  pending: 0,
  published: 1,
  rejected: 2,
}

export function AdminReviewsTab({ authStatus }: { authStatus: AuthStatus }) {
  const [reviews, setReviews] = useState<ReadonlyArray<ProductReview>>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ReviewsReadClient
      setReviews(await fetchAllReviewsForAdmin(client))
    } catch (err) {
      toast.error(
        'Lecture des avis impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') void refresh()
  }, [authStatus, refresh])

  async function moderate(id: string, status: ReviewStatus): Promise<void> {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setBusyId(id)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ReviewAdminClient
      await setReviewStatus(client, id, status)
      toast.success(
        status === 'published' ? 'Avis publié.' : 'Avis rejeté.',
      )
      await refresh()
    } catch (err) {
      toast.error(
        'Action impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setBusyId(null)
    }
  }

  const sorted = [...reviews].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )
  const pendingCount = reviews.filter((r) => r.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des avis…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          Avis produits{' '}
          {pendingCount > 0 && (
            <span className="ml-1 rounded-sm bg-[color:var(--ember)] px-2 py-0.5 text-xs text-white">
              {pendingCount} à valider
            </span>
          )}
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
          Rafraîchir
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
          Aucun avis pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((review) => (
            <li
              key={review.id}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{review.companyName ?? review.authorName}</span>
                    {review.verifiedPurchase && (
                      <BadgeCheck className="h-3.5 w-3.5 text-[color:var(--forest)]" />
                    )}
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < review.rating
                              ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
                              : 'text-[color:var(--sand-deep)]'
                          }`}
                        />
                      ))}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Produit <code>{review.productId}</code> ·{' '}
                    {STATUS_LABEL[review.status]}
                  </div>
                  {review.title && (
                    <div className="mt-1 text-sm font-medium">{review.title}</div>
                  )}
                  <p className="text-foreground/80 mt-1 text-sm">{review.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {review.status !== 'published' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === review.id}
                      onClick={() => void moderate(review.id, 'published')}
                    >
                      Publier
                    </Button>
                  )}
                  {review.status !== 'rejected' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === review.id}
                      onClick={() => void moderate(review.id, 'rejected')}
                    >
                      Rejeter
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
