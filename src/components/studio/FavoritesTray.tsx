// Favoris (lot 2) : ❤️ = intérêt, jamais une décision de projet. Vignettes
// retirables, accès aux finalistes. Vocabulaire neutre : « Vos favoris ».

import { Heart, X } from 'lucide-react'

import { SafeImage } from '@/components/SafeImage'
import { cardImageUrl } from '@/lib/studio/discovery'
import type { StudioProduct } from '@/lib/studio/types'

export function FavoritesTray({
  favorites,
  onRemove,
  onOpenFinalists,
  onOpenDetails,
}: {
  readonly favorites: ReadonlyArray<StudioProduct>
  readonly onRemove: (productId: string) => void
  readonly onOpenFinalists: () => void
  readonly onOpenDetails?: (productId: string) => void
}) {
  return (
    <section
      aria-label="Vos favoris"
      className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Heart className="h-4 w-4 text-[color:var(--ember)]" aria-hidden />
          Vos favoris
          <span className="mono text-xs text-[color:var(--ink-soft)]">({favorites.length})</span>
        </h3>
        <button
          type="button"
          onClick={onOpenFinalists}
          disabled={favorites.length === 0}
          className="inline-flex min-h-[44px] items-center rounded-md bg-[color:var(--ink)] px-4 text-sm font-semibold text-[color:var(--sand)] transition-colors hover:bg-[color:var(--ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 disabled:opacity-40"
        >
          Vos finalistes
        </button>
      </div>
      {favorites.length === 0 ? (
        <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
          Appuyez sur « J&apos;aime » pour garder une assise ici. Un favori n&apos;engage rien.
        </p>
      ) : (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1" aria-label="Liste des favoris">
          {favorites.map((product) => (
            <li key={product.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => onOpenDetails?.(product.id)}
                aria-label={`Détails de ${product.name}`}
                className="block h-20 w-20 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
              >
                <SafeImage
                  src={cardImageUrl(product)}
                  alt={product.name}
                  className="h-full w-full"
                  imgClassName="h-full w-full object-contain p-1"
                />
              </button>
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                aria-label={`Retirer ${product.name} des favoris`}
                className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--sand-deep)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--sand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
