// Carte de décision (lot 2) : image dominante, nom, matière (donnée), UNE
// spécification de la base, trois actions visibles en permanence. Pas de
// prix ici : le prix n'est pas un signal de goût. Raccourcis clavier gérés
// au niveau du document quand la carte est active (jamais dans un champ
// de saisie). Animation d'entrée uniquement sans prefers-reduced-motion.

import { Info } from 'lucide-react'
import { useEffect } from 'react'

import { SafeImage } from '@/components/SafeImage'
import { cardImageUrl, seatSpecLine } from '@/lib/studio/discovery'
import { materialLabel, seatKindLabel } from '@/lib/studio/labels'
import type { StudioProduct } from '@/lib/studio/types'

import { DECISION_SHORTCUTS, DecisionActions, DecisionShortcutsHint } from './DecisionActions'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export interface DecisionCardProps {
  readonly product: StudioProduct
  readonly position: number
  readonly total: number
  readonly onLike: () => void
  readonly onDislike: () => void
  readonly onPass: () => void
  readonly onUndo?: () => void
  readonly onDetails?: () => void
  /** Raccourcis actifs (désactivés quand un dialogue est ouvert). */
  readonly shortcutsEnabled?: boolean
}

export function DecisionCard({
  product,
  position,
  total,
  onLike,
  onDislike,
  onPass,
  onUndo,
  onDetails,
  shortcutsEnabled = true,
}: DecisionCardProps) {
  useEffect(() => {
    if (!shortcutsEnabled || typeof document === 'undefined') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      switch (event.key) {
        case DECISION_SHORTCUTS.like:
          event.preventDefault()
          onLike()
          return
        case DECISION_SHORTCUTS.dislike:
          event.preventDefault()
          onDislike()
          return
        case DECISION_SHORTCUTS.pass:
          event.preventDefault()
          onPass()
          return
        case 'z':
        case 'Z':
          if (onUndo) {
            event.preventDefault()
            onUndo()
          }
          return
        case 'd':
        case 'D':
          if (onDetails) {
            event.preventDefault()
            onDetails()
          }
          return
        default:
          return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [shortcutsEnabled, onLike, onDislike, onPass, onUndo, onDetails])

  const material = materialLabel(product.studio.material)
  const kind = seatKindLabel(product.studio.seatKind)
  const spec = seatSpecLine(product)
  const image = cardImageUrl(product)

  return (
    <article
      aria-label={`Assise ${position + 1} sur ${total} : ${product.name}`}
      className="motion-safe:animate-fade-in"
      data-testid="decision-card"
      key={product.id}
    >
      <div className="overflow-hidden rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] shadow-paper">
        <div className="relative aspect-[4/3] bg-white sm:aspect-[5/4] lg:aspect-[4/3]">
          <SafeImage
            src={image}
            alt={product.name}
            loading="eager"
            className="h-full w-full"
            imgClassName="h-full w-full object-contain p-6 sm:p-10"
          />
          <span className="label-eyebrow absolute left-4 top-4 rounded-sm bg-[color:var(--sand)]/90 px-2 py-1 text-[color:var(--ink-soft)]">
            {position + 1} / {total}
          </span>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="label-eyebrow text-[color:var(--ink-soft)]">
              {[kind, material].filter(Boolean).join(' · ') || 'Assise'}
            </div>
            <h2 className="mt-1 truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {product.name}
            </h2>
            {spec && (
              <p className="mt-1 text-sm tabular-nums text-[color:var(--ink-soft)]">{spec}</p>
            )}
          </div>
          {onDetails && (
            <button
              type="button"
              onClick={onDetails}
              aria-label={`Voir les détails de ${product.name}`}
              aria-keyshortcuts="d"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-[color:var(--sand-deep)] px-4 text-sm font-medium transition-colors hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
            >
              <Info className="h-4 w-4" aria-hidden />
              Détails
            </button>
          )}
        </div>
      </div>
      <div className="mt-4">
        <DecisionActions
          productName={product.name}
          onDislike={onDislike}
          onPass={onPass}
          onLike={onLike}
        />
        <DecisionShortcutsHint />
      </div>
    </article>
  )
}
