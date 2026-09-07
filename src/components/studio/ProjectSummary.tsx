// Contenu partagé du rail desktop et de la barre/feuille mobile (lot 2) :
// UNE seule source, le store. Sélection explicite, quantité, état projet
// calculé par le lot 1, CTA adapté (aucun devis ni réservation au lot 2).

import { Link } from '@tanstack/react-router'
import { ArrowRight, Trash2 } from 'lucide-react'

import { SafeImage } from '@/components/SafeImage'
import { formatEUR } from '@/lib/order'
import { cardImageUrl } from '@/lib/studio/discovery'
import { resolveFulfillment } from '@/lib/studio/fulfillment'
import { computeProjectState } from '@/lib/studio/project-state'
import { describeQuantity } from '@/lib/studio/quantity-feedback'
import { computeReadiness } from '@/lib/studio/readiness'
import type { FulfillmentContext, ProjectState, StudioProduct, StudioProjectItem } from '@/lib/studio/types'
import type { StudioEntry } from '@/stores/studio.store'

const STATE_LABEL: Record<ProjectState, string> = {
  reservation_ready: 'Prêt à réserver',
  auto_quote_ready: 'Devis possible',
  feasibility_review: 'Étude de faisabilité',
  manual_quote_required: 'Devis manuel',
}

const ENTRY_LABEL: Record<StudioEntry, string> = {
  full_project: 'Projet complet',
  seats: 'Assises',
  tables: 'Tables',
}

export interface ProjectSummaryProps {
  readonly entry: StudioEntry | null
  readonly items: ReadonlyArray<StudioProjectItem>
  readonly productsById: ReadonlyMap<string, StudioProduct>
  readonly context: FulfillmentContext
  readonly onQuantityChange: (item: StudioProjectItem, quantity: number) => void
  readonly onRemove: (item: StudioProjectItem) => void
  readonly onEditQuantity?: (item: StudioProjectItem) => void
  readonly compact?: boolean
}

/** Une référence ou un design disparu reste une ligne à vérifier. */
export function hasUnresolvedItems(
  items: ReadonlyArray<StudioProjectItem>,
  productsById: ReadonlyMap<string, StudioProduct>,
): boolean {
  return items.some((item) => !productsById.get(item.productId)?.variants.some((variant) => variant.id === item.variantId))
}

export function projectStateFor(
  items: ReadonlyArray<StudioProjectItem>,
  productsById: ReadonlyMap<string, StudioProduct>,
  context: FulfillmentContext,
): ProjectState | null {
  if (hasUnresolvedItems(items, productsById)) return 'manual_quote_required'
  const lines = items.flatMap((item) => {
    const product = productsById.get(item.productId)
    if (!product) return []
    return [
      {
        item,
        readiness: computeReadiness(product, context, item.variantId),
        fulfillment: resolveFulfillment(item, product, context),
      },
    ]
  })
  if (lines.length === 0) return null
  return computeProjectState(lines).state
}

export function ProjectSummary({
  entry,
  items,
  productsById,
  context,
  onQuantityChange,
  onRemove,
  onEditQuantity,
  compact = false,
}: ProjectSummaryProps) {
  const state = projectStateFor(items, productsById, context)
  const unresolved = hasUnresolvedItems(items, productsById)
  const totalUnits = items.reduce((sum, item) => sum + item.requestedQuantity, 0)
  const totalHt = items.reduce((sum, item) => {
    const product = productsById.get(item.productId)
    return sum + (product ? product.basePriceHt * item.requestedQuantity : 0)
  }, 0)

  return (
    <div className="space-y-4">
      <div>
        <div className="label-eyebrow text-[color:var(--ember)]">Mon projet</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{entry ? ENTRY_LABEL[entry] : 'Studio'}</h2>
          {state && (
            <span
              data-testid="project-state"
              className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-0.5 text-xs font-medium"
            >
              {STATE_LABEL[state]}
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--ink-soft)]">
          Aucune assise choisie pour l&apos;instant. Un favori n&apos;est pas un choix : le projet se
          remplit avec « Choisir cette assise ».
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Lignes du projet">
          {items.map((item) => {
            const product = productsById.get(item.productId)
            if (!product || !product.variants.some((variant) => variant.id === item.variantId)) return (
              <li key={`${item.productId}:${item.variantId}`} className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-3">
                <div className="text-sm font-semibold">Référence à vérifier</div>
                <p className="mt-1 text-xs text-[color:var(--ink-soft)]">Cette référence n&apos;est pas disponible dans le catalogue actuel.</p>
                <p className="mt-2 text-xs">Quantité demandée : {item.requestedQuantity}</p>
                <button type="button" onClick={() => onRemove(item)} aria-label="Retirer la référence à vérifier du projet"
                  className="mt-2 inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 text-xs font-medium text-[color:var(--stamp)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Retirer
                </button>
              </li>
            )
            const variant = product.variants.find((entry) => entry.id === item.variantId)
            const feedback = describeQuantity(item, product, context)
            return (
              <li
                key={`${item.productId}:${item.variantId}`}
                className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-3"
              >
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-white">
                    <SafeImage
                      src={cardImageUrl(product, item.variantId)}
                      alt={product.name}
                      className="h-full w-full"
                      imgClassName="h-full w-full object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{product.name}</div>
                    {variant && <div className="truncate text-xs text-[color:var(--ink-soft)]">{variant.name}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <label className="flex items-center gap-1.5">
                        <span className="text-[color:var(--ink-soft)]">Qté</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={item.requestedQuantity}
                          aria-label={`Quantité pour ${product.name}`}
                          onChange={(event) => {
                            if (event.target.value === '') return
                            onQuantityChange(item, Number(event.target.value))
                          }}
                          className="min-h-[44px] w-20 rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--paper)] px-2 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
                        />
                      </label>
                      <span className="tabular-nums text-[color:var(--ink-soft)]">
                        {formatEUR(product.basePriceHt)} HT / unité
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[color:var(--ink-soft)]" data-tone={feedback.tone}>
                  {feedback.title}
                </p>
                <div className="mt-2 flex gap-2">
                  {onEditQuantity && !compact && (
                    <button
                      type="button"
                      onClick={() => onEditQuantity(item)}
                      className="inline-flex min-h-[44px] items-center rounded-sm border border-[color:var(--sand-deep)] px-3 text-xs font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
                    >
                      Revoir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    aria-label={`Retirer ${product.name} du projet`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 text-xs font-medium text-[color:var(--stamp)] hover:border-[color:var(--stamp)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Retirer
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > 0 && (
        <div className="border-t border-[color:var(--sand-deep)] pt-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[color:var(--ink-soft)]">
              {totalUnits} unité{totalUnits > 1 ? 's' : ''}
            </span>
            <span className="font-display text-lg font-bold tabular-nums">{unresolved ? 'Montant à vérifier' : `${formatEUR(totalHt)} HT`}</span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
            Montant indicatif au prix public. Le devis et la réservation arrivent dans une prochaine
            étape du Studio.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {entry === 'full_project' && (
          <Link
            to="/catalogue"
            search={{ collection: 'pietements' }}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[color:var(--ink)] px-4 text-sm font-semibold text-[color:var(--sand)] transition-colors hover:bg-[color:var(--ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
          >
            Passer aux tables (catalogue)
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <p className="text-xs text-[color:var(--ink-soft)]">
          Votre projet est conservé sur cet appareil.
        </p>
      </div>
    </div>
  )
}
