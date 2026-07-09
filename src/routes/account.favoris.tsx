import { Link, createFileRoute } from '@tanstack/react-router'
import { Heart, Loader2 } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCatalog } from '@/hooks/useCatalog'
import { useFavorites } from '@/hooks/useFavorites'
import { formatEUR } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute('/account/favoris')({
  component: FavoritesPage,
  head: () =>
    buildSeoHead({
      title: 'Mes favoris',
      description: 'Vos produits favoris Container Club.',
      path: '/account/favoris',
      noindex: true,
    }),
})

function FavoritesPage() {
  const { status } = useAuth()
  const { products } = useCatalog()
  const favorites = useFavorites()

  const favoriteProducts = products.filter((p) => favorites.isFavorite(p.id))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main id="contenu" className="mx-auto max-w-4xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">Mon espace</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Mes favoris
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Vos coups de cœur, prêts à réserver au prochain départ.{' '}
          <Link
            to="/account"
            className="text-foreground underline underline-offset-4"
          >
            Retour au tableau de bord
          </Link>
        </p>

        {status !== 'authenticated' ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 p-4 text-sm">
            <span>Connectez-vous pour retrouver vos favoris.</span>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              <Link to="/auth/login" search={{ returnTo: '/account/favoris' }}>
                Se connecter
              </Link>
            </Button>
          </div>
        ) : favorites.loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de vos favoris…
          </div>
        ) : favoriteProducts.length === 0 ? (
          <div className="mt-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-8 text-center">
            <Heart className="mx-auto h-7 w-7 text-[color:var(--sand-deep)]" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun favori pour le moment. Parcourez le catalogue et cliquez sur
              le cœur d'un produit.
            </p>
            <Button
              asChild
              className="mt-4 h-10 rounded-sm bg-foreground px-4 text-sm text-background"
            >
              <a href="/catalogue">Voir le catalogue</a>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {favoriteProducts.map((product) => (
              <article
                key={product.id}
                className="shadow-paper flex flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
              >
                <div className="relative">
                  <a href="/catalogue" className="block aspect-square bg-[color:var(--sand)]">
                    <img
                      src={product.mainImageUrl}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => favorites.toggle(product.id)}
                    aria-label="Retirer des favoris"
                    className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/80 backdrop-blur hover:bg-white"
                  >
                    <Heart className="h-4 w-4 fill-[color:var(--ember)] text-[color:var(--ember)]" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col p-2.5">
                  <div className="line-clamp-2 font-display text-sm font-semibold leading-tight">
                    {product.name}
                  </div>
                  <div className="mt-1 font-display text-base font-semibold tabular-nums">
                    {formatEUR(product.basePriceHt)}
                  </div>
                  <a
                    href="/catalogue"
                    className="mt-auto pt-2 text-xs text-[color:var(--ember)] underline-offset-4 hover:underline"
                  >
                    Réserver au catalogue →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
