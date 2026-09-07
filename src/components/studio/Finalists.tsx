// Finalistes (lot 2) : au plus 3 sélectionnés, 2 acceptés, jamais un
// troisième inventé. Le prix apparaît ici (comparaison), jamais comme
// signal. « Voir plus de finalistes » propose 2 candidats à comparer ou à
// substituer, sans jamais dépasser 3 sélectionnés. Le choix reste
// EXPLICITE : « Choisir cette assise ».

import { Heart, Replace, X } from 'lucide-react'

import { SafeImage } from '@/components/SafeImage'
import { formatEUR } from '@/lib/order'
import { cardImageUrl, seatSpecLine } from '@/lib/studio/discovery'
import { MAX_FINALISTS } from '@/lib/studio/engine'
import { materialLabel, seatKindLabel } from '@/lib/studio/labels'
import type { StudioProduct } from '@/lib/studio/types'

export function Finalists({
  finalists,
  moreCandidates,
  onShowMore,
  canShowMore,
  onChoose,
  onOpenDetails,
  onRemove,
  onReplace,
  candidateAction,
}: {
  readonly finalists: ReadonlyArray<StudioProduct>
  /** Candidats supplémentaires révélés par « Voir plus ». */
  readonly moreCandidates: ReadonlyArray<StudioProduct>
  readonly onShowMore: () => void
  readonly canShowMore: boolean
  readonly onChoose: (productId: string) => void
  readonly onOpenDetails: (productId: string) => void
  readonly onRemove: (productId: string) => void
  /** Remplace un finaliste par un candidat (ou l'ajoute s'il reste une place). */
  readonly onReplace: (candidateId: string) => void
  readonly candidateAction: (candidateId: string) => 'add' | 'replace' | 'compare'
}) {
  return (
    <section aria-label="Vos finalistes" className="space-y-6">
      <div>
        <p className="label-eyebrow text-[color:var(--ember)]">Affinons votre sélection</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Vos finalistes</h2>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-soft)]">
          Jusqu&apos;à {MAX_FINALISTS} assises issues de vos favoris, à comparer avec leur prix public. Le
          choix vous appartient : rien n&apos;est décidé tant que vous n&apos;avez pas cliqué « Choisir
          cette assise ».
        </p>
      </div>

      {finalists.length === 0 ? (
        <p className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-4 text-sm">
          Aucun finaliste pour l&apos;instant : ajoutez des favoris avec « J&apos;aime ».
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Finalistes sélectionnés"
          data-testid="finalists"
        >
          {finalists.map((product) => (
            <li
              key={product.id}
              className="flex flex-col overflow-hidden rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)]"
            >
              <button
                type="button"
                onClick={() => onOpenDetails(product.id)}
                aria-label={`Voir les détails de ${product.name}`}
                className="aspect-square bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ink)]"
              >
                <SafeImage
                  src={cardImageUrl(product)}
                  alt={product.name}
                  className="h-full w-full"
                  imgClassName="h-full w-full object-contain p-5"
                />
              </button>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <div className="label-eyebrow text-[color:var(--ink-soft)]">
                    {[seatKindLabel(product.studio.seatKind), materialLabel(product.studio.material)]
                      .filter(Boolean)
                      .join(' · ') || 'Assise'}
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold leading-tight">{product.name}</h3>
                  {seatSpecLine(product) && (
                    <p className="text-xs tabular-nums text-[color:var(--ink-soft)]">{seatSpecLine(product)}</p>
                  )}
                </div>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {formatEUR(product.basePriceHt)}{' '}
                  <span className="text-xs font-normal text-[color:var(--ink-soft)]">HT / unité</span>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onChoose(product.id)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[color:var(--ember)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--ember-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                  >
                    Choisir cette assise
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(product.id)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-[color:var(--sand-deep)] px-3 text-sm font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                    >
                      Détails
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(product.id)}
                      aria-label={`Retirer ${product.name} des finalistes`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[color:var(--sand-deep)] px-3 text-sm hover:border-[color:var(--stamp)] hover:text-[color:var(--stamp)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        {canShowMore && (
          <button
            type="button"
            onClick={onShowMore}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] px-4 text-sm font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
          >
            <Heart className="h-4 w-4" aria-hidden />
            Voir plus de finalistes
          </button>
        )}
        {moreCandidates.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Autres favoris à comparer" data-testid="more-finalists">
            {moreCandidates.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-white">
                  <SafeImage
                    src={cardImageUrl(product)}
                    alt={product.name}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-contain p-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{product.name}</div>
                  <div className="text-xs tabular-nums text-[color:var(--ink-soft)]">
                    {formatEUR(product.basePriceHt)} HT
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onReplace(product.id)}
                  aria-label={`Comparer ${product.name} parmi les finalistes`}
                  title={candidateAction(product.id) === 'compare' ? 'Consulter sans ajouter aux finalistes' : candidateAction(product.id) === 'replace' ? 'Remplace le dernier finaliste' : 'Ajoute aux finalistes'}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] px-3 text-xs font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                >
                  <Replace className="h-3.5 w-3.5" aria-hidden />
                  {candidateAction(product.id) === 'compare' ? 'Comparer' : candidateAction(product.id) === 'replace' ? 'Remplacer' : 'Ajouter'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
