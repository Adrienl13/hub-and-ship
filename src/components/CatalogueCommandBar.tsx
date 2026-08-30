import { ArrowRight, FileText, ShoppingBag } from 'lucide-react'

import { formatEUR } from '@/lib/order'

// Barre de commande fixe en bas du catalogue (handoff design 08/2026,
// validé) : dès qu'il y a 1 pièce au panier, l'accès à la commande est
// PERMANENT — l'utilisateur ne cherche jamais son panier. Fond brun sombre
// (--foreground), jamais de noir pur.

export function CatalogueCommandBar({
  totalUnits,
  totalHt,
  payNow,
  onDownloadPdf,
  onReserve,
}: {
  readonly totalUnits: number
  /** Total HT après remise volume. */
  readonly totalHt: number
  /** Acompte du jour = frais de réservation (3 %, min 150 € / max 500 €). */
  readonly payNow: number
  readonly onDownloadPdf: () => void
  readonly onReserve: () => void
}) {
  if (totalUnits <= 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[color:var(--foreground)] text-[color:var(--sand)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="whitespace-nowrap font-display text-sm font-bold tabular-nums sm:text-base">
            {totalUnits} pièce{totalUnits > 1 ? 's' : ''} ·{' '}
            {formatEUR(totalHt)} HT
          </span>
          <span className="text-[color:var(--sand)]/70 min-w-0 text-xs">
            Acompte aujourd&apos;hui :{' '}
            <strong className="text-[color:var(--ember-bright)]">
              {formatEUR(payNow)}
            </strong>{' '}
            — le reste suit le container
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-[color:var(--sand)]/30 px-4 text-sm font-medium transition-colors hover:border-[color:var(--sand)]/70 sm:flex-none"
          >
            <FileText className="h-4 w-4" />
            Devis PDF
          </button>
          {/* Ancre NATIVE vers le panneau panier (#panier) — accès direct,
              pas de scrollIntoView (exigence handoff). */}
          <a
            href="#panier"
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-[color:var(--sand)]/30 px-4 text-sm font-medium transition-colors hover:border-[color:var(--sand)]/70 sm:flex-none"
          >
            <ShoppingBag className="h-4 w-4" />
            Voir mon panier
          </a>
          <button
            type="button"
            onClick={onReserve}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sm bg-[color:var(--ember)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--ember-bright)] sm:flex-none"
          >
            Confirmer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
