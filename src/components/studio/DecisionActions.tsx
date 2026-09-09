// Les trois décisions (lot 2), TOUJOURS visibles, ≥ 44 px, étiquetées, avec
// raccourcis clavier documentés dans l'interface. Aucun geste obligatoire.

import { Heart, SkipForward, X } from 'lucide-react'

export const DECISION_SHORTCUTS = {
  dislike: 'ArrowLeft',
  pass: 'ArrowDown',
  like: 'ArrowRight',
  undo: 'z',
} as const

export function DecisionActions({
  onDislike,
  onPass,
  onLike,
  disabled = false,
  productName,
}: {
  readonly onDislike: () => void
  readonly onPass: () => void
  readonly onLike: () => void
  readonly disabled?: boolean
  readonly productName: string
}) {
  const base =
    'inline-flex min-h-[48px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border px-2 text-xs sm:px-4 sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 disabled:opacity-50 motion-safe:transition-colors'
  return (
    <div
      role="group"
      aria-label={`Décider pour ${productName}`}
      className="flex w-full items-stretch gap-2 sm:gap-3"
    >
      <button
        type="button"
        onClick={onDislike}
        disabled={disabled}
        aria-label={`Pas pour moi : ${productName}`}
        aria-keyshortcuts="ArrowLeft"
        className={`${base} border-[color:var(--sand-deep)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:border-[color:var(--ink)]`}
      >
        <X className="h-4 w-4 shrink-0" aria-hidden />
        Pas pour moi
      </button>
      <button
        type="button"
        onClick={onPass}
        disabled={disabled}
        aria-label={`Passer : ${productName}`}
        aria-keyshortcuts="ArrowDown"
        className={`${base} border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-[color:var(--ink-soft)] hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]`}
      >
        <SkipForward className="h-4 w-4 shrink-0" aria-hidden />
        Passer
      </button>
      <button
        type="button"
        onClick={onLike}
        disabled={disabled}
        aria-label={`J'aime : ${productName}`}
        aria-keyshortcuts="ArrowRight"
        className={`${base} border-[color:var(--ember)] bg-[color:var(--ember)] text-white hover:bg-[color:var(--ember-hover)]`}
      >
        <Heart className="h-4 w-4 shrink-0" aria-hidden />
        J&apos;aime
      </button>
    </div>
  )
}

export function DecisionShortcutsHint() {
  return (
    <p className="mt-3 hidden text-xs text-[color:var(--ink-soft)] sm:block">
      Clavier :{' '}
      <kbd className="mono rounded-sm border border-[color:var(--sand-deep)] px-1">
        ←
      </kbd>{' '}
      pas pour moi ·{' '}
      <kbd className="mono rounded-sm border border-[color:var(--sand-deep)] px-1">
        ↓
      </kbd>{' '}
      passer ·{' '}
      <kbd className="mono rounded-sm border border-[color:var(--sand-deep)] px-1">
        →
      </kbd>{' '}
      j&apos;aime ·{' '}
      <kbd className="mono rounded-sm border border-[color:var(--sand-deep)] px-1">
        Z
      </kbd>{' '}
      annuler ·{' '}
      <kbd className="mono rounded-sm border border-[color:var(--sand-deep)] px-1">
        D
      </kbd>{' '}
      détails
    </p>
  )
}
