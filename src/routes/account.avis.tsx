import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAccountReservations } from '@/hooks/useAccountReservations'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { buildSeoHead } from '@/lib/seo'
import {
  submitProductReview,
  type ReviewSubmitClient,
} from '@/lib/reviews/reviews'
import { AnalyticsEvent, track } from '@/lib/analytics'

export const Route = createFileRoute('/account/avis')({
  component: AccountReviews,
  head: () =>
    buildSeoHead({
      title: 'Donner mon avis',
      description: 'Laissez un avis sur les produits que vous avez commandés.',
      path: '/account/avis',
      noindex: true,
    }),
})

interface PurchasedProduct {
  readonly productId: string
  readonly productName: string
}

function AccountReviews() {
  const { reservations, authStatus } = useAccountReservations()

  const products = useMemo<ReadonlyArray<PurchasedProduct>>(() => {
    const seen = new Map<string, PurchasedProduct>()
    for (const r of reservations) {
      for (const line of r.draft.lines) {
        if (!seen.has(line.productId)) {
          seen.set(line.productId, {
            productId: line.productId,
            productName: line.productName,
          })
        }
      }
    }
    return [...seen.values()]
  }, [reservations])

  const [active, setActive] = useState<string | null>(null)
  const [done, setDone] = useState<ReadonlySet<string>>(new Set())

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main id="contenu" className="mx-auto max-w-2xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">Mon espace</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Donner mon avis
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Votre retour aide les autres professionnels. Seuls les produits que
          vous avez commandés sont éligibles ; l'avis est publié après
          validation.{' '}
          <Link
            to="/account"
            className="text-foreground underline underline-offset-4"
          >
            Retour au tableau de bord
          </Link>
        </p>

        {authStatus !== 'authenticated' ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 p-4 text-sm">
            <span>Connectez-vous pour laisser un avis.</span>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              <Link to="/auth/login" search={{ returnTo: '/account/avis' }}>
                Se connecter
              </Link>
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="mt-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-8 text-center text-sm text-muted-foreground">
            Vous pourrez laisser un avis dès que vous aurez commandé un produit.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {products.map((product) => (
              <ReviewCard
                key={product.productId}
                product={product}
                open={active === product.productId}
                done={done.has(product.productId)}
                onToggle={() =>
                  setActive((cur) =>
                    cur === product.productId ? null : product.productId,
                  )
                }
                onDone={() => {
                  setDone((prev) => new Set(prev).add(product.productId))
                  setActive(null)
                }}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function ReviewCard({
  product,
  open,
  done,
  onToggle,
  onDone,
}: {
  readonly product: PurchasedProduct
  readonly open: boolean
  readonly done: boolean
  readonly onToggle: () => void
  readonly onDone: () => void
}) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [company, setCompany] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(): Promise<void> {
    if (body.trim().length < 10) {
      toast.error('Merci de détailler un peu votre avis (10 caractères min).')
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setSubmitting(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ReviewSubmitClient
      await submitProductReview(client, {
        productId: product.productId,
        rating,
        title,
        body,
        authorName: author,
        companyName: company,
      })
      toast.success('Merci ! Votre avis sera publié après validation.')
      track(AnalyticsEvent.ReviewSubmit, { product: product.productId })
      onDone()
    } catch (err) {
      toast.error(
        'Envoi impossible : ' +
          (err instanceof Error ? err.message : 'erreur inconnue'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-sm font-semibold">
          {product.productName}
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--forest)]">
            <Check className="h-3.5 w-3.5" /> Avis envoyé
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={onToggle}>
            {open ? 'Fermer' : 'Donner mon avis'}
          </Button>
        )}
      </div>

      {open && !done && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1} étoile${i > 0 ? 's' : ''}`}
                  onClick={() => setRating(i + 1)}
                >
                  <Star
                    className={`h-6 w-6 ${
                      i < rating
                        ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
                        : 'text-[color:var(--sand-deep)]'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Votre nom (affiché)
              </Label>
              <Input
                value={author}
                placeholder="Ex. Marie D."
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Établissement
              </Label>
              <Input
                value={company}
                placeholder="Ex. Restaurant La Marina"
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Titre (optionnel)
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Votre avis</Label>
            <Textarea
              rows={4}
              value={body}
              placeholder="Qualité, tenue en extérieur, conformité, délais…"
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? 'Envoi…' : 'Envoyer mon avis'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
